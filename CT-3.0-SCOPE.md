# Conversion Tracking 3.0: scoped plan

Command center draft, 2026-10-22. Supersedes `REVAMP-PLAN.md` (Claude Code's incremental draft, kept as technical input) and narrows `CT-3.0-PLAN.md` (the full strategy doc, still the source for positioning, Free vs Pro and decisions).

**One sentence:** every platform merchants already use, counted once, consent-aware, no customer data in the page, set up through a UI a shop owner can follow.

**Cut line (decided 2026-10-22, revised the same day):** server-side sending, TikTok, licence check and test-purchase-with-platform-confirmation move to 3.1+. 3.0 ships `event_id` on every Meta event so server-side slots in later without touching the browser side. Tracking Doctor, activity log, missed-sale alerts and the weekly email are **in**, redefined for browser-only tracking (Phase 3b).

**How the four added features work without server-side sending**

| Feature | 3.0 definition | Why it still works |
|---|---|---|
| Activity log | The storefront reports every fired event back to the plugin (name, platform, order number, amount, time; no customer data). Free 24 h, Pro 30 days (up to 90), filters, export | Browser events are observable from our own script. Replaces the "Recent events panel" |
| Missed-sale alerts | A WooCommerce order exists but no Purchase was reported for a connected platform within 10 minutes. Free: dashboard badge. Pro: email, plus a daily digest option | This is the merchant pain ("sales go missing") and the upgrade moment the strategy doc wanted. Replaces "failure alerts", which needed API tokens |
| Weekly email (Pro) | "142 purchases tracked, 3 missed on Meta, everything else healthy", links to the dashboard | A summary of the log |
| Tracking Doctor | Other-plugin detection (Meta for WooCommerce, Google for WooCommerce, Site Kit, GTM4WP, PixelYourSite, Pixel Manager, Conversios), duplicate pixel IDs in page source, ID format checks, consent plugin missing, cache plugin notes. On request, never a gate | None of these need an API |

## Scope at a glance

| In 3.0 | Out (3.1+) |
|---|---|
| New admin UI in the Texty 2.0 stack (React + TypeScript, `@wedevs/plugin-ui`, Tailwind v4) | Server-side sending, all platforms |
| Count once: Purchase once per order per platform, failed orders skipped, Meta `event_id` | TikTok, Pinterest |
| Block checkout parity for Meta and Bing | Test purchase with platform confirmation |
| Consent: Consent Mode v2 (Google) + WP Consent API gate (Meta, X, Bing) | Match quality, health and wellness, licence check, OAuth connect |
| Privacy: no cleartext PII in HTML, ownership check, catalog export auth, gated placeholders | Telemetry (decide separately) |
| Fix ViewCategory, Google Complete Registration and Meta Add to wishlist (Pro); modern X events | Retry queue (needs server sends) |
| Replace `wc_enqueue_js`, sanitise settings, escape output | |
| Activity log, missed-sale alerts, weekly email, Tracking Doctor (Phase 3b) | |
| In-place, non-destructive migration; old Pro detected | |
| Characterisation tests first, unit tests for value maths and dedup | |

Platforms in 3.0: Meta, Google (GA4 + Ads), X, Microsoft (Pro), Custom scripts. Same five as today.

## Phases (each task is one PR on `feature/ct-revamp`)

Estimates are mine, for planning only: about 16 weeks solo, 18 with buffer. Long poles are the UI, the Doctor's detection matrix and the migration tests.

**Workflow (decided 2026-10-22):** 1) planning and UI first (this doc, `UI-RESEARCH.md`, then the mockup), 2) one GitHub issue per task ID below, in the correct repo, 3) build on `feature/ct-revamp`, 4) at the end of each milestone (one phase = one milestone) push the branch, so progress is visible and the work can be handed to a developer at any point. Each GitHub issue carries the acceptance check from this table so a handover needs no extra briefing.

### Phase 0. Foundations (about 2 weeks)

