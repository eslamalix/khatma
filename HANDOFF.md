# Handoff — Quran KPIs app (تطبيق KPIs للقرآن)

Read this fully before working. Last updated: 2026-09-14.
Decisions and their reasons: **`docs/DECISIONS.md`** (the source of truth). Approved design: `design/` + [canvas](https://claude.ai/code/artifact/51ef97bf-a414-4098-b2df-1af30ef90f0b).

## 1. Working with the user
- Sole owner, product owner and developer. Writes Arabic (Egyptian/Gulf mix) — reply in Arabic.
- **Technical decisions are delegated to the agent**: decide, record in `docs/DECISIONS.md`, tell them. Bring only product choices, with a recommendation. Top priority: **easy, smooth, enjoyable UX**, Apple-like calm design.
- Do not upgrade Node (20.19) or Angular (21) unless truly necessary.
- Do not commit/push unless asked (git is initialised, nothing committed yet).

## 2. State: Phase 1 built (not yet deployed)
| Area | Status |
|---|---|
| Angular 21 app, zoneless, signals, SCSS, RTL, light/dark tokens | done |
| Shell: phone tab bar / tablet icon sidebar / desktop sidebar, view transitions | done |
| Home: background khatma counter (count-up), remaining countdown, continue button, surah insight + daily-minutes calculator | done |
| Quran reader: 604-page horizontal pager (scroll-snap, virtualised ±2), KPI bar, page·surah·juz pill + jump sheet, desktop side arrows, keyboard arrows, tap-centre immersive mode, pinch / Ctrl+wheel / sheet font size | done |
| Timing engine (visibility, 3-min idle with 90 s credit, 10 s minimum) + reading store (IndexedDB) | done, unit-tested |
| Stats: tiles, improvement vs previous khatma, 604-row virtual table with surah/juz filter, new-khatma sheet | done |
| Firebase: lazy-loaded, anonymous auth, readings + `status/public` mirrored to Firestore; `firestore.rules`, `firebase.json`, `.firebaserc` | code done — **console setup pending (see §4)** |
| PWA (service worker in production builds, Arabic manifest) | done, default Angular icons |
| Awrad, Calendar | "قريباً" placeholders — phase 2 |

## 3. Run / test
```bash
npm install            # .npmrc sets legacy-peer-deps (npm 10.2 arborist bug)
npm start              # http://localhost:4200 — add ?demo for sample data (dev only, memory only)
npx ng test --watch=false
npx ng build
bash scripts/screens.sh   # with the dev server running: PNGs of phone/desktop screens into screens/
```
Code map: `src/app/core` (quran meta + page loading, timing engine, reading store + KPI maths, cloud sync, format), `src/app/features` (home, quran, stats, soon), `src/app/ui` (icon, sheet, ui-state).

Rules kept from design review: Arabic comma instead of `·` next to Arabic digits; "أسرع/أبطأ ٪" words instead of arrows; timers in `dir="ltr"`; counted nouns via `counted()` in `core/format.ts`.

## 4. Pending on the user (Firebase console, project `quraan-8ae72`)
1. Authentication → Sign-in method → enable **Anonymous** (currently returns `auth/configuration-not-found`; the app stays device-only until then).
2. Firestore Database → create (production mode), then deploy rules: `npx firebase-tools deploy --only firestore:rules`.
3. Optional hosting: `npx ng build && npx firebase-tools deploy --only hosting`.
4. Restrict the web API key to the app's domains in Google Cloud console.
Also open: app name + icon, adhkar text review (phase 2), licence check for the Quran data source before launch.

## 5. Next
Phase 2 (`docs/DECISIONS.md` §3): calendar (month heatmap / week bars / day clock), ayah & partial-ayah selection → groups, awrad with tasbeeh, reading settings (backgrounds, reading mode). Then phase 3: Google/email sign-in with account linking, family sharing, Capacitor.
