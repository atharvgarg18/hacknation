"""Attack simulation test — demonstrates end-to-end detection."""
from src.config import load_config, bank_ids, seed_everything
from src.data.ring_generator import RingParams, generate_ring
from src.serving.detector import detect_attack
import pandas as pd
import json

cfg = load_config()
seed_everything(42)
banks = bank_ids(cfg)

# Simulate a laundering ring attack
p = RingParams(
    topology="fanout_chain", n_hops=4, n_mules=8, total_amount=2_500_000,
    time_gap_s=(120, 1800), cross_bank_prob=0.7,
    mule_age_days=(3, 30), pass_through_frac=0.92,
    seed=999, banks=tuple(banks),
)
ring = generate_ring(p, pd.Timestamp("2024-04-15"))
tx_df = ring.transactions
print(f"Attack ring: {len(tx_df)} transactions, {ring.params.get('total_amount', 0):.0f} INR")

# Run detection
result = detect_attack(tx_df, cfg)
print(f"Detection rate: {result['detection_rate']:.1%}")
print(f"Block rate: {result['block_rate']:.1%}")
print(f"Flagged: {result['n_flagged']}/{result['n_transactions']}")
print(f"Chains found: {result['n_chains']}")
print("\nPer-transaction results:")
for tx in result["transactions"][:8]:
    print(f"  {tx['tx_id']}: score={tx['score']:.3f} band={tx['band']}")

# Save full result
with open("artifacts/attack_simulation.json", "w") as f:
    json.dump(result, f, indent=2, default=str)
print("\nFull result saved to artifacts/attack_simulation.json")