| ID | Task | Repo | Acceptance |
|---|---|---|---|
| 0.1 | Characterisation tests: turn `baseline/html/` into PHPUnit fixtures that assert today's head and footer output per page type and integration. First PHPUnit harness in Pro | Lite, Pro | Tests pass on the unmodified base branches; any later change that alters output fails a test on purpose |
| 0.2 | Event pipeline core: one `WCCT_Event` value object (name, order or product data, `event_id`, value, tax, shipping, currency), per-order per-platform sent flags, skipped-status list, output through `wp_add_inline_script` and `wp_footer` (no `wc_enqueue_js`). Integration keys, hooks and option names unchanged | Lite | `wc_enqueue_js` notices: 63 → 0. Characterisation tests updated only where output is intentionally identical |
| 0.3 | Consent layer: build `CONSENT-MODE-PLAN.md` as written (Google), plus a `wcct_consent_allows( $category )` helper backed by the WP Consent API that every integration calls before printing. No region guessing for non-Google pixels: they fire unless a consent plugin says no | Lite | EEA visit shows `consent default` denied before any `config`; a CMP that sets its own default is detected and we stand down; consent-off page source is byte-identical to baseline |
| 0.4 | JS build setup in Lite copied from Texty 2.0: `@wordpress/scripts` + custom webpack with three entries (`index`, `components`, `plugin-ui`), TypeScript strict, Tailwind v4 scoped to `.wcct-app`, `@wedevs/plugin-ui` ThemeProvider with the tokens in `UI-RESEARCH.md`, dependency mapping so Pro consumes Lite's bundle; ESLint added; `dist/` built in release; `ct-sync.sh` ships `dist/`. Also fetch the platform logos listed in `UI-RESEARCH.md` §4 into `assets/images/platforms/` with `LOGO-SOURCES.md` | Lite | `npm run build` and `npm run typecheck` pass; synced site loads the bundle; plugin-ui reachable (stop and report if not) |

### Phase 1. Security and privacy (about 1 week, mostly Pro)

