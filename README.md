# SATARK — Privacy-Preserving Cross-Bank AML System

A production-grade, privacy-preserving anti-money laundering detection system that operates across multiple banks without exposing customer data.

## Architecture

```
frontend/          → Next.js dashboard (Investigator + Bank dashboards)
backend/           → FastAPI server (Coordinator, Simulator, API)
edge-node/         → Per-bank edge processing (Memgraph, tokenization, scoring)
shared/            → Shared types, schemas, API contracts
ml/                → GraphSAGE training pipeline (PyTorch Geometric)
```

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Edge nodes (one per bank)
cd edge-node && python run.py --bank axis
cd edge-node && python run.py --bank icici
cd edge-node && python run.py --bank hdfc
```

## Banks
- **Axis Bank** — Burgundy/Maroon theme
- **ICICI Bank** — Orange theme
- **HDFC Bank** — Blue/Red theme
