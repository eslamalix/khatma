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
| Quran reader: 604-page horizontal pager (scroll-snap, virtualised ±2), KPI bar, page·surah·juz pill + jump sheet, desktop side arrows, keyboard arrows, pinch / Ctrl+wheel / sheet font size | done |
| Timing engine (visibility, 3-min idle with 90 s credit, 10 s minimum) + reading store (IndexedDB) | done, unit-tested |
| Stats: tiles, improvement vs previous khatma, 604-row virtual table with surah/juz filter, new-khatma sheet | done |
| Firebase: lazy-loaded, anonymous auth, readings + `status/public` mirrored to Firestore; `firestore.rules`, `firebase.json`, `.firebaserc` | code done — **console setup pending (see §4)** |
| Google sign-in + account safety: anonymous account linked on sign-in; a **different** permanent account on the same device freezes all sync and asks before taking the device over; every reading carries the uid it was written to (`syncedTo`) so nothing recorded while signed out is stranded; sign-out flushes everything up then goes local-only instead of opening a throwaway anonymous account (`docs/DECISIONS.md` §2) | done, unit-tested (`account-guard.spec.ts`) |
| Calendar | month heatmap, week bars, 24h dial clock, sessions grouping, responsive 2-column desktop | done, unit-tested |
| Awrad | smart tasbeeh with haptics/spacebar/auto-advance (33/33/34), groups sheets (Tahseen, Ruqyah), morning/evening adhkar (Fajr-based day cycle, preserves evening adhkar across midnight), reactive period transitions | done, unit-tested |
| Reading settings & Multiple ayah selection | unified settings sheet (cream/white/dark/auto themes, horizontal/vertical mode, font scale), zero-overlap continuous translucent highlight via linear-gradient transparent vertical bands (7px) & 2.35 line-height, bottom floating action bar with `+` / `-` range stepper, copy with feedback, save to groups with repeat selector 1/3/7 and new group creation, synced with Awrad via `AwradStore`, bottom nav gracefully tucks away while selecting | done, unit-tested |
| Recitation player (T20) + tafsir cache (T21) | floating mini player above page nav → expandable sheet (reciter, repeat per ayah, loop range, speed); continuous ayah→surah→page playback with basmala, auto page turn + scroll to playing ayah, Media Session lock-screen controls, retry on network error; header headphones button plays the visible page | done, unit-tested (`quran-audio.spec.ts`) |

## 3. Run / test
```bash
npm install            # .npmrc sets legacy-peer-deps (npm 10.2 arborist bug)
npm start              # http://localhost:4200 — add ?demo for sample data (dev only, memory only)
npx ng test --watch=false
npx ng build
bash scripts/screens.sh   # with the dev server running: PNGs of phone/desktop screens into screens/
```
Code map: `src/app/core` (quran meta + page loading, timing engine, reading store + KPI maths, awrad store, cloud sync, format), `src/app/features` (home, quran, awrad, stats, calendar), `src/app/ui` (icon, sheet, ui-state).

Rules kept from design review: Arabic comma instead of `·` next to Arabic digits; "أسرع/أبطأ ٪" words instead of arrows; timers in `dir="ltr"`; counted nouns via `counted()` in `core/format.ts`.

## 4. Firebase (project `quraan-8ae72`) — live since 2026-09-15
Done from the CLI (`npm i -g firebase-tools`, `firebase login` as the owner account):
- Auth providers from `firebase.json` → `auth.providers` (anonymous + Google, `firebase deploy --only auth`). Authorized domains: firebaseapp, web.app, `eslamalix.github.io`, `localhost` (added with firebase-tools `gcp/auth` `updateAuthDomains`; add any new domain the same way).
- Stay on the free Spark plan (owner requirement): no Cloud Functions or other Blaze features.
- Firestore `(default)` database, Standard edition, location **eur3** (recreated there on 2026-09-15; `firestore:databases:create` must run before the first rules deploy or the deploy creates it in nam5).
- Synced per user: `readings/*`, `profile/state`, `status/public`, and device documents `profile/groups`, `profile/adhkar`, `profile/audio` (CloudSync.registerDoc; newest `updatedAt` wins on a new account).
- `firestore.rules` deployed; verified: a user can write `users/{own uid}/…`, another uid is rejected (403).
- Verified on https://eslamalix.github.io/khatma/: anonymous sign-in and `users/{uid}/status/public` written.

Redeploy config: `firebase deploy --only auth,firestore:rules --project quraan-8ae72`.
**`firestore.rules` was tightened and is not deployed yet** — it now allows only the paths and field shapes the app writes (`readings` with its six fields, `profile/{state|groups|adhkar|audio}`, `status/public`), because anyone can open an anonymous account and an unconstrained subtree is a free way to burn the shared Spark quota. Deploy it with the command above and the rules simulator in the console will confirm the app's writes still pass.
Web app hosting is GitHub Pages from the `gh-pages` branch: `MSYS_NO_PATHCONV=1 npx ng build --base-href /khatma/`, copy `dist/quran-kpi/browser` to `gh-pages` with `404.html` (copy of index) and `.nojekyll`.

Still open for the owner: restrict the web API key to `eslamalix.github.io` in Google Cloud console; app name + icon; adhkar text review; licence check for the Quran data source before launch.

## 5. Next
Phase 3 (`docs/DECISIONS.md` §3):
- **تسجيل الدخول:** Google تم (ربط الحساب المؤقت Anonymous بحساب دائم + حماية الجهاز المشترك). الباقي: الدخول بالإيميل، وتدفق redirect بدل popup قبل تغليف Capacitor، وحذف الحساب وتصدير البيانات (شرط متاجر التطبيقات).
- **مشاركة الأهل (Family sharing):** دعوات الرموز ومتابعة ختمات أفراد العائلة المشتركة في بطاقة مخصصة.
- **تطبيق الجوال بـ Capacitor:** تغليف التطبيق كـ native app للـ iOS والـ Android مع إشعارات الأوراد.