| ID | Task | Repo | Acceptance |
|---|---|---|---|
| 1.1 | Catalog export behind auth: finish the existing HTTP Basic path, same URL, row cap | Pro | `curl -I '/?action=wcct-product-export'` → 401; with credentials → 200 CSV |
| 1.2 | Ownership check wherever an order is loaded from the URL (Facebook init, facebook-pro line 259, Bing). Mirror WooCommerce's own rule: guest may see a guest order with the key; a registered customer's order needs that customer logged in | Pro | Order 1310 as guest with valid key: WooCommerce shows "please log in" and the plugin prints no PII |
| 1.3 | No cleartext PII in HTML: advanced matching sends SHA-256 of normalised email and phone only; logged-in every-page PII removed; custom placeholders render only after key, ownership and consent | Lite, Pro | PII fields on a logged-in page: 14 → 0. Order-received page: 0 cleartext fields |
| 1.4 | Hygiene: sanitise settings on save (both repos' AJAX handlers), escape `$field['help']`, tab HTML and Bing tag id, `defined()` guards in Pro, remove the hardcoded `<noscript>` pixel and Perfect Audience remnants, add `Text Domain` header, gate SweetAlert | Lite, Pro | phpcs clean on touched files; characterisation tests pass |

### Phase 2. Count once and parity (about 2 weeks)

| ID | Task | Repo | Acceptance |
|---|---|---|---|
| 2.1 | Purchase once per order per platform (own meta key per integration); failed and cancelled skipped (filterable). Applies to everyone on upgrade | Lite, Pro | Thank-you reload: 0 second Purchase on any platform. Failed order: 0 Purchase |
| 2.2 | Meta `event_id` on every event: `fbq(..., {eventID})` and the same `event_id` on the `wcfbq` beacon. Deterministic, order-derived for Purchase; per-event nonce for repeatable events | Lite, Pro | Network tab shows matching ids on `fbq` and `/tr/` for the same event |
| 2.3 | Initiate Checkout for Meta and Bing on block checkout (page-load `is_checkout()` like GA4) | Lite, Pro | Block checkout fires Meta, Bing and GA4 begin-checkout |
| 2.4 | `wcfbq` investigation: confirm it is an ad-blocker image fallback, then keep it as fallback only (fires when `fbq` is absent), with `event_id` and a current `v` | Lite, Pro | One Meta Purchase per pixel per order in the network tab, never two |
| 2.5 | Fix Pro Google `registration()`, Meta ViewCategory and Meta AddToWishlist (YITH WooCommerce Wishlist and WooCommerce Wishlists; kept as a Pro event, decided 2026-10-28); migrate X to `twq('event')` with legacy labels flagged "needs re-setup" | Pro | Each event verified live with a test ID |
| 2.6 | GA4: accept `GT-` ids, optional skip-admins filter, Meta `content_ids` as a real array | Lite | Verified live |

### Phase 3. New admin UI (about 4 weeks)

Stack and look: Texty 2.0 (`UI-RESEARCH.md` §1): plugin-ui components, Texty tokens, sticky TopBar, hash routes, master-detail Platforms page, DataViews log. Menu stays at WooCommerce > Conversion Tracking.

| ID | Task | Repo | Acceptance |
|---|---|---|---|
| 3.1 | Clickable HTML prototype of the 10 screens in `UI-RESEARCH.md` (`CT/prototype/`, no build step, Plan and Install state bar, Texty tokens as CSS variables). Design canvas artboards in `mockup-ref/` are the layout and copy reference. Prompt: `prompts/02-html-prototype.md` | none (new folder) | Opens from `index.html`; every state in the prompt table works; screenshots in `prototype/screenshots/`; Imtiaz approves |
| 3.2 | REST API `wcct/v1` (controllers extend a Base gated on `manage_options`, like Texty): `settings` + `settings/schema` (server-defined schema rendered by plugin-ui `FieldRenderer`), replacing the AJAX save. v1 `wcct_settings` kept read-only for migration | Lite, Pro | Save and load round-trip; Pro platforms register through `wcct_settings_schema` and save through the same API |
| 3.3 | Dashboard and Connect screens for Meta, Google, X, Microsoft (Pro), Custom. Defaults on after save. Simple view by default | Lite, Pro | A new install reaches "Working" on Meta in under 3 minutes with the help panel only |
| 3.4 | Advanced drawer: per-event toggles, value with or without tax and shipping, role exclusion, custom parameters, custom script placement, "For developers" panel with hook names and event ids | Lite, Pro | Each option verified live |
| 3.5 | Pro surfaces: multiple pixels with per-pixel events, catalog tab (same feed URL), role access rebuilt on a `manage_wcct` capability. Free shows in-context upgrade cards, no greyed tabs | Pro, Lite | Pro features work; Free never blocks |
| 3.6 | Trust and listing: X branding and icon, deactivation feedback skippable, readme rewritten (GA4 listed, Pro list corrected, repo link), docs tiles, one canonical upgrade link | Lite, Pro | wp.org guideline check passes |

### Phase 3b. Log, alerts, email, Doctor (about 4 weeks)

| ID | Task | Repo | Acceptance |
|---|---|---|---|
| 3b.1 | Event reporting: the storefront script posts each fired event (event, platform, order number, amount, timestamp, `event_id`; never customer data) to `wcct/v1/events`. Stored in `{prefix}wcct_events` (schema in `UI-RESEARCH.md` §1, with a `source` column = browser now, server in 3.1), model and migration helpers like Texty's, plus Action Scheduler pruning (Free 24 h, Pro 30 to 90 days). Deduplicated by `event_id` + platform + source | Lite | After a test order, the log shows one row per platform within seconds; no PII column exists; pruning verified |
| 3b.2 | Activity log screen: feed-style rows ("Order #1042 reached Meta, Google and X"), filter by platform, status and date, "Problems only" toggle, order detail drawer with per-platform timeline. Pro: search by order number, export CSV | Lite, Pro | Each example entry from `CT-3.0-PLAN.md` renders from real data |
| 3b.3 | Missed-sale detection: a scheduled check (Action Scheduler, every 10 min) compares paid orders against reported Purchases per connected platform; writes a "missed" row with the likely cause we can tell apart (consent denied, no page view at all, platform not configured) or "not sure" | Lite | A test order with the pixel blocked produces a missed row within 10 min; a normal order never does |
| 3b.4 | Alerts: dashboard badge and card note in Free ("3 purchases didn't reach Meta this week"); Pro adds email per incident (rate-limited to one per platform per day) and a daily digest option. Notification settings screen | Lite, Pro | Emails arrive with order numbers only; opt-out works |
| 3b.5 | Weekly health email (Pro): purchases tracked per platform, missed count, Doctor summary, link to the dashboard. Rendered with WooCommerce's email template | Pro | Preview in admin matches the sent email |
| 3b.6 | Tracking Doctor: on-request checks, each with "what we found", "why it matters", one action. Detectors: other tracking plugins active (list above), duplicate pixel IDs in the rendered storefront (fetch home, product, checkout as a guest and scan), ID format problems, consent plugin missing, known cache plugin with consent on. Results page leads with what is working; dismissible items; re-check offered after a plugin is activated. Never disables anything without confirmation | Lite | Each detector has a test store state that triggers it and one that does not |
| 3b.7 | Dashboard wiring: platform cards show Working / Needs attention / Not set up from the log and the Doctor; "what to do next" list | Lite | Card states verified for each combination |

### Phase 4. Migration and release (about 2 weeks)

| ID | Task | Repo | Acceptance |
|---|---|---|---|
| 4.1 | Settings migration: copy v1 `wcct_settings` to new keys, exact key reading (numeric indices, casing), v1 keys untouched for one release, revert restores a working setup. Perfect Audience ignored, feed credentials carried, legacy X labels flagged | Lite, Pro | Migration tests against real exported settings from at least 5 stores |
| 4.2 | Version guards: Free 3.0 detects Pro < 3.0, switches its tracking off safely, keeps the catalog feed serving, shows "Update Pro". Pro 3.0 with Free < 3.0 fails safely | Lite, Pro | Both mismatches tested on a staging copy |
| 4.3 | Upgrade matrix on Hostinger staging copies: Free only, Free + Pro, each platform, multiple pixels, custom scripts, classic and block checkout, 2 consent plugins | none | Matrix sheet all green |
| 4.4 | Opt-in beta (GitHub release zips to a few stores), then wp.org, WooCommerce.com and storepulse.co on the same day, hotfix window planned | none | Support tickets watched for 2 weeks |


## Built for expansion (3.1 and later)

Everything below is a 3.0 design rule, not 3.1 work. It costs little now and avoids a second rebuild when server-side sending arrives.

| 3.1+ feature | What 3.0 leaves ready |
|---|---|
| Server-side sending (Meta CAPI first, then GA4 Measurement Protocol, Ads Enhanced Conversions, Microsoft, X) | `WCCT_Event` carries `event_id`, normalised value fields and a hashed-user-data slot; integrations expose a `transports` list, with `browser` the only entry in 3.0; the log table has a `source` column and a unique key on `event_id,platform,source`, so a server row dedups against its browser twin; a per-order consent snapshot is stored at checkout so a late server send can honour it; a `wcct_send_queue` Action Scheduler group exists (used by missed-sale checks in 3.0) |
| Access tokens | Settings schema reserves a `credentials` block per platform; storage goes through one `WCCT_Secrets` class (encrypted option with a `wp-config` constant override), used by the catalog feed credential in 3.0 so the class is real, not theoretical |
| Failure alerts and retries | Alert types are a registry (`wcct_alert_types`); 3.0 ships `missed_sale`, 3.1 adds `send_failed` and `token_expired` without touching the alerts UI |
| Doctor checks (match quality, health and wellness, Tag Manager scan) | Detectors are a registry (`wcct_doctor_checks`) with a common result shape (found, why, action, confidence); new detectors are one class each |
| New platforms (TikTok, Pinterest) | Platforms register through `wcct_platforms` with a schema, events map and transports; the Platforms page, Doctor and log need no changes |
| Test purchase with platform confirmation | The "Waiting for the first event" strip after Save is the same UI; 3.1 swaps the browser-report wait for an API confirmation |
| Weekly email content | Built from the same `metrics` endpoint the dashboard uses; new metrics appear in both |
| Pro as an add-on | Pro extends Lite only through the filters above and imports `@wcct/components`, exactly like Texty add-ons. No class extension, no DOM cloning, so a Lite UI change never breaks Pro again |

## Success metrics (baselines measured 2026-10-22 on the internal test site, `baseline/metrics.md`)

| Metric | Baseline | 3.0 target |
|---|---|---|
| Plaintext PII fields on a logged-in storefront page | 14 (7 fields × 2 pixels) | 0 |
| Platforms that re-fire Purchase on thank-you reload | 4 of 5 | 0 |
| Platforms that fire Purchase on a failed order | 5 of 6 | 0 |
| Ad platforms with begin-checkout on block checkout | 1 of 3 | 3 of 3 |
| Integrations with consent gating | 0 of 6 | 6 of 6 |
| `wc_enqueue_js` deprecation notices per browsing pass | 63 | 0 |
| Meta events carrying `event_id` | 0 | all |
| Test methods, Lite / Pro | 19 / 0 | characterisation + value maths + dedup covered, first Pro suite |
| wp.org rating (3.0 of 5, 9 one-star reviews, Oct 16 2026, wp.org) | 3.0 | set after launch; proposed 4.0 within 90 days |

Setup completion and dedup rate need telemetry or a Meta pixel; deferred with the features they measure.

## Decisions still open (recommended default first)

1. **Pro 1.1.4 release status.** Still the most urgent item. If unpublished, ship it as a security-only release with 1.1 and 1.2 added. Confirm with the team.
2. **Order key in tag URLs** (fbq, Ads, X, Bing): strip it the way GA4's `cleanUrl` does. Recommend yes, in 2.1.
3. **Canonical upgrade link:** by channel (wp.org Free → storepulse.co; Marketplace build → WooCommerce.com). Needed for 3.7.
4. **Wishlist:** decided 2026-10-28: keep Meta Add to wishlist as a Pro event and fix it in 2.5 (the prototype shows it as a Pro row).
5. **Licence check:** out of 3.0; decide the mechanism for 3.1 with grandfathering.
6. **Telemetry:** out of 3.0; decide before 3.1 so setup completion can be measured.

## What Imtiaz provides

- Nothing for the UI stack: Claude Code verifies `github:getdokan/plugin-ui` access and fetches the platform logos in task 0.4, and stops if either fails.
- Real `wcct_settings` exports from 5 to 10 stores, Free and Pro, anonymised, for 4.1.
- One real Meta pixel and one GA4 property for Tag Assistant and Events Manager checks (fake ids cover everything else).
- A heads-up to the CTO with this document before Phase 3.
- Staging copies of the playground for Phase 4 (Iron Mir can create them through the Hostinger connector).

## Order of work

1. **Planning and UI (now):** this doc, `UI-RESEARCH.md`, the mockup (task 3.1), sign-off.
2. **GitHub issues:** one per task ID, in the right repo (Lite public: neutral wording, no security terms; Pro private: full detail). Milestones per phase.
3. **Build:** one Claude Code prompt per issue on `feature/ct-revamp`, each ending with a `REVAMP-LOG.md` entry and a stop. Order: Phase 0 → 1 → 2 → 3 → 3b → 4.
4. **Milestone push:** when a phase's issues are closed, push `feature/ct-revamp` in both repos and note the SHAs in the log.
