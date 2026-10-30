## 2026-10-22 12:38 KICKOFF-1 Repos and branches
- Status: done
- Repo/branch/commits: Lite `feature/ct-revamp` = `origin/develop` @ 5097458 (2026-10-06, "Replace Grunt with npm scripts and add release scripts"); Pro `feature/ct-revamp` = `origin/release/1.1.4` @ 5c68b58 (2026-10-06, "Bump version to 1.1.4"). No commits added.
- What changed: `gh auth status` OK (imtiaz-pranto, scopes repo/workflow); `git ls-remote` OK on both origins. `ct-fetch.sh` ran clean: both work branches created, Lite `composer install` OK (appsero/client 2.0.6, Mozart ran, `vendor/` + `dependencies/` present). Plugin headers: Lite `Version: 2.1.6` (readme Stable tag 2.1.6), Pro `Version: 1.1.4`. Remote branch `origin/feature/ga4-basic` no longer exists (deleted after merge). Local `feature/ga4-basic` (5d48338) is NOT a git ancestor of `origin/develop` because it was squash-merged as c6a1cff "Add Google Analytics 4 integration (#74)". The two commits it would add (16d7089, 5d48338) are already in develop by content; develop's GA4 is newer than the branch (`class-integration-ga4.php` +241/-106 vs the branch: order-key stripping, `wcct_ga4_purchase_sent` AJAX dedupe, Store API add-to-cart, shared gtag loader via `wcct_gtag_loader_printed`). Do not merge `feature/ga4-basic`; it is obsolete. Lite 2.1.6 shipped with GA4 Phase 1 already, so the P1 scope in the kickoff needs re-reading against develop. Pro `release/1.1.4` is 1.1.4 on top of develop (25e5d7e, PHP 8.2 dynamic-property fix #62).
- Verified on auto site: not yet (Step 2 blocked, see next entry)
- Numbers: Lite tests today: 2 PHP files under `tests/` (`bootstrap.php`, `unit/GA4DataTest.php`), 19 test methods. Pro: no `tests/` dir, 0 tests. Measured with `find tests -name '*.php' | wc -l` and `grep -c 'function test'`.
- Open questions / decisions needed: none for this step

## 2026-10-22 12:38 KICKOFF-2 Connect the live site
- Status: blocked
- Repo/branch/commits: n/a
- What changed: nothing. `.ct-sync.env` does not exist (only `.ct-sync.env.example`). Tried the one Hostinger host in `~/.ssh/known_hosts` ([redacted]): "Permission denied (publickey,password)" with `~/.ssh/id_ed25519`. The site's A records ([redacted]) could not be tried (SSH to them was denied by the session's permission classifier). Steps 2.2 to 2.5, 3 and 4 all need SSH, so they did not run. The Stop hook (`ct-sync.sh`) will keep exiting with "Missing .ct-sync.env" until the file exists; harmless.
- Verified on auto site: nothing
- Numbers: none
- Open questions / decisions needed: (1) Create `CT/.ct-sync.env` from the example with `SSH_HOST=<hPanel > Advanced > SSH Access host or IP>`; keep SSH_USER, SSH_PORT, SITE_URL and SITE_ROOT as in the example unless hPanel shows a different document root. (2) Make sure the public key `~/.ssh/id_ed25519.pub` is added under hPanel > SSH Access (the ct-sync script uses BatchMode, so password auth will not work). (3) Important ordering: the moment `.ct-sync.env` exists, the Stop hook will rsync the local branches over the server's 2.1.6 / 1.1.4 folders after the next response. The branches are byte-identical to the released code today, but run `bash ct-sync.sh --backup` yourself once before resuming so the server backup from Step 2.4 exists first.

## 2026-10-22 14:10 KICKOFF-2b Connect the live site (resumed)
- Status: done
- Repo/branch/commits: no code changes; both work branches unchanged (lite 5097458, pro 5c68b58)
- What changed: `.ct-sync.env` now present, SSH works (`wp core version` = WordPress 7.1.3, WooCommerce 11.2.1, PHP 8.2.34). Snapshotted "before" state into gitignored `baseline/`: `plugins.json`, `themes.json` (active theme Kadence 1.5.2, classic not block), `wcct_options_all.json` (only `wcct_installed`/`wcct_version`/`wcct_pro_version` existed; `wcct_settings` did not exist before this session). Cart (id 7) and checkout (id 8) pages use WooCommerce **blocks**. Turned on `WP_DEBUG`/`WP_DEBUG_LOG` true, `WP_DEBUG_DISPLAY` false. Ran `ct-sync.sh --backup` first (server tar `~/ct-backups/ct-plugins-20261022-133021.tar.gz`), then synced.
- Verified on auto site: after the first sync the storefront fatally errored — rsync excludes `phpunit*`, but Lite's dev `vendor/autoload.php` requires `vendor/phpunit/`. Fixed by `composer install --no-dev` in Lite and re-syncing; site then returned 200 on home/cart/shop and the WP-CLI load was clean. Also found the site uses a **memcached object cache** behind a LiteSpeed drop-in: `wp cache flush` cannot reach it, so `wcct_settings` stayed invisible to the storefront until memcached was flushed over a socket. Wrote `baseline/flush.sh` (memcached `flush_all` + `wp litespeed-purge all`); use it before trusting any storefront curl.
- Numbers: backup 233 KB; server plugin versions confirmed Lite 2.1.6 / Pro 1.1.4 both before and after sync (branches are byte-identical to the released code).
- Open questions / decisions needed: two operational notes for anyone editing Lite and re-syncing — (1) re-run `composer install --no-dev` before sync if dev deps got reinstalled, (2) run `baseline/flush.sh` after a settings change or the object cache serves stale output. Consider adding `--exclude "vendor/phpunit/"` is already there; the real fix is shipping a no-dev vendor. "none" blocking.

