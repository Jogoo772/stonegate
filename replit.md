# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **horizon-markets** (`/`): Crypto trading landing page for "HedgeGate" (artifact directory still named `horizon-markets` for stability). React + Vite + Tailwind v4 + framer-motion + recharts. Dark theme with neon green (`#00FF88`) accents, Inter font. Sections: Navbar, Hero, Ticker, MarketOverview, Features, Stats, MobileApp, PriceTable, FinalCTA, Footer. Hero/phone/blockchain images generated via media-generation.
- **api-server**: Express 5 API. Hosts the Clerk proxy at `CLERK_PROXY_PATH` (mounted before body parsers) and `clerkMiddleware()` for verifying sessions. Mounts `/api/payments/*` (NOWPayments proxy: `POST /create`, `GET /:id/status`, `GET /health`) — uses `NOWPAYMENTS_API_KEY` secret, `NOWPAYMENTS_API_BASE` env override (defaults to `https://api.nowpayments.io/v1`). Supported pay currencies: `btc`, `eth`, `sol`, `usdttrc20`, `usdterc20`. Frontend `useTradingBot.createDeposit` posts to `/api/payments/create` and polls `/status` every 8s; on `confirmed`/`finished` it credits the local USD balance. Each generated payment address has a hard 2-hour expiry (`DEPOSIT_EXPIRY_MS` in `useTradingBot.ts`) — `createDeposit` stamps `expiresAt = createdAt + 2h`, a sweep effect ticks every 30s and flips any still-pending deposit past `expiresAt` to `FAILED`/`rawStatus:"expired"`, and the deposit dialog shows a live mm:ss countdown that turns rose-red in the final 10 minutes. Withdrawals remain local-only. Also mounts `/api/bot/*` (`POST /upload`, `GET /activated?userId=X`, `GET /health`) which validates the administrator-issued bot pass key (env var `BOT_UNLOCK_KEY`, currently `AT6768665G`) using constant-time comparison; the key never appears in the frontend bundle. Frontend `useTradingBot.unlockBot` calls `/api/bot/upload` with the Clerk `userId` and only sets `unlocked: true` on a `200 {ok:true}` response. Successful activations are persisted server-side in `data/bot-activations.json` via `lib/botActivationsStore.ts` (atomic writes); on every dashboard mount the hook calls `/api/bot/activated?userId=...` and auto-restores `unlocked: true` if the user has previously activated. This means each user enters their passkey once, ever, even after clearing localStorage or switching devices. Idempotent — re-uploading a valid key for an already-activated user is a no-op.

Mounts `/api/withdrawals/*` for admin-controlled withdrawals: `POST /` (user submits), `GET /?userId=...` (user polls own status), and admin-gated routes `POST /admin/auth`, `GET /admin`, `POST /admin/:id/approve`, `POST /admin/:id/reject` (header `x-admin-key`, env var `ADMIN_KEY`, currently `HG-ADMIN-AT6768665G-2026`, constant-time compare). Persistence is a JSON file at `artifacts/api-server/data/withdrawals.json` via `lib/withdrawalsStore.ts` (atomic writes via tmp+rename, serialised through a write chain). Withdrawal status: `PENDING | APPROVED | REJECTED`. The frontend hook deducts balance optimistically on submit; an 8s poll re-syncs server status, and rejected requests automatically refund the local balance. Bot `start()` is now also gated on `balance > 0`. Admin console lives at `/admin` (whitelabel page, no Clerk; key cached in sessionStorage for the tab).

## Authentication

Replit-managed Clerk (whitelabel) — env vars `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL`.

- **Frontend** (`horizon-markets/src/App.tsx`): `ClerkProvider` with `dark` base theme + custom appearance (neon green primary, dark surfaces, custom HedgeGate logo). Routes: `/sign-in/*?`, `/sign-up/*?`, `/dashboard`. `HomeRedirect` sends signed-in users from `/` to `/dashboard`. `DashboardGuard` enforces auth on `/dashboard`. Wouter `<Router base={basePath}>` + a `routerPush`/`routerReplace` that strips basePath for Clerk navigation.
- **Tailwind/Clerk**: `@layer theme, base, clerk, components, utilities;` declared in `src/index.css` before `@import "tailwindcss"`, plus `@import "@clerk/themes/shadcn.css";`. `vite.config.ts` uses `tailwindcss({ optimize: false })` so Clerk's CSS layer survives.
- **Navbar** swaps Sign In / Create Free Account (signed-out) with Dashboard pill + user email + sign-out (signed-in) using `<Show when="signed-in/out">`.
- **Dashboard** (`src/pages/Dashboard.tsx`): Welcome header (uses `useUser`), portfolio summary cards, holdings list, quick actions, recent orders table — all mock data, themed to match the landing page.
