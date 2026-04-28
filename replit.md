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
- **api-server**: Express 5 API. Hosts the Clerk proxy at `CLERK_PROXY_PATH` (mounted before body parsers) and `clerkMiddleware()` for verifying sessions.

## Authentication

Replit-managed Clerk (whitelabel) — env vars `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL`.

- **Frontend** (`horizon-markets/src/App.tsx`): `ClerkProvider` with `dark` base theme + custom appearance (neon green primary, dark surfaces, custom HedgeGate logo). Routes: `/sign-in/*?`, `/sign-up/*?`, `/dashboard`. `HomeRedirect` sends signed-in users from `/` to `/dashboard`. `DashboardGuard` enforces auth on `/dashboard`. Wouter `<Router base={basePath}>` + a `routerPush`/`routerReplace` that strips basePath for Clerk navigation.
- **Tailwind/Clerk**: `@layer theme, base, clerk, components, utilities;` declared in `src/index.css` before `@import "tailwindcss"`, plus `@import "@clerk/themes/shadcn.css";`. `vite.config.ts` uses `tailwindcss({ optimize: false })` so Clerk's CSS layer survives.
- **Navbar** swaps Sign In / Create Free Account (signed-out) with Dashboard pill + user email + sign-out (signed-in) using `<Show when="signed-in/out">`.
- **Dashboard** (`src/pages/Dashboard.tsx`): Welcome header (uses `useUser`), portfolio summary cards, holdings list, quick actions, recent orders table — all mock data, themed to match the landing page.
