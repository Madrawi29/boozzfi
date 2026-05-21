# B00ZZ FI Dashboard

Next.js prototype for the B00ZZ FI Arc Testnet dashboard, wired from `B00ZZ-FI-Arc-Testnet-Integration-Supplement.md`.

## What Is Implemented

- Arc Testnet config with chain ID `5042002`, RPC, explorer, faucet, and wallet add-network metadata.
- Viem public-client helpers for Arc reads, balances, receipts, and transaction explorer URLs.
- App Kit readiness and feature enablement planning for send, bridge, swap, cross-chain swap, unified balance, token deployment, LP, staking, vault, creator dashboard, and activity.
- Server-only Circle managed wallet boundary that reports readiness without exposing secret values.
- Unified balance status model for wallet USDC, Gateway balance, LP balance, and vault shares.
- Drizzle SQLite source of truth for dashboard data and transaction activity.
- Optional Supabase server-side storage for activity and Xendit/Circle payment records, with SQLite fallback.
- Add LP / Vault page for USDC-EURC, USDC-cirBTC, EURC-cirBTC, USDC-BOOZZ, and EURC-BOOZZ pairs.
- LP-compatible BOOZZ token contract and BoozzLiquidityVault testnet contract artifacts.

## VS Code Setup

Open the workspace file:

```powershell
code "C:\Users\abdul rohman\Documents\Codex\2026-04-28\buatkan-aku-prd-project-requirement-document\workspace.code-workspace"
```

Recommended Node version for the Arc App Kit quickstart is Node.js 22+. This project currently checks and builds on Node.js 20.20.1 too.

Run these from VS Code with `Terminal > Run Task`:

- `B00ZZ FI: install dependencies`
- `B00ZZ FI: seed database`
- `B00ZZ FI: check`
- `B00ZZ FI: build`
- `B00ZZ FI: dev server`

## Local Setup

Create `.env.local` manually on your machine. Environment files are intentionally ignored by Git and must not be committed.

Keep secrets server-side only. Do not put Circle API keys, entity secrets, service-role keys, recovery files, or private keys in frontend code.

Minimum local variables for the prototype:

```text
DATABASE_URL=file:./data/b00zz-fi.sqlite
SUPABASE_URL=
SUPABASE_SECRET_KEY=
BETTER_AUTH_SECRET=replace-this-with-a-long-random-secret
BETTER_AUTH_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_NAME=B00ZZ FI
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_TESTNET_EXPLORER_URL=https://testnet.arcscan.app
NEXT_PUBLIC_ARC_TESTNET_FAUCET_URL=https://faucet.circle.com
```

Server-only Circle variables stay blank until you have real Circle testnet credentials:

```text
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_WEB3_API_KEY=
CIRCLE_TREASURY_WALLET_ID=
CIRCLE_TREASURY_WALLET_ADDRESS=
KIT_KEY=
REDIS_URL=
```

Install, seed, and run:

```powershell
npm install
npm run db:seed
npm run check
npm run dev
```

Open the app at `http://127.0.0.1:3000`.

## Real Integration Boundaries

Frontend-safe modules live under `src/lib/arc`. They can expose chain metadata, public RPC reads, and wallet-request data.

Server-only modules live under `src/server`. Circle managed wallet and Gateway workflows must stay behind API routes and must never return secret values to the browser.

Activity and workflow records should be written for every user-facing transaction so bridge and cross-chain swap steps can preserve partial progress and explorer URLs.

For Supabase setup, run `supabase/migrations/20260522000000_boozzfi_core.sql` in Supabase SQL Editor, then add `SUPABASE_URL` and a server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to local/Vercel env. See `docs/SUPABASE_INTEGRATION.md`.

## BOOZZ Token and LP Tutorial

See `docs/BOOZZ_DEPLOY_AND_LP.md` for the full deploy flow: deploy BOOZZ, deploy the LP vault, add LP, and deposit LP shares into the vault.