## 2026-10-22 14:10 KICKOFF-3 Settle the open questions on a real install
- Status: done
- Repo/branch/commits: no code changes
- What changed: exercised every integration live with test IDs and a full purchase journey (view → add to cart via single/shop-AJAX/block-button → block cart → block checkout → purchase), using WP-CLI, cache-busting curl and the in-app browser capturing real beacons. Full confidential write-up in `baseline/live-findings.md` (kept out of git and out of this entry per the brief).
- Verified on auto site: headline answers — **CT-AUDIT §13 #1 is FIXED** (order-received emits no PII without a valid order key; `hash_equals` gate in Pro 1.1.4; bogus/no/wrong key all clean, verified by curl). **#3**: `facebook.com/tr/?…&v=2.7.19` returns HTTP 200, but so does any shaped request, so 200 is not proof of ingestion; the live `fbevents.js` is 2.9.427 while our beacon is frozen at 2.7.19 (needs Events Manager to settle). **#4**: `oct.js` loads (301→static.ads-twitter.com, 200) and `twttr.conversion.trackPid` is actually called, but it is the deprecated API; ingestion needs an X account. **GA4 §8**: jQuery present on block checkout; `wc-blocks_added_to_cart` fires for block adds and GA4 captures them; theme is classic so the single-product hook question is moot and GA4 `view_item` fires anyway; `wc_enqueue_js` is deprecated in WC 11.2.1 (63 notices/pass). **pro-audit §13 #8**: Purchase **does** fire on the block order-confirmation page for all integrations.
- Numbers: see metrics entry below. Key live facts — Purchase re-fires on reload for Meta/Ads/X/Bing/Custom but NOT GA4 (GA4 sets `_wcct_ga4_tracked`); failed orders fire Purchase for everything except GA4; Meta/Bing begin-checkout are dead on block checkout (only GA4 `begin_checkout` fired); logged-in customers get 7 PII fields ×2 pixels in `fbq init` on every page.
- Open questions / decisions needed: two still need external accounts — whether Meta ingests the stale `v=2.7.19` beacon, and whether X records legacy `trackPid`. Both flagged in the plan.

