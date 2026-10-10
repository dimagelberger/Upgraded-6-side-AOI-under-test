# Upgraded 6-side AOI - under test

Interactive dashboard for parsing, analyzing, and reconciling Automated Optical Inspection (AOI) machine logs, featuring:
- **QC Reconciliation Engine**: Multi-run analysis with automated classification into Active (Run 1) vs Problematic (Run 2+ / rejected) sessions.
- **Defect Matrix & Pareto Analytics**: Comprehensive defect frequency distribution, PPM indicators, and defect matrix by Lot and AOI machine side.
- **Top Defects with Lot Search**: Deep dive into the most frequent defect categories with instant lot-level filtering.
- **Chronological Sorting & Multi-Select Filters**: Seamless filtering across models, months (chronologically ordered), ISO calendar weeks, and run dates.
- **High-Performance Ingestion**: Ingests thousands of AOI inspection logs with batch-processing and duplicate prevention.

## Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- npm or bun

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```
