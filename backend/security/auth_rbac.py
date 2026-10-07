"""SATARK Role-Based Access Control (RBAC) & Node Attestation Engine.

Implements:
1. Role-Based Access Control for Multi-Stakeholder Banking Environment:
   - Bank Analyst (Tier 1 & 2 Investigation)
   - Compliance Officer (SAR Authorizer & Freeze Broadcaster)
   - Independent Auditor (Merkle Proof Verifier)
   - FIU-IND / RBI Regulator (Regulatory Oversight)
2. HMAC-SHA256 Inter-Node Message Signing & Verification (Node Attestation).
"""
from __future__ import annotations

import hmac
import hashlib
import json
import secrets
import time
from typing import Any, Dict, List, Optional


ROLES = {
    "ANALYST": {
        "title": "AML Intelligence Analyst",
        "description": "Explores live 3D graph topologies, simulates attack scenarios, and correlates mule hops.",
        "permissions": ["graph:read", "attack:simulate", "alerts:view"],
    },
    "COMPLIANCE_OFFICER": {
        "title": "Principal Compliance Officer",
        "description": "Authorized to approve SAR filings, freeze suspicious cross-bank accounts, and quarantine rings.",
        "permissions": ["graph:read", "attack:simulate", "alerts:view", "action:freeze", "sar:file"],
    },
    "AUDITOR": {
        "title": "Independent Cryptographic Auditor",
        "description": "Verifies SHA-256 Merkle proofs, checks ledger immutability, and executes tamper detection tests.",
        "permissions": ["audit:verify", "audit:inspect", "merkle:proof", "tamper:test"],
    },
    "REGULATOR": {
        "title": "FIU-IND Regulatory Supervisor",
        "description": "Direct read access to anchored immutable compliance records and regulatory disclosures.",
        "permissions": ["regulator:read", "sar:view_all", "audit:inspect"],
    },
}

# Node authentication credentials (shared institutional keys for edge node signing)
NODE_CREDENTIALS = {
    "axis": {"key": "satark_axis_secret_key_8f29c1d0", "label": "Axis Bank Edge Enclave"},
    "icici": {"key": "satark_icici_secret_key_3a7b5e82", "label": "ICICI Bank Edge Enclave"},
    "hdfc": {"key": "satark_hdfc_secret_key_6c4d9a11", "label": "HDFC Bank Edge Enclave"},
    "coordinator": {"key": "satark_central_hub_coordinator_secret", "label": "Central Hub Coordinator"},
}


class NodeAttestationManager:
    """Signs and verifies inter-bank payload messages using HMAC-SHA256."""

    @staticmethod
    def sign_payload(node_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        cred = NODE_CREDENTIALS.get(node_id.lower())
        if not cred:
            raise ValueError(f"Unknown node identifier: {node_id}")

        canonical_data = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        timestamp = time.time()
        msg_to_sign = f"{node_id}:{timestamp}:{canonical_data}".encode("utf-8")
        signature = hmac.new(cred["key"].encode("utf-8"), msg_to_sign, hashlib.sha256).hexdigest()

        return {
            "node_id": node_id,
            "node_label": cred["label"],
            "timestamp": timestamp,
            "signature": signature,
            "digest": hashlib.sha256(canonical_data.encode()).hexdigest(),
        }

    @staticmethod
    def verify_signature(
        node_id: str,
        payload: Dict[str, Any],
        timestamp: float,
        signature: str,
    ) -> Dict[str, Any]:
        cred = NODE_CREDENTIALS.get(node_id.lower())
        if not cred:
            return {"valid": False, "error": f"Unknown node: {node_id}"}

        # Check timestamp freshness (within 5 minutes)
        if abs(time.time() - timestamp) > 300:
            return {"valid": False, "error": "Replay attack detected: Timestamp outside 5-minute window"}

        canonical_data = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        msg_to_sign = f"{node_id}:{timestamp}:{canonical_data}".encode("utf-8")
        expected_sig = hmac.new(cred["key"].encode("utf-8"), msg_to_sign, hashlib.sha256).hexdigest()

        is_valid = hmac.compare_digest(signature, expected_sig)
        return {
            "valid": is_valid,
            "node_id": node_id,
            "verified_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "message": "Node cryptographic attestation verified successfully." if is_valid else "Signature mismatch! Untrusted sender.",
        }


global_attestation_manager = NodeAttestationManager()
