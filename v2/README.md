# HedgeLab v2 CTRM

Commodity Trading & Risk Management platform built on a kernel + plugin architecture. Supports multi-commodity, multi-org hedging, budgeting, risk analysis, and forecasting.

## Tech Stack

- **Next.js 16** (full-stack — UI + API routes)
- **React 19** with Zustand for state management
- **PostgreSQL 16** for persistence
- **Tailwind CSS 4** with a dark trading theme
- **Recharts** for charts and data visualization

## Getting Started

1. Start the database:
   ```bash
   docker compose up -d postgres
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment — create `.env.local`:
   ```
   DATABASE_URL=postgresql://hedgelab:hedgelab@localhost:5432/hedgelab_v2
   JWT_SECRET=your-secret-here
   ```

4. Run the dev server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).
