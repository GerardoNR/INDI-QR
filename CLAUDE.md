# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"INDI QR" (Control de materiales) — a Spanish-language installable PWA for scanning QR/barcodes on materials and recording them in Supabase. UI copy, comments-worthy strings, and README are in Spanish; keep new user-facing text consistent with that.

## Commands

```bash
npm run dev              # Vite dev server
npm run dev -- --host    # expose on LAN (needed to test camera scanning from a phone)
npm run build             # tsc -b (typecheck) then vite build
npm run lint               # oxlint
npm run preview            # preview production build
```

There is no test suite configured in this repo.

Local setup requires a `.env` (copied from `.env.example`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from a Supabase project where `supabase/schema.sql` has been run. Without these, `App.tsx` renders a "Falta configurar Supabase" screen instead of the app (see `isSupabaseConfigured` in `src/lib/supabase.ts`).

## Architecture

Single-page React Router app, no state management library — Supabase is the source of truth and components fetch/mutate it directly.

- **Auth**: `AuthContext` (`src/context/AuthContext.tsx`) wraps the app and tracks the Supabase `Session` via `supabase.auth.getSession()` + `onAuthStateChange`. `ProtectedRoute` redirects to `/login` when there's no session. Any authenticated user can read/write all records — there's no per-user ownership, just a shared team dataset (see RLS policies below).
- **Core flow is code-centric, not record-centric**: the scanner (`src/pages/Scanner.tsx`, using `@zxing/browser`) never looks up data itself — it just navigates to `/material/:codigo` with the raw decoded string (or a manually typed one). `MaterialForm` (`src/pages/MaterialForm.tsx`) does the lookup by `codigo` and decides whether to show a blank form (new material) or a pre-filled one (existing material, keyed by the unique `codigo` column). Saving always `upsert`s on `codigo` — there's no separate create/update code path.
- **`codigo` is the natural key**, not `id`. Routes, lookups, and upserts all key off `codigo` (URL-encoded), while `id` (uuid) is only used for row-level delete in `Listado`.
- **Listado** (`src/pages/Listado.tsx`) is a plain client-side list: fetches everything ordered by `created_at`, filters in-memory across code/name/category/location/registered-by, and hands the filtered array to `exportPDF`/`exportExcel` in `src/utils/export.ts`.
- **Data model**: `src/types.ts` defines `Material`/`MaterialInput` matching the `materiales` table in `supabase/schema.sql` 1:1 (`codigo`, `nombre`, `cantidad`, `unidad`, `ubicacion`, `categoria`, `notas`, `registrado_por`, timestamps). Schema changes should be made by editing `supabase/schema.sql` and re-running it against the Supabase project (there's no migration tooling) — keep `types.ts` in sync by hand.
- **Auth/authorization model lives in SQL, not app code**: `supabase/schema.sql` enables RLS with one policy per operation, all gated on `auth.role() = 'authenticated'` — any signed-in user can read/write/delete any row. If access control ever needs to be tightened (e.g., per-user ownership), that's a schema/policy change, not a frontend change.
- PWA config (manifest, icons, service worker caching) lives in `vite.config.ts` via `vite-plugin-pwa`; static icons are in `public/`. The dev server also enables HTTPS (`@vitejs/plugin-basic-ssl`, `serve` command only) because phone cameras require a secure origin.
- **`supabase/functions/lookup-producto`** is the app's only backend code (a Deno Supabase Edge Function, not part of the Vite build). `MaterialForm` calls it via `src/utils/lookupProducto.ts` (`supabase.functions.invoke`) when a scanned code isn't in `materiales`, to auto-fill `nombre` from UPCitemdb's public barcode database — server-side only because UPCitemdb's CORS policy blocks direct browser calls. It's deployed separately with the Supabase CLI (`supabase functions deploy lookup-producto --no-verify-jwt`); the frontend degrades gracefully (blank `nombre`, no crash) if it isn't deployed.
