# AGENTS.md

Quran KPI — a personal Angular 21 single-page web app for tracking Quran reading, daily adhkar (awrad), and khatma progress, with offline-first IndexedDB storage and an optional Firebase mirror for cloud sync.

## Setup commands

- Install deps: `npm install` (`.npmrc` sets `legacy-peer-deps` for npm 10.2 arborist)
- Start dev:    `npm start` (http://localhost:4200 — add `?demo` for sample data, dev only, in-memory)
- Build:        `npm run build` (production by default; outputs to `dist/quran-kpi/`)
- Test:         `npx ng test --watch=false` (Vitest via `@angular/build:unit-test`)
- Screenshots:  `bash scripts/screens.sh` (with dev server running; writes PNGs to `screens/`)

## Project layout

- `src/app/core/` — framework-agnostic domain logic
  - `quran/` — Quran meta + per-page text loader
  - `reading/` — reading store (IndexedDB) + KPI maths
  - `timing/` — visibility, idle-credit, session timing engine
  - `awrad/` — awrad store + smart tasbeeh logic
  - `calendar/` — calendar aggregation helpers
  - `db/` — IndexedDB schema (via `idb`)
  - `sync/` — Firebase cloud sync (lazy-loaded)
  - `dev/` — dev-only helpers (e.g. `?demo` data)
  - `format.ts` — Arabic-aware number, date, and `counted()` noun helpers
- `src/app/features/` — routed feature screens
  - `home/` — khatma counter, remaining countdown, continue button, surah insight
  - `quran/` — 604-page horizontal pager with virtualisation, KPI bar, jump sheet
  - `awrad/` — smart tasbeeh (33/33/34), morning/evening adhkar, groups
  - `stats/` — KPI tiles, khatma comparison, virtualised 604-row table
  - `calendar/` — month heatmap, week bars, 24h dial
  - `groups/` — saved ayah/group management
  - `soon/` — placeholder routes for upcoming phases
- `src/app/ui/` — shared UI primitives (icon, sheet, ui-state)
- `src/app/core/awrad/` — morning/evening adhkar data
- `src/environments/` — Firebase config (env-specific)
- `design/` — design canvas (`.dc.html`) and reference PNGs
- `docs/DECISIONS.md` — product/technical decision log (source of truth)
- `HANDOFF.md` — project handoff notes, read first when joining
- `scripts/screens.sh` — local screenshot harness
- `firebase.json`, `firestore.rules`, `.firebaserc` — Firebase project `quraan-8ae72`

## Code style

- TypeScript strict (`strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`) — see `tsconfig.json`
- Angular strict templates + strict injection parameters — see `tsconfig.json` `angularCompilerOptions`
- Prettier: single quotes, `printWidth: 100`, `*.html` uses the `angular` parser — see `package.json`
- EditorConfig: 2-space indent, UTF-8, LF or CRLF accepted, trim trailing whitespace — see `.editorconfig`
- No ESLint config in repo — rely on `tsc` + Angular compiler + Prettier

## Testing instructions

- Unit tests run via Vitest (jsdom environment) through Angular CLI's `@angular/build:unit-test` builder
- One-shot mode for CI: `npx ng test --watch=false`
- Tests live next to source as `*.spec.ts` in `src/app/`
- All unit tests must pass before opening a PR

## App-specific conventions (read carefully)

- Angular **zoneless**, signals-first; prefer `signal()`, `computed()`, `effect()` over RxJS for view state
- SCSS only, RTL layout, light/dark design tokens
- Arabic typography rules (enforced by `core/format.ts`):
  - Arabic comma `،` instead of `·` next to Arabic digits
  - "أسرع ٪" / "أبطأ ٪" words instead of arrows for deltas
  - Timers always in `dir="ltr"`
  - Use `counted()` from `core/format.ts` for counted nouns (e.g. صفحة / صفحات)
- Reading engine invariants:
  - 3-minute idle threshold, 90-second credit on idle return
  - 10-second minimum session length before it counts
- Do not upgrade Node (20.19) or Angular (21) unless truly necessary
- Do not commit or push unless explicitly asked

## PR & commit conventions

- Git is initialised but no commits exist yet — first commit bootstraps the repo
- Default branch: `main`
- Conventional commits preferred (`feat:`, `fix:`, `docs:`, `refactor:`)
- Product/technical decisions: record in `docs/DECISIONS.md`, surface only product choices to the user

## Security

- Anonymous Firebase auth (`auth/anonymous`) — Firebase config in `src/environments/`
- `firestore.rules` restricts reads/writes — deploy before going live
- Web API key should be restricted to the app's domains in Google Cloud console
- Never commit `.env` or service-account JSON — `.gitignore` covers standard patterns
