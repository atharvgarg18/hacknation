"""Model 2: edge-classification GNN (GraphSAGE w/ reverse message passing; GATv2/GINE variants)."""
from __future__ import annotations

import copy

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATv2Conv, GINEConv, SAGEConv

from ..features.graph_build import IN_EDGE, IN_NODE


class EdgeGNN(nn.Module):
    """conv='sage' : SAGEConv fwd + separate reverse SAGEConv (edge feats enter in the head)
       conv='gatv2': GATv2Conv(edge_dim) fwd + reverse — edge feats in message passing
       conv='gine' : GINEConv fwd + reverse — edge feats in message passing"""

    def __init__(self, in_node=IN_NODE, in_edge=IN_EDGE, hid=64, layers=2, conv="sage", dropout=0.2):
        super().__init__()
        self.conv_type = conv
        self.enc_n = nn.Linear(in_node, hid)
        self.enc_e = nn.Linear(in_edge, hid)
        self.fwd, self.rev = nn.ModuleList(), nn.ModuleList()
        for _ in range(layers):
            self.fwd.append(self._make(conv, hid))
            self.rev.append(self._make(conv, hid))
        self.norms = nn.ModuleList([nn.LayerNorm(hid) for _ in range(layers)])
        self.head = nn.Sequential(nn.Linear(3 * hid, hid), nn.ReLU(), nn.Dropout(dropout), nn.Linear(hid, 1))

    @staticmethod
    def _make(conv, hid):
        if conv == "sage":
            return SAGEConv(hid, hid)
        if conv == "gatv2":
            return GATv2Conv(hid, hid, heads=1, edge_dim=hid, add_self_loops=False)
        if conv == "gine":
            return GINEConv(nn.Sequential(nn.Linear(hid, hid), nn.ReLU(), nn.Linear(hid, hid)), edge_dim=hid)
        raise ValueError(conv)

    def forward(self, x, edge_index, edge_attr):
        h = F.relu(self.enc_n(x))
        e = F.relu(self.enc_e(edge_attr))
        rev = edge_index.flip(0)
        for f, r, ln in zip(self.fwd, self.rev, self.norms):
            if self.conv_type == "sage":
                m = f(h, edge_index) + r(h, rev)
            else:
                m = f(h, edge_index, e) + r(h, rev, e)
            h = ln(F.relu(m) + h)
        s, d = edge_index
        return self.head(torch.cat([h[s], h[d], e], -1)).squeeze(-1)


def make_model(cfg, conv=None):
    c = cfg["models"]["graph_sage"]
    return EdgeGNN(IN_NODE, IN_EDGE, c["hidden_dim"], c["layers"], conv or c.get("conv", "sage"))


def focal_bce(logits, y, pos_weight=1.0, gamma=0.0):
    w = torch.where(y > 0.5, torch.full_like(y, pos_weight), torch.ones_like(y))
    bce = F.binary_cross_entropy_with_logits(logits, y, reduction="none")
    if gamma > 0:
        p = torch.sigmoid(logits)
        pt = torch.where(y > 0.5, p, 1 - p)
        bce = bce * (1 - pt) ** gamma
    return (w * bce).mean()


def train_local(model, snapshots, epochs=1, lr=5e-3, pos_weight=15.0, mu=0.0, global_params=None,
                gamma=0.0, seed=0, label_override=None):
    """Local training (also used as the federated client step). `mu`>0 adds the FedProx term."""
    if not snapshots:
        return 0.0
    g = torch.Generator().manual_seed(seed)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    model.train()
    total, n = 0.0, 0
    for _ in range(epochs):
        for i in torch.randperm(len(snapshots), generator=g).tolist():
            d = snapshots[i]
            y = d.y if label_override is None else label_override(d)
            logits = model(d.x, d.edge_index, d.edge_attr)[d.target_mask]
            loss = focal_bce(logits, y, pos_weight, gamma)
            if mu > 0 and global_params is not None:
                prox = sum(
                    ((p - (torch.as_tensor(gp, device=p.device, dtype=p.dtype) if not isinstance(gp, torch.Tensor) else gp)) ** 2).sum()
                    for p, gp in zip(model.parameters(), global_params)
                )
                loss = loss + 0.5 * mu * prox
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            opt.step()
            total += float(loss) * len(y)
            n += len(y)
    return total / max(n, 1)


@torch.no_grad()
def predict_snapshots(model, snapshots) -> tuple[np.ndarray, np.ndarray]:
    """Returns (global positions, probabilities) for all target edges."""
    model.eval()
    pos, prob = [], []
    for d in snapshots:
        logits = model(d.x, d.edge_index, d.edge_attr)[d.target_mask]
        pos.append(d.target_pos.numpy())
        prob.append(torch.sigmoid(logits).numpy())
    if not pos:
        return np.zeros(0, np.int64), np.zeros(0)
    return np.concatenate(pos), np.concatenate(prob)


@torch.no_grad()
def eval_loss(model, snapshots, pos_weight=15.0):
    model.eval()
    tot, n = 0.0, 0
    for d in snapshots:
        logits = model(d.x, d.edge_index, d.edge_attr)[d.target_mask]
        tot += float(focal_bce(logits, d.y, pos_weight)) * len(d.y)
        n += len(d.y)
    return tot / max(n, 1)


def get_weights(model) -> list[np.ndarray]:
    return [v.detach().cpu().numpy().copy() for v in model.state_dict().values()]


def set_weights(model, weights):
    sd = model.state_dict()
    model.load_state_dict({k: torch.tensor(np.asarray(w)).to(sd[k].dtype) for k, w in zip(sd.keys(), weights)},
                          strict=True)


def clone(model):
    return copy.deepcopy(model)


def fit(model, train_snaps, val_snaps, cfg, seed=0, epochs=None, log=None):
    """Centralized/local training with best-epoch selection on validation PR-AUC."""
    from ..eval.metrics import pr_auc

    c = cfg["models"]["graph_sage"]
    best, best_w = -1.0, get_weights(model)
    for ep in range(epochs or c["epochs"]):
        loss = train_local(model, train_snaps, 1, c["lr"], c["pos_weight"], seed=seed + ep)
        if val_snaps:
            _, p = predict_snapshots(model, val_snaps)
            y = np.concatenate([d.y.numpy() for d in val_snaps])
            score = pr_auc(y, p) if y.sum() > 0 else -loss
        else:
            score = -loss
        if log:
            log(f"  epoch {ep}: loss={loss:.4f} val_pr_auc={score:.4f}")
        if score > best:
            best, best_w = score, get_weights(model)
    set_weights(model, best_w)
    return best
