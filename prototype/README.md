# Conversion Tracking 3.0: HTML prototype

Task 3.1 (prototype) in `CT-3.0-SCOPE.md`. A clickable prototype of the 3.0 admin UI in a simulated WP admin. Open `index.html` in any browser. No build step, no server, no network: every file loads from `file://`, the font is the system stack (plugin-ui `--font-sans`), and there is no CDN.

Opening a page straight from the Claude desktop app's file pane does not work: that preview loads the HTML as a `data:` URL, so the relative `assets/` paths resolve to nothing and the page shows unstyled. Open it from Finder in a normal browser, or serve the folder (the `ct-prototype` entry in `CT/.claude/launch.json` runs `python3 -m http.server 8731` on `prototype/`, then open http://localhost:8731/).

It is review material and a spec for the React build (task 3.3 onward). It is not product code: `assets/app.js` only fakes states and is thrown away.

## The state bar (prototype only)

Bottom-right, dark, labelled **PROTOTYPE**. It starts collapsed so it never covers a Save button; click it to open. It remembers open or closed.

| Control | Options | What it changes |
|---|---|---|
| Plan | Free, Pro | Pro badges and locked rows, upgrade cards, Pro-only fields (second pixel, Enhanced conversions, role access, UET tag; in 3.1 also log search and export and alert emails), the "Pro 3.0.0" version pill |
| Install | New, Upgraded, Working | New: the dashboard opens the onboarding wizard once, then shows the unfinished setup steps with Continue setup. Upgraded: "Updated to 3.0" banner and the Migration state. Working: the normal state |
| Migration | Done, In progress, Needs attention | Shown only when Install is Upgraded. What's new shows the matching card; Needs attention (default) also drives the X re-setup notice, the Google ID split notice and the dashboard's X card |
| Version | 3.0, 3.1 | 3.0 (default) is the trimmed 3.0 scope: no server-side features, no emails, no log retention, search or export, no scheduled or storefront Doctor checks, no refunds. 3.1 adds those, plus server sending to platforms whose flag is on in `assets/config.js` (Meta today). 3.1-only markup lives in `<template data-v31>` (3.0-only in `<template data-v30>`), stamped at load, so the 3.0 DOM has no trace of it. Changing Version reloads the page |
| Server | Not connected, Connected | Shown only in 3.1. Not connected: the token steps. Connected: what's sent, last 7 days, customer details, connection and Test mode |
| Per screen | see below | Only the states that screen has |