## 2026-10-22 14:10 KICKOFF-4 Capture baseline numbers
- Status: done
- Repo/branch/commits: no code changes
- What changed: measured tracking output, events, PII and risk-register status on the unmodified base branches. Written to `baseline/metrics.md` with raw HTML in `baseline/html/` and machine counts in `baseline/html_analysis.jsonl`.
- Verified on auto site: per-page tag counts (head block ~7.8 KB every page, ~8.1 KB order-received; 8 inline tracking scripts/page; one external `gtag/js` in head plus 4 tag files from inline loaders), one full-journey event matrix with duplicates/gaps, PII table, and all 31 CT-AUDIT §11 items marked.
- Numbers: **CT-AUDIT §11: of 31, 2 fixed (#1 unauth PII, #2 order-key leak), 1 more fixed (#29 build deps), 1 partly fixed (#20 PHP 8.2 props); the other 27 reproduce** (consent, event_id, logged-in PII, public CSV export, block-checkout gaps, reload dedup, frozen `v`, etc.). **Tests today: Lite 2 files / 19 methods (all `GA4DataTest`), Pro 0.** Event duplicates: Meta AddToCart fires once per pixel (2×) with DOM-scraped values; Purchase re-fires on reload for 4 of 5 integrations.
- Open questions / decisions needed: none

## 2026-10-22 14:10 KICKOFF-5 Draft the revamp plan
- Status: needs decision
- Repo/branch/commits: no code changes; `REVAMP-PLAN.md` written at the folder root
- What changed: wrote `REVAMP-PLAN.md` — §0 is the required diff table (every audit/GA4/consent item marked already-fixed / partly / open against the synced branches), then P0 (remaining privacy: catalog-export auth, out-rendering WC on order-received, logged-in PII guard), P1 (Consent Mode v2 — not started — plus non-Google pixel gating and GA4 consent wiring), P2 (Meta event_id, per-order dedup for legacy, CAPI design spike), P3 (block-checkout parity, broken paid features, hygiene, settings sanitise). Each task has repo/files/acceptance/verify/risk/Pro-coordination. Includes 11 decisions (recommended defaults) and a success-metrics table tied to Step 4 baselines.
- Verified on auto site: plan is grounded in the live findings (e.g. Consent Mode confirmed entirely absent by grep; GA4 Phase 1 confirmed shipped and correct; unauth PII confirmed fixed).
- Numbers: success metrics each carry a measured baseline (PII fields 7×2, reload double-count 4/5, begin-checkout 1/3 platforms, `wc_enqueue_js` notices 63, tests 19/0, etc.)
- Open questions / decisions needed: the 11 in §4 of the plan. Top 3: (1) Consent Mode default for existing installs — recommend off + notice; (2) should non-Google pixels (Meta/X/Bing) be consent-gated in the same release — recommend yes; (3) Meta CAPI free or Pro — recommend Pro. Stopping here per the brief.

## 2026-10-23 12:30 3.1 HTML prototype of the 3.0 admin UI
- Status: needs decision (built and verified; waiting for Imtiaz's review)
- Repo/branch/commits: none. Everything is in the new folder `CT/prototype/`; neither plugin repo was touched (Lite still 5097458, Pro still 5c68b58, both working trees clean). Nothing committed, nothing pushed.
- What changed: 12 pages in `prototype/` (`index`, `pick-platforms`, `platforms`, `platforms-google`, `platforms-x`, `platforms-microsoft`, `platforms-advanced`, `log`, `doctor`, `alerts`, `whats-new`, `email-weekly`) on shared `assets/tokens.css` (plugin-ui token names, Texty values, emerald `success`), `assets/components.css` (one class per component, each mapped to its plugin-ui / Texty equivalent in `README.md`), `assets/email.css`, `assets/icons.js` (lucide paths), `assets/app.js` (state bar, simulated WP chrome and top bar, page behaviour), `assets/logos/` + `LOGO-SOURCES.md`, `README.md`, and review tooling in `prototype/tools/` (`screenshot.mjs`, `check-links.mjs`, `contrast.mjs`, `interactions.mjs`; `npm run verify` runs all). Opens from `index.html` over `file://`, no build, no network, no CDN, system font stack.
- Verified on auto site: not applicable (no plugin code). Verified locally with headless Chromium (Playwright 1.64.1): `html-validate` 9 with `html-validate:recommended` on all 12 pages: 0 errors; the rendered DOM after JS (shell, log rows, state bar) also validates with 0 errors. `check-links.mjs`: 196 local links and asset references across 13 files resolve from `file://`, every page is linked from another page; 25 `#` placeholders stand for external pages (docs, Meta Events Manager, Google Ads). `interactions.mjs`: 16 of 16 checks pass with no JS errors (state persists across pages; Install New / Upgraded; Doctor ran / not run; dashboard chips; tile count; Pause tracking dialog then Paused / Resume; connected / not connected; Google radio swaps fields and the label shows "looks incomplete" until 10+ characters; Advanced switches, "N unsaved changes", sticky save bar, Customised badge after save; log tabs, row detail, Pro search, empty state, detail dialog at 1024 px; alerts switches follow plan and "Send a test" toasts; Doctor 2 findings / all clear, "Check again" holds a running state for 2 s, Dismiss with Undo; What's new Free / Pro / old Pro; X re-setup notice; Microsoft lock / UET field; Help menu). `screenshot.mjs`: no JS errors, no broken images, no horizontal page scroll at 1024, 1280 and 1440 px for any page in Free or Pro.
- Numbers: Screenshots (1440 px, in `prototype/screenshots/`): 24 Free/Pro shots, `<page>-free.png` and `<page>-pro.png` for each of the 12 pages, plus 11 in `screenshots/states/`: `index-new-install`, `index-upgraded`, `index-doctor-not-run`, `platforms-not-connected`, `platforms-x-upgraded`, `log-empty`, `doctor-all-clear`, `whats-new-old-pro`, and 1024 px layouts `index-1024`, `platforms-1024`, `log-1024`. Contrast (`contrast.mjs` measures every visible text element against the background it sits on, colours normalised through a canvas so `oklch()` and `color-mix()` are measured as painted; 32 page/state runs; full table in `prototype/tools/contrast-report.txt`): 31 unique text/background pairs, every enabled pair at or above 4.5:1. The pairs nearest the line: amber-700 on amber-100 pill 4.51, WP current-menu text on `#2271b1` 4.54 (WP core's own pair), `--muted-foreground` on `--subtle` 4.54, `--muted-foreground` on white 4.74, `--destructive` on white ("Pause tracking") 4.77, amber-700 "Upgrade" on `--subtle` 4.81, emerald-700 on emerald-100 4.84, `--primary` on `--primary-soft` 4.97, white on `--primary` 5.47, `--page-muted-foreground` on WP grey 5.78; the rest run 6.87 to 19.80. One pair below 4.5:1, white on a disabled primary button (2.77 after the 0.55 opacity), is exempt as a disabled control. Two failures found and fixed on the way: muted text inside `<code>` on `--muted` (4.35) and a link in the state bar (2.91). Dialogs and toasts reuse pairs already in the table (`--tone-off-fg` on white 7.56, `--destructive` on white 4.77, foreground on white 19.80).
- Logos: fetched official marks for Google Analytics (`gstatic.com/analytics-suite/.../ic_analytics.svg`, the URL in UI-RESEARCH §4), Google Ads (`gstatic.com/images/branding/productlogos/ads/v5/192px.svg`), X (inline SVG on the X brand toolkit page; its download zips are still the 2021 Twitter bird) and the Microsoft four-square symbol (from the logo on about.ads.microsoft.com, wordmark cropped; the product logo needs a licence, so it's labelled "Microsoft Advertising" in text). **Meta not fetched:** the only download is `Meta_Company-Lockup.zip` behind a terms-of-use acceptance, which I don't accept on your behalf, so `meta.svg` is the placeholder from `mockup-ref`. All SVG, so no PNG fallbacks needed. Sources, dates and licence notes are in `assets/logos/LOGO-SOURCES.md`.
- Changes from `mockup-ref`, and why:
  1. Dashboard "Platforms working 3 of 4" → "2 of 3": the cards below show Meta and X working, Google needing attention, Microsoft and Custom not set up. With Install = Upgraded it reads "1 of 3", X shows amber "needs a new event ID", and "What to do next" gets an X item, so the dashboard agrees with the X page and What's new.
  2. Wording rule applied where the artboards slipped: "consent plugin" → "cookie plugin" (Meta, Google, Doctor card); "Uses Google's consent mode" → "Works with your cookie plugin"; "GT- container IDs" → "a Google tag ID instead of G-"; the Doctor's "Consent" tag → "Cookie choices"; the weekly email's "Consent" pill → "Cookie choices"; "server sending" dropped from the Doctor's Facebook for WooCommerce finding. The log detail moved the event ID (`wcct_1312_purchase`) out of the timeline into a "For developers" disclosure, and the timeline says "Counted once, even if the thank-you page reloads". The Advanced "For developers" panel adds a line that maps the shop-owner terms to the technical ones (Counted once = deduplication by event ID, and so on).
  3. No greyed controls: Free's Pro rows on Advanced and Alerts show a lock or crown with an "Upgrade" link instead of an off switch.
  4. Activity log: Free has no search box. Scope 3b.2 makes search by order number Pro, so search and Export CSV appear only in Pro. The Free upgrade card says "30 to 90 days" to match scope 3b.1 (the artboard said 30). The Reached column shows logos only, with names in each logo's alt text, so the table fits at 1024 px. The failed order shows $64.00, not $0.00. The empty state uses the exact copy from the brief.
  5. Pause tracking opens a confirm dialog (`<dialog>`), then shows Paused and Resume tracking. In the artboard it was a plain link.
  6. Not-connected footer: "Waiting for the first event" before anything was connected read as a promise, so it now says "Not connected yet. After you connect, we wait for the first event from your store."
  7. Microsoft in Free fills the detail pane with an inline Pro panel (Compare plans + Continue with Free, no modal). Microsoft in Pro has a UET tag form. Both are new variants the brief asked for; the artboards had none.
  8. What's new adds a "Pro 3.0 is active" banner for Pro. The artboard had nothing Pro-specific.
  9. The "Customised" badge on Advanced shows only once saved settings differ from the recommended set. The artboard showed it always.
  10. Google uses the GA mark wherever it means the platform (the artboards mixed the Ads and GA marks). Each product's own mark appears in the Google radio cards.
  11. The prompt's state bar sits bottom-right but starts collapsed (it remembers the choice), because when open it covered the sticky Save button on Advanced and the footer buttons on Platforms.
- Open questions / decisions needed:
  1. Approve three token additions (all in `tokens.css` with reasons): `--input` oklch(0.87 0 0), because plugin-ui's input = border makes text boxes nearly invisible; `--page-muted-foreground` oklch(0.48 0 0), because `--muted-foreground` is 4.2:1 on WP's `#f0f0f1`; `--subtle` oklch(0.985 0 0) for the help column and locked rows. Without them, task 0.4 needs another way to pass 4.5:1 on the grey page (for example a white app background).
  2. Meta logo: accept the terms on meta.com/brand and drop the blue symbol SVG into `prototype/assets/logos/meta.svg`, or confirm that task 0.4 does it.
  3. Free log search: confirm search stays Pro-only as scope 3b.2 says. The brief's state table lists "search filters by order number" without a plan, so I followed the scope.
  4. Pro log retention label: the Pro pill says "Last 30 days" but scope says 30 to 90 days. Which is the default, and is it a setting?
  5. Placeholders still to fill: `[PRICE]` and `[DATE]` on Alerts, the setup clips (Meta 20 s, Google 25 s, X 30 s, Microsoft 20 s), and the 25 `#` links to docs and platform consoles.
  6. "Google" as one platform uses the GA mark. Keep it, or show both marks in the list and on the dashboard?

## 2026-10-23 15:15 3.1 Prototype restyled on @wedevs/plugin-ui
- Status: needs decision (restyle done and verified; two style choices below need a yes)
- Repo/branch/commits: none. Changes only in `CT/prototype/` (not a git repo) plus `CT/.claude/launch.json`. Lite still 5097458, Pro still 5c68b58, both working trees clean. Nothing committed, nothing pushed.
- What changed: Cloned getdokan/plugin-ui at `acc2771` (2026-09-30, read-only, into the session scratchpad) and rebuilt `assets/tokens.css` and `assets/components.css` from it. Tokens: every plugin-ui token from `src/styles.css` under its own name (popover, accent, info, warning-foreground, chart-1..5, radius-sm/md/lg/xl, shadow-xs..lg, font-sans/mono). Only four differ from plugin-ui defaults (`--primary`, `--primary-foreground`, `--ring` = Texty blue, `--success` = emerald). `--input` is back to plugin-ui's 0.922 (inputs get plugin-ui's shadow-xs instead) and `--subtle` is gone, which settles two of this morning's open questions. Components now match plugin-ui's Tailwind recipes: Button (h-9, rounded-md, font-medium; `outline` = border-primary text-primary; new `secondary`, `destructive`, `pro` = TopBar.UpgradeBtn), Badge (h-5, text-xs font-medium), Card (rounded-xl 14px, ring-foreground/10, shadow-xs), Notice for every page-level message (3px left bar, bg-tone/10), Switch (30 × 18.4px), Input/Select/Textarea, radio choice cards, MatricsCard stat cards, Tabs (default for log and dashboard filters, line for the top nav), TopBar (66px, outline version badges, round crown badge for Pro), DropdownMenu, AlertDialog/Dialog, sonner toast, DataViews table and empty state. The crown is plugin-ui's `CrownIcon`. Pages kept their class names; markup swaps only: warning/info cards → `.notice`, neutral buttons → `secondary`, pause confirm → `destructive`, "Upgrade to Pro" → `pro`. `README.md` now maps every class to its plugin-ui component and lists the token overrides and CT additions. Earlier the same day: the app's file preview loads pages as `data:` URLs so CSS can't load there; added a `ct-prototype` static server to `CT/.claude/launch.json` (port 8731) and a note in the README.
- Verified on auto site: not applicable (no plugin code). Locally, `cd prototype/tools && npm run verify` with exit code 0 (Playwright 1.64.1 Chromium, reinstalled after the disk cleanup removed the browser cache): `html-validate` 0 errors on 12 pages and 0 on the rendered DOM; 196 local links and asset references resolve from `file://`; 16 of 16 interaction checks pass with no JS errors; no JS errors, broken images or horizontal page scroll at 1024 / 1280 / 1440 px; screenshots re-taken (24 in `prototype/screenshots/`, 11 in `screenshots/states/`).
- Numbers: contrast (`tools/contrast.mjs`, 32 page/state runs, table in `prototype/tools/contrast-report.txt`): 41 unique text/background pairs, every enabled pair ≥ 4.5:1; lowest amber-700 on amber-100 4.51, then 4.54 (WP current menu item; `--muted-foreground` on `--muted-50`), 4.74 (`--muted-foreground` on white), 4.77 (`--destructive` on white), 4.80 (primary outline button text on the WP grey). Two pairs failed after the restyle and were fixed by using `--tone-off-fg` for muted text on tinted fills: muted text in a warning Notice (4.38) and the description in a checked Google radio card (4.43). The disabled primary button measures 2.54 (opacity-50, as plugin-ui does), which WCAG exempts.
- Open questions / decisions needed:
  1. PRO colour: plugin-ui's TopBar defaults to `#FFBC00` (border `#F2A200`); the brief says `#FFAC27`. I kept `#FFAC27` and pass it as `proBadgeBg`. Keep it, or switch to plugin-ui's yellow?
  2. Outline buttons: plugin-ui's `outline` variant is blue (border-primary text-primary), so secondary actions like "Run the Doctor", "Connect", "See the checklist" are blue-outlined, more blue than the grey artboards. Keep plugin-ui's look, or ask plugin-ui for a neutral outline variant?
  3. Card radius: plugin-ui's Card is 14px (`rounded-xl` = radius + 4px); the brief said 12px. Followed plugin-ui.
  4. Still open from this morning: `--page-muted-foreground` and the tone map as CT additions, the Meta logo, Free log search, Pro retention label, placeholders, the Google mark.

## 2026-10-28 11:46 3.1 Prototype revision, decisions and Batch A (layout and form rules)
- Status: needs decision (Batch A done, waiting for Imtiaz's review before Batch B)
- Repo/branch/commits: none. Changes only in `CT/prototype/`. Snapshots: `CT/prototype-v1` (before this session), `CT/prototype-v2` (before this revision). Plugin repos untouched. Nothing pushed, no issues created.
- What changed:
  - Nine pending decisions applied as defaults. `--pro` is now plugin-ui's `#FFBC00` (1). Blue outline buttons (2) and the 14 px card radius (3) were already in place. The two CT token additions are kept and marked accepted in `tokens.css` (4). Log search was already Pro only (5). Retention copy now says "30 days (up to 90)" in the Free/Pro list, the log upsell and the Microsoft upsell, and Pro gets a "Keep history for" setting on the Activity log (30 default, 60, 90) (6). Google was already one platform with the GA mark (7). The Meta logo and the PRICE, DATE, clip and doc placeholders are unchanged (8, 9).
  - A1: no max-width anywhere (`--page-max` and `.is-narrow`, `.is-centered` and `.is-reading` are gone). `--page-pad-x` is 32 px. Platforms grid: list 240 px, main `minmax(0, 1fr)`, help 320 px. Below 1280 px the help column is a right-hand drawer opened by the ? button in the plugin header. It has a Close button, Escape and backdrop close it, focus moves in and comes back, and the Docs, Support and Feature request links are added at the bottom. At 1280 px and wider, ? opens the help menu as before. The platform list stacks above the panel only below 900 px (it used to stack below 1100 px).
  - A2: inputs inside `.field` are capped at 560 px (`--input-max`). The Google Ads conversion ID and label are now on separate lines. On Alerts, "Send a test" sits under the email input instead of beside it. `.event-row-body` is one column (it was a 2-column grid). The two card columns on the Advanced page now stack. `.field-row` is removed. Help copy that said "on the left" or "on the right" now names the field.
  - A3: the Platforms subtitle is now "Connect each place you run ads. The recommended setup is on by default, so most stores only need an ID." (on Meta, X and Microsoft).
  - Tooling: `screenshot.mjs` also shoots every page at 1920 px (`screenshots/1920/`) and checks for horizontal scroll at 1920. `interactions.mjs` has 3 new checks: full width at 1920 with 240 / 320 columns and 32 px padding at 1440; the help drawer at 1100 px; and no two settings controls on one line, with inputs ≤ 560 px, on every page in Free and Pro.
- Verified on auto site: not applicable (prototype only). Locally, `cd prototype/tools && npm run verify` exit 0. html-validate found 0 errors on 12 pages and on the rendered DOM. 196 links resolve from `file://`. 19 of 19 interaction checks pass, run 3 times after the drawer focus fix (the first version moved focus before the drawer was visible and passed only on some runs). No JS errors, broken images or horizontal scroll at 1024 / 1280 / 1440 / 1920. Also loaded the Google page in the app's browser at 1440 and 1100 px over http://localhost:8731 with no console errors.
- Numbers: contrast (`tools/contrast.mjs`, 32 page/state runs at 1440 px): 41 unique text/background pairs, every enabled pair at or above 4.5:1. New pair: PRO text `#0a0a0a` on `#ffbc00` measures 11.73 (it was on `#ffac27`). The lowest are the same as before: 4.51 (amber-700 on amber-100), 4.54, 4.74, 4.77. The disabled primary button, 2.54, is exempt. The drawer reuses existing pairs (foreground and primary links on white) and is not measured separately, because it is closed at 1440 px. Screenshots: 24 at 1440 px (`screenshots/`), 24 at 1920 px (`screenshots/1920/`), 8 states plus 3 at 1024 px plus the new `states/platforms-help-drawer-1100.png`.
- Assumptions:
  1. "One setting per line" covers settings controls. Not counted as settings: the Activity log toolbar (status tabs, search, Export), the Dashboard filter chips and period select, action button pairs (dialog footers, Compare plans / Continue with Free), and the Pick platforms tiles (a 3-column grid of choices). All of these still sit side by side.
  2. The weekly email preview keeps its email width (600 px). It is an email, not an admin page.
  3. The Advanced page got the minimum A1 and A2 fixes only, because Batch B removes it.
- Open questions / decisions needed:
  1. Approve Batch A before Batch B starts.
  2. Conflict, B3: the spec adds Meta "Add to wishlist" as a Pro event. The scope doc says "drop Wishlist" (cut line) and "drop Wishlist unless the fix is under a day" (task 2.5), and `CT-3.0-PLAN.md` still lists "Wishlist event: fix or drop in 3.0?" as open. Add it, or leave it out?
  3. Conflict, D3: the spec's provisional split gives Free a server-sent Purchase only, matched on email, click ID, IP and browser. `CT-3.0-PLAN.md` decision C1 and its feature table give Free "server-side purchases and funnel events with hashed email, phone, browser and click IDs". So the spec differs from C1 on two points: funnel events and phone. Which one should the prototype show?
  4. Are the assumption 1 exemptions right, or should the log search and the pick tiles go one per line too?

## 2026-10-28 11:59 3.1 Prototype revision, Batch B (events table and platform parity)
- Status: done
- Repo/branch/commits: none. Changes only in `CT/prototype/`. Plugin repos untouched. Nothing pushed.
- Decisions from Imtiaz (2026-10-28): add Meta "Add to wishlist" as a Pro row, even though the scope doc says drop it. Use decision C1 for the 3.1 Free/Pro server split. Keep the Batch A exemptions (toolbars, chips, button pairs, pick tiles).
- What changed:
  - B1: new `assets/config.js` holds each platform's events (name, description, recommended, Pro, server plan, last seen) and the server sending flag. `app.js` builds the events table from it on Meta, Google, X and Microsoft. The table has a header with "Events", the count ("4 of 8 on") and a Recommended / All / Custom preset; editing any row switches it to Custom. Columns are Event (name and description), On (switch) and Last seen (green dot and relative time, "Off", or "Not yet" while the platform isn't connected). It shows the recommended rows, with a "Show N more events" row for the rest. On Free, Pro rows show a PRO badge and a lock instead of a switch. The "Recommended set" toggle is gone.
  - B2: `platforms-advanced.html` is deleted. Each platform panel ends with a collapsed "More settings" section, one setting per line. Meta has order value, product ID sent, skip roles, then (Free: locked rows; Pro: switches and the pixel list) custom parameters, richer customer matching and more than one pixel, with the developer block last. Google has order value, an optional Google tag ID, skip roles and developer. X and Microsoft have order value, skip roles and developer. Custom script has its own page, `platforms-custom.html`. Every link to the Advanced page now points somewhere live (platform lists, Dashboard "Add a script", Pick platforms, state-bar screen list). The link checker reports no broken links.
  - B3: Meta adds View category and Add to wishlist (Pro). Google adds Registration as an Ads conversion (Pro). X adds Registration (Pro). Microsoft now lists Page view, Add to cart, Start checkout and Purchase.
  - B4: the Custom script page has three placements (Thank-you page, Every page in the header, Sign-up), each with its own switch and script box. It lists all 11 placeholders in two groups (7 order, 4 customer tagged "Personal data") and states the verified-order-plus-consent rule.
  - Also removed in passing, because the Advanced page held them: "If backup sending is added later, it will match" and the "Backup sending (3.1)" developer term. Google's Free upsell no longer mentions refunds sent to Analytics (D2, done early).
- Verified on auto site: not applicable. Locally, `npm run verify` exit 0: html-validate 0 errors on 12 pages; 214 links resolve; 21 of 21 interaction checks pass, 3 of them new (Meta count, presets, Show more and Pro locks; event parity on Google, X and Microsoft; More settings content and order, with 11 placeholders and 3 placements on Custom script). The "one setting per line" check now opens More settings and covers every page in Free and Pro. No JS errors or horizontal scroll at 1024 / 1280 / 1440 / 1920.
- Numbers: contrast, 32 runs at 1440 px. `contrast.mjs` now opens More settings and Show more before measuring, so the collapsed content is included. 41 unique pairs, all enabled text at or above 4.5:1. The lowest are 4.51, 4.54 and 4.74. The disabled "Saved" button, 2.54, is exempt. Screenshots: 26 at 1440 px and 26 at 1920 px, Free and Pro for 13 pages (`platforms-custom` added). The 2 old `platforms-advanced` shots are deleted.
- Assumptions:
  1. Free/Pro per event keeps the prototype's earlier split. View product, Add to cart, Start checkout, Purchase, Search and Sign up are Free on Meta. Only the B3 additions are Pro.
  2. "Skip these roles" and "Order value includes" are per platform, one copy in each platform's More settings.
  3. The Custom script placements start off, so the page reads "Not set up", matching the platform list.
  4. The "Product ID sent" hint links to the Catalog page once Batch C adds it.
- Open questions / decisions needed: none

## 2026-10-28 12:07 3.1 Prototype revision, Batch C (Catalog, Settings, cleanup)
- Status: done
- Repo/branch/commits: none. Changes only in `CT/prototype/`. Plugin repos untouched. Nothing pushed.
- What changed:
  - C1: new `catalog.html`, placed after Platforms in the nav. A line-tab strip of destinations shows Meta only, so more destinations can be added later as tabs. Pro has four sections:
    - Feed status: the feed URL with Copy URL, three display cards (last generated, product count with the number left out, Meta's last fetch) and a health pill.
    - Product IDs: "ID used in the feed", the line "Your Meta pixel sends: …" linking to `platforms.html#product-id-sent` (the link opens More settings), and a warning notice when the two differ.
    - Leave out of the feed: product types (Simple, Grouped, External / Affiliate, Variable) as one-per-line checkboxes, and a searchable category tree. Parents stay visible when a child matches, and "Tops" appears under Men and under Women, not as a flat repeated list.
    - The 7 setup steps in the help column, with a clip placeholder.

    Free sees a Pro-locked preview with the Microsoft treatment: lock, what you get, Compare plans, Continue with Free, and "Also in Pro". The Doctor has two new Pro checks, "Catalog feed is reachable" and "Catalog feed product IDs match the product IDs your Meta pixel sends", plus a finding for each when it fails. The "Catalog feed" state-bar toggle and the two ID selects drive them. The Doctor's "N things are working" and "checked N things" counts now come from the rows on the page; they were fixed at 7 and 9. The weekly email says "11 of 11 checks passed". Every upsell list that mentions the catalog feed links to the Catalog page (Alerts Free/Pro list, What's new Pro notice and old-Pro notice). New checkbox component (`.check`, plugin-ui Checkbox look) and `.tree`.
  - C2: new `settings.html`, last in the nav. Integration access (Pro) lists Administrator (always on), Shop manager, Editor, Author, Contributor, Subscriber, Customer and Vendor ("Added by Dokan"), one per line. Free sees the same locked-preview treatment. The Alerts upsell "access for shop managers" is now "Choose which roles can manage tracking", linked to Settings. What's new says "role access".
  - C3: grep for "Perfect" across the prototype's HTML, JS, CSS and Markdown found 0 hits, so there was nothing to remove.
- Verified on auto site: not applicable. Locally, `npm run verify` exit 0:
  - html-validate 0 errors on 14 pages. The checkbox groups use `name="…[]"`, which fixed 9 duplicate-name errors.
  - 246 links resolve, and every page is linked from another page.
  - 24 of 24 interaction checks pass. 3 are new:
    - nav order;
    - Catalog: Free lock, copy toast, category search keeping parents, match/mismatch line, the Doctor finding and passing rows, the link opening Meta's More settings;
    - Settings: Free lock, and the Pro role list in order including Vendor.
  - Two bugs found and fixed. "Check again" on the Doctor un-hid findings that didn't apply to the current state; it now re-applies state. Copy URL threw an unhandled clipboard rejection under `file://`; it is now caught.
  - No JS errors or horizontal scroll at 1024 / 1280 / 1440 / 1920.
- Numbers: contrast, 38 runs at 1440 px (added Catalog and Doctor in Pro with the feed failing and IDs differing): 42 unique pairs, all enabled text ≥ 4.5:1. The lowest are 4.51, 4.54 and 4.74. The disabled "Saved", 2.54, is exempt. Screenshots: 30 at 1440 px, 30 at 1920 px, and 2 new states, `catalog-pro-feed-fail-ids-differ` and `doctor-pro-catalog-findings`.
- Assumptions:
  1. "Show which product ID the feed uses" is a select on the Catalog page ("ID used in the feed"), compared with Meta's "Product ID sent". It could instead be read-only, following the pixel setting.
  2. The feed sample values (URL, 248 products, 31 left out, 06:00 / 06:02, "401 Unauthorized") are placeholders.
  3. Integration access lists the WordPress, WooCommerce and Dokan roles named in the spec. A real site shows whatever roles exist.
- Open questions / decisions needed: none

## 2026-10-28 12:20 3.1 Prototype revision, Batch D (version toggle, 3.1 server sending) and final verify
- Status: done (the Free/Pro server split is provisional, see below)
- Repo/branch/commits: none. Changes only in `CT/prototype/`. Plugin repos untouched. Nothing pushed, no GitHub issues.
- What changed:
  - D1: the state panel has "Version: 3.0 | 3.1" (default 3.0) and "Server: Not connected | Connected", which shows only when Version is 3.1. The panel summary now starts with the version.
  - D2: the 3.0 state has no server-side references. Removed:
    - the log detail upsell "In a later update, Pro adds backup sending";
    - "If backup sending is added later" and the "Backup sending (3.1)" developer term (Batch B);
    - "refunds sent to Analytics" (Batch B);
    - the empty sections' `aria-label="Server sending"`;
    - the Doctor's "back from your server" (now "your site answered"). It was about the web server, but it read like server sending.

    The Meta developer term for server sending now lives in `config.js` and is written into the page only in 3.1.
  - D3, 3.1 platform panels. These show only when the platform's `serverSending` flag in `assets/config.js` is true (Meta true; Google, X and Microsoft false):
    - The events table gets a read-only "Sent from" column ("Browser" or "Browser + server"; "Not sent" for off rows), with the line "Browser tracking always runs. Server sending only adds a second copy, and Meta keeps one." under it.
    - A Server sending section sits under the table: server icon, title, a one-line benefit and a status pill, plus a flow strip (Shopper's browser + Your store's server → Meta keeps one copy).
    - Not connected: step 1 creates an access token (with a help link), step 2 is the token in its own input, then "Connect and send a test event".
    - Connected, one block per line: what's being sent; last 7 days (Sent from server 1,284, Delivered 1,281, Retrying 3, sample values); customer details shared ("scrambled before they leave your store"); and the connection (access token, then a Test mode switch; the test event code input appears only while Test mode is on).
    - Delivery mode and retries are in More settings.
    - There is no server-only option anywhere.
  - Free/Pro split, PROVISIONAL, decision C1 as Imtiaz chose today instead of the spec's narrower version:
    - Free sends Purchase plus View product, Add to cart and Start checkout from the server, with basic matching (email, phone, ad click ID, IP address, browser).
    - Pro sends every event, adds name, city, zip and customer ID, and gets server sending on other platforms once their flag is on.
    - On Free, the section ends with a Free vs Pro table and "Upgrade to Pro". When connected, Free rows for Pro-only server events show "Browser" plus a lock.
  - Tooling:
    - new `tools/grep-30.mjs`, also run by `npm run verify`. It sweeps the 3.0 state, opening More settings, Show more and every log row's detail, and fails on any hit not on its allow-list.
    - `contrast.mjs` now runs every page in Free and Pro for both 3.0 and 3.1 (server connected), plus Meta 3.1 not connected, and validates the rendered 3.1 Meta DOM.
    - `screenshot.mjs` checks every page in 3.1 (both plans, both server states) for JS errors and scroll, saves the Meta 3.1 states at 1440 and 1920 px, and saves the extra states at 1920 px too.
    - 2 new interaction checks: the version toggle; the 3.1 Meta flow with flags off on Google, X and Microsoft.
    - `README.md` is updated: states, file map, layout, tools.
- D2 grep results (3.0 state; terms: 3.1, backup sending, server, Conversions API, CAPI, Measurement Protocol, refund; 34 page/state runs; visible text plus hidden DOM text, `title`, `aria-label`, placeholder and `alt`):
  - Kept: "14-day refund" on Alerts (Free and Pro) is the money-back guarantee for buying Pro, not refund tracking.
  - Excluded from the sweep: the prototype-only state bar, which has to show the "3.1" option to switch versions.
  - Everything else: 0 hits.
- Verified on auto site: not applicable. Final `npm run verify` exit 0:
  - html-validate 0 errors on 14 pages and on the rendered DOM, including 3.1 Meta;
  - 247 links resolve and every page is reachable;
  - contrast passes;
  - 26 of 26 interaction checks pass;
  - grep-30 clean apart from the kept hit;
  - no JS errors, broken images or horizontal scroll at 1024 / 1280 / 1440 / 1920 in 3.0, nor in 3.1 at 1024 / 1440. Fixed on the way: `aria-label` on a plain div (the flow strip now has `role="group"`).
- Numbers: contrast covers 68 page/state runs (every page × Free/Pro × 3.0/3.1, plus extras): 42 unique pairs, every enabled pair ≥ 4.5:1. The lowest are 4.51 (amber-700 on amber-100), 4.54 (WP current menu; `--muted-foreground` on `--muted-50`) and 4.74 (`--muted-foreground` on white). The disabled "Saved" button, 2.54, is exempt. Screenshots: 28 at 1440 px and 28 at 1920 px (14 pages × Free/Pro); 18 states at 1440 px, including the 4 Meta 3.1 states (Free/Pro × not connected/connected); 14 states at 1920 px. Stale `platforms-advanced` shots deleted.
- Assumptions:
  1. Free "funnel events" from the server = View product, Add to cart and Start checkout (config `server: 'free'`). Search, Sign up, View category and Add to wishlist go from the server on Pro only.
  2. Basic matching follows C1 and includes phone. The spec had left phone out.
  3. The access token help text names Events Manager > Settings > Conversions API. That is a 3.1-only string.
  4. "Sent from" shows "Browser" for every row until the server is connected.
- Open questions / decisions needed:
  1. Confirm the provisional Free/Pro server split above, or narrow it to the spec's Purchase-only Free.
  2. The scope doc still says "drop Wishlist", but the prototype now has it as a Pro row. Update the scope doc (task 2.5) to match, or remove the row?

## 2026-10-28 12:33 3.1 Prototype revision, 3.1 server split confirmed
- Status: done
- Repo/branch/commits: none. Comment-only edits in `CT/prototype/assets/config.js` and `app.js`. Plugin repos untouched. Nothing pushed.
- What changed: Imtiaz confirmed the 3.1 Free/Pro server split from decision C1. It is no longer provisional. Free sends Purchase, View product, Add to cart and Start checkout from the server, with basic matching (email, phone, ad click ID, IP address, browser). Pro sends every event, adds name, city, zip and customer ID, and gets server sending on other platforms once their flag is on. The code comments now say "confirmed 2026-10-28". The prototype's behaviour is unchanged.
- Verified on auto site: not applicable. Locally, `app.js` parses. The UI is unchanged, so the final verify from 12:20 still holds.
- Numbers: none
- Open questions / decisions needed: the scope doc still says "drop Wishlist" (task 2.5), but the prototype has it as a Pro row.

## 2026-10-28 12:35 2.5 Scope doc: Wishlist kept as a Pro event
- Status: done
- Repo/branch/commits: none. Edited `CT/CT-3.0-SCOPE.md` only. Plugin repos untouched. Nothing pushed.
- What changed: Imtiaz decided on 2026-10-28 to keep Meta Add to wishlist as a Pro event instead of dropping it. Three lines in the scope doc now say so:
  - the "In 3.0" list, which said "drop Wishlist" and now says "Fix … Meta Add to wishlist (Pro)";
  - task 2.5, which said "drop Wishlist unless the fix is under a day" and now says "fix Meta AddToWishlist (YITH WooCommerce Wishlist and WooCommerce Wishlists; kept as a Pro event, decided 2026-10-28)". The acceptance check is unchanged: each event verified live with a test ID.
  - open decision 4, now marked decided.
- Verified on auto site: not applicable (doc change). `grep -i wishlist CT-3.0-SCOPE.md` shows only the 3 updated lines.
- Numbers: none
- Open questions / decisions needed: `CT-3.0-PLAN.md` still lists "Wishlist event: fix or drop in 3.0?" as open (line 563, and row 10 of the issue table). Not edited, because only the scope doc was in this request.

## 2026-10-28 13:18 3.1 Prototype revision: store name, all events, Advanced settings, Catalog redesign
- Status: done
- Repo/branch/commits: none. Changes in `CT/prototype/` and two reference artboards in `CT/mockup-ref/`. Plugin repos untouched. Nothing pushed.
- What changed:
  - Store name: the old demo store name is gone from the prototype and from `mockup-ref/Advanced.dc.html` and `Platforms.dc.html`. The pixel is now "Demo Store Pixel". The `prototype-v1` and `prototype-v2` snapshots are left as they were.
  - YITH removed from the prototype. The wishlist row now reads "When a shopper saves a product to a wishlist."
  - Events tables list every event. "Show N more events" is gone; Recommended / All / Custom only change which events are on. Meta shows 8 rows, Google 6, X 5, Microsoft 4.
  - "More settings" is renamed "Advanced settings" (label, ids, classes, docs, tests).
  - Catalog redesign, using these Mobbin references: Mailchimp's Shopify integration settings, Greptile's sectioned settings, and Revolut Business's category picker ("Selected · N of M" over a scrolling list).
    - One feed summary card replaces the three stat cards and the separate URL row. It shows the health icon and title, a one-line count and timing, a status pill, and the feed URL with Copy.
    - "Product IDs" and "Leave out of the feed" are titled sections over bordered cards of rows.
    - The category tree (29 categories: Men, Women, Kids, Accessories, Home and more, nested) sits in a picker capped at 560 px wide. It has a search field, a "N of 29 left out" bar with Clear, and a list that scrolls inside 296 px, so the page keeps its length.
    - Ticking a parent ticks everything under it, and a parent shows a dash when only some children are ticked.
    - The clip placeholder text is padded and centred.
- Verified on auto site: not applicable. Locally, `npm run verify` exit 0:
  - html-validate 0 errors on 14 pages and on the rendered DOM;
  - 246 links resolve;
  - 26 of 26 interaction checks pass. The events check now expects all 8 Meta rows and no Show more row. The Catalog check also covers the list scrolling in its box (scrollHeight > clientHeight, height ≤ 296 px), the count (2, 10 after ticking Men, 0 after Clear) and Men's partial state.
  - grep-30 clean;
  - no JS errors or horizontal scroll at 1024 / 1280 / 1440 / 1920.
  - Searching the pages, assets and rendered DOM for the old store name, "YITH", "More settings" and "Show more" finds 0 hits.
- Numbers: contrast covers 68 page/state runs: 42 unique pairs, all enabled text ≥ 4.5:1. The lowest are 4.51, 4.54 and 4.74; the disabled "Saved", 2.54, is exempt.
- Open questions / decisions needed: `CT-3.0-SCOPE.md` task 2.5 still names "YITH WooCommerce Wishlist and WooCommerce Wishlists" as the plugins to support (added today). Keep that implementation note, or drop the names there too?

## 2026-10-28 13:45 3.1 Prototype revision: Alerts moved into Settings
- Status: done
- Repo/branch/commits: none. Changes only in `CT/prototype/`. Plugin repos untouched. Nothing pushed.
- What changed:
  - `alerts.html` is deleted, and the top nav is now Dashboard, Platforms, Catalog, Activity log, Doctor, Settings.
  - Settings has a 240 px section list beside one panel at a time, picked by the URL hash:
    - **Alerts** (default, `#alerts`): the five notification rows, the Pro email field with "Send a test", and Save.
    - **Integration access** (`#access`): unchanged.
    - **Plan** (`#plan`): the Free / Pro comparison from the old Alerts page, with "You're on Free/Pro" in the header.
  - The "This week: 3 purchases didn't reach Meta" banner from the old Alerts page was not carried over. The same message is the missed-sales card on the Dashboard.
  - Every "Compare plans" and Upgrade link (13 in the pages, plus the 3.1 upgrade button in `app.js`) now goes to `settings.html#plan`. The weekly email's "Change what you receive" and "turn it off" links, and What's new's "turn them on in Settings, Alerts", go to `settings.html#alerts`. Upgrade links inside Settings switch panels in place. Below 1100 px the section list sits above the panel.
  - Tooling: contrast, grep-30 and the one-setting-per-line check open every Settings panel before measuring. Screenshots take a `page#hash` name and add `settings-access-free`, `settings-access-pro` and `settings-plan-free`. The Settings tests cover the default panel, the Upgrade link opening Plan, and `#access` showing only that panel. README updated.
- Verified on auto site: not applicable. Locally, `npm run verify` exit 0, run in two parts, because the first run's screenshot step stopped on a variable-name clash; that is fixed and `screenshot.mjs` was re-run on its own.
  - html-validate 0 errors on 13 pages;
  - 240 links resolve, including the `#plan` and `#alerts` fragments, and every page is reachable;
  - 26 of 26 interaction checks pass;
  - grep-30 clean;
  - no JS errors or horizontal scroll at 1024 / 1280 / 1440 / 1920.

  Live on http://localhost:8731: `settings.html#plan` shows only Plan with "Plan" marked current, the nav has no Alerts, the section list is 240 px wide, and `alerts.html` returns 404.
- Numbers: contrast covers 64 page/state runs (13 pages, with every Settings panel opened): 42 unique pairs, all enabled text ≥ 4.5:1. The lowest are 4.51, 4.54 and 4.74; the disabled "Saved", 2.54, is exempt.
- Open questions / decisions needed: none
