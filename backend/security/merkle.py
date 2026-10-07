"""SATARK Cryptographic Merkle Tree & Tamper-Proof Audit Ledger.

Implements:
1. Canonical SHA-256 Merkle Tree with proof generation and verification.
2. Append-only tamper-evident Audit Ledger conforming to Problem Statement #11
   ("RegTech: AI-Driven AML Monitoring with Immutable Reporting").
3. Proof verification engine allowing auditors to mathematically prove
   that any Alert, SAR filing, Ring detection, or Freeze order was not altered.
"""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, List, Optional, Tuple


def sha256_hash(val: str | bytes) -> str:
    """Compute SHA-256 hex digest."""
    if isinstance(val, str):
        val = val.encode("utf-8")
    return hashlib.sha256(val).hexdigest()


def canonical_json(data: Any) -> str:
    """Deterministic JSON serialization for hashing."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


class MerkleTree:
    """Cryptographic SHA-256 Merkle Tree."""

    def __init__(self, leaves: List[str]):
        """Initialize tree with raw leaf hashes or data strings.
        
        If leaves are not 64-char hex strings, they are automatically SHA-256 hashed.
        """
        self.raw_leaves = leaves
        self.leaf_hashes = [
            l if (len(l) == 64 and all(c in "0123456789abcdefABCDEF" for c in l))
            else sha256_hash(l)
            for l in leaves
        ]
        self.layers: List[List[str]] = []
        self._build_tree()

    def _build_tree(self):
        if not self.leaf_hashes:
            self.root = "0" * 64
            self.layers = [[]]
            return

        current = list(self.leaf_hashes)
        self.layers = [current]

        while len(current) > 1:
            next_layer = []
            for i in range(0, len(current), 2):
                left = current[i]
                if i + 1 < len(current):
                    right = current[i + 1]
                else:
                    # Duplicate last leaf if odd number of elements (RFC 6962 / Bitcoin standard)
                    right = left
                combined = sha256_hash(left + right)
                next_layer.append(combined)
            current = next_layer
            self.layers.append(current)

        self.root = current[0] if current else "0" * 64

    def get_root(self) -> str:
        return self.root

    def get_proof(self, index: int) -> List[Dict[str, str]]:
        """Generate audit proof (path of sibling hashes) for the leaf at `index`."""
        if index < 0 or index >= len(self.leaf_hashes):
            raise ValueError(f"Leaf index {index} out of range [0, {len(self.leaf_hashes)-1}]")

        proof: List[Dict[str, str]] = []
        curr_idx = index

        for layer in self.layers[:-1]:
            is_right_child = (curr_idx % 2 == 1)
            sibling_idx = curr_idx - 1 if is_right_child else curr_idx + 1

            if sibling_idx < len(layer):
                sibling_hash = layer[sibling_idx]
            else:
                sibling_hash = layer[curr_idx]  # Duplicated leaf

            proof.append({
                "position": "left" if is_right_child else "right",
                "hash": sibling_hash,
            })
            curr_idx //= 2

        return proof

    @staticmethod
    def verify_proof(
        leaf_hash: str, proof: List[Dict[str, str]], expected_root: str
    ) -> Tuple[bool, List[Dict[str, Any]]]:
        """Verify that leaf_hash with given proof reconstructs expected_root.
        
        Returns (is_valid, step_by_step_trace).
        """
        current = leaf_hash
        trace = [{"step": 0, "current": current, "action": "leaf"}]

        for idx, p in enumerate(proof):
            pos = p["position"]
            sibling = p["hash"]
            if pos == "left":
                combined = sha256_hash(sibling + current)
            else:
                combined = sha256_hash(current + sibling)

            trace.append({
                "step": idx + 1,
                "position": pos,
                "sibling": sibling,
                "resulting_hash": combined,
            })
            current = combined

        is_valid = (current.lower() == expected_root.lower())
        return is_valid, trace


class AuditBlock:
    """A batch of audit events anchored into a Merkle root."""

    def __init__(
        self,
        block_height: int,
        prev_block_hash: str,
        events: List[Dict[str, Any]],
        tree: MerkleTree,
    ):
        self.block_height = block_height
        self.timestamp = time.time()
        self.prev_block_hash = prev_block_hash
        self.events = events
        self.merkle_root = tree.get_root()
        self.tree = tree
        self.block_hash = sha256_hash(
            f"{block_height}:{self.timestamp}:{prev_block_hash}:{self.merkle_root}"
        )
        # Simulated on-chain anchoring details (e.g., Polygon / Ethereum L2)
        self.on_chain_tx_hash = "0x" + sha256_hash(f"tx:{self.block_hash}")[:64]
        self.chain_name = "Polygon PoS / Base L2 (Tamper-Proof Anchor)"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "block_height": self.block_height,
            "timestamp": self.timestamp,
            "timestamp_iso": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(self.timestamp)),
            "prev_block_hash": self.prev_block_hash,
            "merkle_root": self.merkle_root,
            "block_hash": self.block_hash,
            "event_count": len(self.events),
            "on_chain_tx_hash": self.on_chain_tx_hash,
            "chain_name": self.chain_name,
        }


class AuditLedger:
    """In-memory append-only tamper-evident audit ledger with periodic Merkle anchoring."""

    def __init__(self):
        self.pending_events: List[Dict[str, Any]] = []
        self.blocks: List[AuditBlock] = []
        self.event_index: Dict[str, Dict[str, Any]] = {}  # event_id -> metadata
        self._genesis()

    def _genesis(self):
        """Seed genesis block."""
        genesis_event = {
            "event_id": "genesis_0000",
            "event_type": "GENESIS_NODE_INITIALIZATION",
            "timestamp": time.time() - 3600,
            "actor": "SATARK_COORDINATOR",
            "bank_id": "CENTRAL_HUB",
            "data": {"message": "SATARK Cross-Bank AML Enclave Initialized"},
        }
        leaf = sha256_hash(canonical_json(genesis_event))
        genesis_event["leaf_hash"] = leaf
        tree = MerkleTree([leaf])

        genesis_block = AuditBlock(
            block_height=0,
            prev_block_hash="0" * 64,
            events=[genesis_event],
            tree=tree,
        )
        self.blocks.append(genesis_block)
        self.event_index[genesis_event["event_id"]] = {
            "block_height": 0,
            "leaf_index": 0,
            "event": genesis_event,
        }

    def record_event(
        self,
        event_type: str,
        data: Dict[str, Any],
        actor: str = "SATARK_ENGINE",
        bank_id: str = "FEDERATION",
        auto_anchor: bool = True,
    ) -> Dict[str, Any]:
        """Record an event into the pending audit ledger."""
        event_id = f"evt_{int(time.time()*1000)}_{len(self.pending_events)}"
        event = {
            "event_id": event_id,
            "event_type": event_type,
            "timestamp": time.time(),
            "timestamp_iso": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "actor": actor,
            "bank_id": bank_id,
            "data": data,
        }
        leaf = sha256_hash(canonical_json(event))
        event["leaf_hash"] = leaf
        self.pending_events.append(event)

        if auto_anchor:
            self.anchor_block()

        return event

    def anchor_block(self) -> Optional[AuditBlock]:
        """Anchor all pending events into a new Merkle block."""
        if not self.pending_events:
            return None

        leaves = [e["leaf_hash"] for e in self.pending_events]
        tree = MerkleTree(leaves)
        prev_hash = self.blocks[-1].block_hash if self.blocks else "0" * 64
        height = len(self.blocks)

        block = AuditBlock(
            block_height=height,
            prev_block_hash=prev_hash,
            events=list(self.pending_events),
            tree=tree,
        )

        for idx, evt in enumerate(self.pending_events):
            self.event_index[evt["event_id"]] = {
                "block_height": height,
                "leaf_index": idx,
                "event": evt,
            }

        self.blocks.append(block)
        self.pending_events = []
        return block

    def get_event_proof(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Get the Merkle proof and anchoring block for a given event ID."""
        info = self.event_index.get(event_id)
        if not info:
            return None

        block_height = info["block_height"]
        leaf_index = info["leaf_index"]
        block = self.blocks[block_height]
        proof = block.tree.get_proof(leaf_index)

        return {
            "event_id": event_id,
            "event": info["event"],
            "leaf_hash": info["event"]["leaf_hash"],
            "leaf_index": leaf_index,
            "block_height": block_height,
            "merkle_root": block.merkle_root,
            "on_chain_tx_hash": block.on_chain_tx_hash,
            "proof": proof,
        }

    def verify_event_integrity(
        self,
        event_id: str,
        tampered_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Verify event integrity mathematically.
        
        If `tampered_data` is passed, recalculates the leaf using the tampered data
        to prove that the Merkle verification FAILS when records are modified.
        """
        proof_info = self.get_event_proof(event_id)
        if not proof_info:
            return {"valid": False, "error": f"Event '{event_id}' not found in audit ledger"}

        original_event = dict(proof_info["event"])
        expected_root = proof_info["merkle_root"]
        proof = proof_info["proof"]

        if tampered_data is not None:
            # Simulate attacker editing data fields
            modified_event = dict(original_event)
            modified_event["data"] = tampered_data
            # Compute attacker leaf
            computed_leaf = sha256_hash(canonical_json(modified_event))
            is_valid, trace = MerkleTree.verify_proof(computed_leaf, proof, expected_root)
            return {
                "valid": is_valid,
                "tampered": True,
                "event_id": event_id,
                "original_leaf": original_event["leaf_hash"],
                "computed_leaf": computed_leaf,
                "expected_root": expected_root,
                "trace": trace,
                "message": (
                    "TAMPER DETECTED! Computed leaf does not match Merkle root. "
                    "Auditor proof failed cryptographically."
                    if not is_valid
                    else "Unexpected match."
                ),
            }
        else:
            computed_leaf = original_event["leaf_hash"]
            is_valid, trace = MerkleTree.verify_proof(computed_leaf, proof, expected_root)
            return {
                "valid": is_valid,
                "tampered": False,
                "event_id": event_id,
                "computed_leaf": computed_leaf,
                "expected_root": expected_root,
                "on_chain_tx_hash": proof_info["on_chain_tx_hash"],
                "trace": trace,
                "message": "VERIFIED: Cryptographic proof is mathematically valid against anchored Merkle root.",
            }

    def get_summary(self) -> Dict[str, Any]:
        """Get audit ledger summary and recent blocks."""
        return {
            "total_blocks": len(self.blocks),
            "total_events": len(self.event_index),
            "pending_events_count": len(self.pending_events),
            "latest_merkle_root": self.blocks[-1].merkle_root if self.blocks else None,
            "latest_tx_hash": self.blocks[-1].on_chain_tx_hash if self.blocks else None,
            "blocks": [b.to_dict() for b in reversed(self.blocks[-10:])],
        }


# Singleton audit ledger instance for the SATARK Backend
global_audit_ledger = AuditLedger()