Per-screen states: Dashboard (Doctor ran, not run, plugin added = the quiet re-check card), Platforms Meta / X / Microsoft (connected, not connected), Activity log (with rows, empty), Doctor (findings, all clear; in 3.1 also catalog feed healthy, unreachable), Catalog (3.1: feed healthy, unreachable), What's new (old Pro 1.1.4 not installed, detected). Onboarding opens at the furthest step reached; `onboarding.html?step=N` jumps to a step. Meta's "Product ID sent" and Catalog's "ID used in the feed" share state, so changing either one updates the Catalog warning and the Doctor. A **Screen** menu jumps to any page, including the ones the nav doesn't reach (Pick platforms, What's new, Weekly email). **Reset all states** restores the defaults.

State lives in `localStorage` under `wcct-proto-v1`, so it survives navigation. If storage is blocked (private window), it works per page.

Things that are interactive without the state bar: the onboarding wizard (Start, tile picking, IDs checked as you type, the Europe answer, the prototype-only Simulate first event, Skip for now and Continue setup), role access with its confirmation dialog (Pro), tile picking with a live count, Pause tracking (confirm dialog, then Paused and Resume), the Google radio and field checks, the events table (Recommended / All / Custom, Show more, Pro locks), Advanced settings, Custom script placements, the Catalog category search and Copy URL, the 3.1 Connect flow and Test mode, the Help drawer below 1280 px, log tabs, row detail (a dialog under 1100 px) and search (Pro, 3.1), Doctor "Check my store" (2 s), Check again on a finding, and Dismiss with Undo, Settings sections by URL hash, alert "Send a test", dashboard filter chips and chart period, the Help menu.

## Feasibility decisions applied (2026-11-03)

`CT/FEASIBILITY-3.0.md` §0 records them. In the prototype:

- **X:** optional event-ID fields for Add to cart, Start checkout and Registration (Pro); each row stays off with "Needs its event ID" until its ID is filled in (`config.js` `needsId`).
- **Page view:** locked on for X and Microsoft ("Always on", `always`).
- **Google:** a Registration conversion label field (Pro).
- **Meta:** no pixel name in the ID hint.
- **Plan:** Pro links to WooCommerce.com instead of "Active until [DATE]".
- **Dashboard:** reads the last 24 hours. Stats are 4 purchases tracked and 1 missed, matching the Activity log. The chart shows purchases per hour, sent or missed, with no period select. The missed card names the order and the cause, and declined cookies aren't counted.
- **Last seen:** shows a time for Purchase only; other events show "On".
- **Onboarding:** the usage-data opt-in is gone. The X panel notes the other IDs. Verify opens a test link.
- **Order value:** upgraders keep "Items, tax and shipping" on Meta, X and Microsoft.
- **Custom parameters (Meta, Pro):** up to 5, each with an event, a field name and one of 5 tokens.
- **Catalog:** optional feed login (off) with username and password; variation copy.
- **Custom script:** admin-only notice; the role dialog says granted roles can change pixel IDs but not scripts.

## File map

| File | Screen | Reference artboard |
|---|---|---|
| `index.html` | Dashboard | `mockup-ref/Main.dc.html` |
| `onboarding.html` | New-install wizard: Welcome, Platforms, Connect, Europe, Verify, Done. Replaces `pick-platforms.html` (its tiles are step 2) | `PickPlatforms.dc.html` for step 2 |
| `platforms.html` | Platforms, Meta selected (master-detail) | `Platforms.dc.html` |
| `platforms-google.html` | Google one flow | `GoogleFlow.dc.html` |
| `platforms-x.html` | X, with the re-setup notice for upgraders | thin variant of `Platforms.dc.html` |
| `platforms-microsoft.html` | Microsoft Advertising: Pro lock in Free, UET tag in Pro | thin variant of `Platforms.dc.html` |
| `platforms-custom.html` | Custom script: three placements and the 11 placeholders | replaces the old Advanced page's script card |
| `catalog.html` | Catalog (Meta tab): feed status, product IDs, exclusions, setup steps; Pro lock in Free | new, 2026-10-28 |
| `settings.html` | Settings with a section list: Alerts (default, `#alerts`), Integration access by role (Pro, `#access`), Setup (`#setup`: Run setup wizard again, which opens `onboarding.html?rerun=1` on a draft filled from the current settings; Close without saving leaves state untouched, finishing returns to Settings; the real build saves the draft) and Plan with the Free / Pro comparison (`#plan`). Replaces the old Alerts page | `Alerts.dc.html` for the Alerts and Plan sections |
| `log.html` | Activity log | `Log.dc.html` |
| `doctor.html` | Tracking Doctor. 3.0: 7 checks on local data (6 on Free), collapsed Working list. 3.1: the extended checks | `Doctor.dc.html` |
| `whats-new.html` | Upgrader "what's new", with the migration states and the previous-settings download | `WhatsNew.dc.html` |
| `email-weekly.html` | Weekly health email, 640 px, no app chrome. 3.1 only | `WeeklyEmail.dc.html` |
| `assets/tokens.css` | Design tokens (plugin-ui's, plus CT overrides and additions) | |
| `assets/components.css` | One class per plugin-ui component, layout helpers, breakpoints | |
| `assets/email.css` | Email preview only | |
| `assets/icons.js` | lucide paths used here | |
| `assets/config.js` | Platform config: events per platform and the server sending flag. The one place to change either | |
| `assets/app.js` | State bar, simulated WP chrome and top bar, events table, server sending section, page behaviour | |
| `assets/logos/` | Platform marks + `LOGO-SOURCES.md` | |
| `screenshots/` | `<page>-free.png`, `<page>-pro.png` at 1440 px; `1920/` the same at 1920 px; `states/` (and `1920/states/`) extra states, 3.1 Meta states and 1024 px layouts | |
| `tools/` | Review tooling (Node, not needed to open the prototype) | |

## What carries into the real theme (task 0.4)

The look follows `@wedevs/plugin-ui` as it is on GitHub (getdokan/plugin-ui `acc2771`, 2026-09-30): its token names and values from `src/styles.css`, and each component's size, radius, weight, shadow and states from its Tailwind classes in `src/components/`. In the React build these are the real plugin-ui components, so nothing here is re-implemented; the CSS only shows the result without a build.

### Tokens

`tokens.css` holds every plugin-ui token under its own name (`--background` … `--chart-5`, `--radius` and the `--radius-sm/md/lg/xl` scale, `--shadow-xs/sm/md/lg`, `--font-sans`, `--font-mono`). Only four differ from plugin-ui's defaults, and they are what CT passes to `ThemeProvider tokens`:

| Token | CT value | plugin-ui default | Why |
|---|---|---|---|
| `--primary` | `oklch(0.52 0.13 248)` | `oklch(0.205 0 0)` | Texty 2.0's blue, close to WP `#2271b1` |
| `--primary-foreground` | `oklch(1 0 0)` | `oklch(0.985 0 0)` | Texty 2.0 |
| `--ring` | same as primary | `oklch(0.708 0 0)` | Texty 2.0 |
| `--success` | `oklch(0.696 0.17 162)` (emerald) | `oklch(0.647 0.178 145)` | The brief: fixes Texty's success = primary |

CT additions on top of plugin-ui (need a yes):

| Token | Why |
|---|---|
| `--pro` `#FFBC00` | plugin-ui's `TopBar` default (`proBadgeBg`), so nothing to pass. Decision 1, 2026-10-28 |
| `--page-muted-foreground` `oklch(0.48 0 0)` | `--muted-foreground` is 4.2:1 on the WP admin grey `#f0f0f1`; text that sits on the grey needs 4.5:1 |
| `--tone-{ok,warn,bad,off}-{bg,fg,dot}` | The status tone map: Texty puts these Tailwind palette classes on `Badge`; CT names them once |
| `--card-ring`, `--primary-5/10/30`, `--primary-hover`, `--ring-50`, `--warning-10`, `--info-10`, `--success-10`, `--destructive-10`, `--muted-50`, `--pro-soft` | `color-mix()` stand-ins for Tailwind opacity modifiers (`ring-foreground/10`, `bg-primary/10`, `ring-ring/50`, `bg-warning/10`, `bg-muted/50` …). Not new colours; in React they are just the class names |

Do not carry: `--wp-*` and the layout variables (prototype scaffolding).

### Component classes and the plugin-ui component they show

| Class | plugin-ui component and key classes |
|---|---|
| `.card`, `.card-head`, `.card-body`, `.card-foot`, `.card-row` | `Card` (rounded-xl = 14px, ring-1 ring-foreground/10, shadow-xs, px-6 py-6); `CardTitle` text-base font-medium |
| `.notice` + `.warning .info .success .destructive` | `Notice` (border-l-[3px], rounded-[3px], bg-{tone}/10, px-4 py-3), used for every page-level message |
| `.pill` + `.ok .warn .bad .off .outline` (`.is-dot` = dot only) | `Badge` (h-5, rounded-4xl, px-2, text-xs font-medium) with the CT tone classes; `.outline` = `variant="outline"`; `.bad` is for log rows only |
| `.tag` | `Badge variant="secondary"` |
| `.version-badge`, `.version-crown` | `TopBar` `versions` (outline Badge; Pro adds the 26px round badge with `CrownIcon`) |
| `.pro-badge`, `data-icon="pui-crown"` | `CrownIcon` + "PRO" on `--pro` (CT pattern; plugin-ui has no PRO pill) |
| `.btn` + `.primary .secondary .outline .ghost .destructive .outline-destructive .link .pro`, sizes `.xs .sm .lg .icon-only` | `Button` (h-9, px-2.5, gap-1.5, rounded-md, text-sm font-medium, focus: CT draws a 2px `--ring` outline 2px out instead of plugin-ui's ring-3 ring-ring/50, see `TOKENS-PROPOSAL.md`; disabled opacity-50). `.outline` is plugin-ui's border-primary text-primary; `.pro` = `TopBar.UpgradeBtn` |
| `.link-danger` | `Button variant="link"` in the destructive colour (Texty's red Deactivate link, here "Pause tracking") |
| `.switch` (checkbox with `role="switch"`) | `Switch` (30 × 18.4px track, 14px thumb, bg-input off / bg-primary on) |
| `.field`, `.field-label`, `.input`, `.select`, `textarea`; `.field-hint / .field-good / .field-bad` | `Field`, `FieldLabel` (text-sm font-medium), `FieldDescription`, `Input` / `Select` / `Textarea` (h-9, rounded-md, border-input, shadow-xs). "Bad" is amber, never red |
| `.radio-card` | `FieldLabel` wrapping a `Field` with `RadioGroupItem` (border, rounded-md, p-3; checked bg-primary/5 border-primary/30; radio size-4.5) |
| `.option-row`, `.event-row` | Settings field row (p-4, title text-sm font-semibold, description text-xs muted); `.event-row` body follows its switch (Texty `collapsible_switch`) |
| `.stat-card` | `MatricsCard` (p-5, ring-border, but 14px corners like every card: CT overrides plugin-ui's rounded-[3px], 2026-11-02; no shadow; 52px icon circle bg-primary/10; value font-bold text-lg; 12px description) |
| `.tabs`, `.chips` | `Tabs` default variant (bg-muted list h-9 p-[3px], trigger font-medium text-foreground/60, active bg-background shadow-sm) |
| `.topbar-nav` | `Tabs variant="line"` (active border-b-2 border-b-primary text-primary) |
| `.topbar` | `TopBar` (66px, logo, versions, `rightSideComponents` with the Help button) |
| `.menu` | `DropdownMenu` (rounded-md p-1 shadow-md ring-1; items rounded-sm px-2 py-1.5, hover bg-accent) |
| `.dialog` | `AlertDialog` (rounded-xl p-6 ring-1, overlay black/10 + blur-xs); `.is-wide` = `Dialog` (rounded-lg, overlay black/50 + blur-sm) |
| `.toast` | sonner `Toaster` |
| `.data-table`, `.table-toolbar`, `.table-foot`, `.empty`, `.card.is-dataviews` | `DataViews` with plugin-ui's `wordpress/style.css` (14px corners like every card, where plugin-ui draws 6px, 2026-11-02; 20px edge cells, bg-accent on hover and selected rows, 128px empty-state circle) |
| `.pick-tile` | Selection card (rounded-xl border, checked border-primary bg-primary/5) with a `Checkbox` tick |
| `.platform-card`, `.platform-list-item`, `.master-detail`, `.detail-*`, `.help`, `.finding`, `.check-row`, `.summary-card`, `.timeline`, `.upgrade-card` | CT layouts built from `Card`, `Badge` and `Button` (Texty Gateway master-detail, Doctor, log detail, inline upgrade) |
| `.wp-chrome` (`.wp-adminbar`, `.wp-adminmenu`, `.wp-content`) | Not built: WP core |
| `.state-bar` | Not built: prototype only |

Layout: full width beside the WP menu with 32 px side padding, no max-width. Platforms: list 240 px, main column fluid, help 320 px. Text inputs stop at 560 px; one setting per line. Breakpoints: below 1280 px the help column becomes a drawer opened by the ? button; at 1180 px the top bar drops the version pills; at 1100 px the dashboard grids go to 2 columns and the log detail moves into a dialog; at 900 px the platform list stacks above the panel. 1024 px with the WP menu open (864 px content) is the narrowest layout tested.

## Tools

```bash
cd prototype/tools && npm install && npm run verify
```

`verify` runs, in order: `html-validate` on the page files (`html-validate:recommended`), `check-links.mjs` (every local link and asset resolves from `file://`, every page is reachable), `contrast.mjs` (every visible text colour against the background it sits on, all pages and states, threshold 4.5:1; since 2026-11-02 it also focuses every enabled control and checks the focus ring against the surface it sits on, threshold 3:1; it also saves the rendered DOM to `tools/rendered/` and validates that too), `interactions.mjs` (43 checks, including layout, the help drawer, one setting per line, the events table, Catalog, Settings, role access, onboarding, migration, the Doctor and 3.1 server sending), `grep-30.mjs` (no 3.1 or server-side terms anywhere in the 3.0 state: 3.1, server, weekly, digest, export, retention, loopback, refund, Delivered, 401, daily, every day, reachable, email, alert and more, with an allow-list that says why each kept hit stays) and `screenshot.mjs` (Free and Pro at 1440 and 1920 px, extra states, 3.1 states, and a horizontal-scroll check at 1024 / 1280 / 1440 / 1920). Contrast covers every page in both plans and both versions.
