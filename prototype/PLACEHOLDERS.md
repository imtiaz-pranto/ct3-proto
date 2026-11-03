# Placeholders in the CT 3.0 prototype

Design decision D9, locked 2026-11-02: the placeholders stay until real values exist. This file lists every one, by page and location. Line numbers are for `CT/prototype` as of 2026-11-03. `[DATE]` was removed on 2026-11-03 (feasibility decision B4: Pro has no licence data); Pro now links to its WooCommerce.com subscription (L28).

"Version" says where it shows: **3.0 and 3.1**, **3.0 only** (inside `<template data-v30>`), or **3.1 only** (inside `<template data-v31>`).

## How each kind looks

| Kind | Look | Where it is defined |
|---|---|---|
| Text value (price, date) | `[PRICE]` in a dashed box, mono font, same colour as the text around it (class `.ph`) | `assets/components.css`, after `.clip` |
| Setup clip | 140 px bordered box, play icon in the brand blue, "Clip: <what it shows>, <length>" in muted text (class `.clip`) | `assets/components.css` `.clip` |
| Link with no target yet | A normal link or button with `href="#"`, styled like every live link | no special class |

All six clips already used one class. `[PRICE]` uses `.ph` (the only text value left since `[DATE]` was removed). Links are left looking like live links on purpose, so screenshots read as the real product.

## Text values (1)

| # | Placeholder | Page | Location | Version |
|---|---|---|---|---|
| T1 | `[PRICE]` | `settings.html:227` | Settings > Plan, Pro column, line under "Upgrade to Pro" (Free plan) | 3.0 and 3.1 |

## Setup clips (6)

| # | Page | Location | Text | Version |
|---|---|---|---|---|
| C1 | `platforms.html:179` | Meta, help column, under the setup steps | Clip: finding the Pixel ID, 20 s | 3.0 and 3.1 |
| C2 | `platforms-google.html:154` | Google, help column | Clip: finding the conversion label, 25 s | 3.0 and 3.1 |
| C3 | `platforms-x.html:143` | X, help column | Clip: creating the X purchase event, 30 s | 3.0 and 3.1 |
| C4 | `platforms-microsoft.html:144` | Microsoft, help column | Clip: finding the UET tag ID, 20 s | 3.0 and 3.1 |
| C5 | `platforms-custom.html:110` | Custom script, help column | Clip: adding a purchase tag with placeholders, 30 s | 3.0 and 3.1 |
| C6 | `catalog.html:239` | Catalog (Pro), help column, under the 7 setup steps | Clip: connecting the feed in Commerce Manager, 45 s | 3.0 and 3.1 |

## Links with no target yet (`href="#"`)

### Docs and help (our own pages)

| # | Page | Location | Link text | Version |
|---|---|---|---|---|
| L1 | `platforms.html:39` | Meta, panel header description | Learn more | 3.0 and 3.1 |
| L2 | `platforms-google.html:39` | Google, panel header description | Learn more | 3.0 and 3.1 |
| L3 | `platforms-x.html:39` | X, panel header description | Learn more | 3.0 and 3.1 |
| L4 | `platforms-microsoft.html:39` | Microsoft, panel header description | Learn more | 3.0 and 3.1 |
| L5 | `platforms-custom.html:39` | Custom script, panel header description | Learn more | 3.0 and 3.1 |
| L6 | `platforms.html:164` | Meta, Advanced settings, developer block | Hook reference | 3.0 and 3.1 |
| L7 | `platforms-google.html:139` | Google, Advanced settings, developer block | Hook reference | 3.0 and 3.1 |
| L8 | `platforms-x.html:128` | X, Advanced settings, developer block | Hook reference | 3.0 and 3.1 |
| L9 | `platforms-microsoft.html:130` | Microsoft, Advanced settings, developer block | Hook reference | 3.0 and 3.1 |
| L10 | `doctor.html:80` | Doctor, finding "cookie choices without a consent plugin" | See compatible plugins | 3.0 only |
| L11 | `doctor.html:106` | Doctor, finding "GTM plugin" | How to check | 3.0 only |
| L12 | `doctor.html:184` | Doctor 3.1, consent finding | See compatible plugins | 3.1 only |
| L13 | `doctor.html:221` | Doctor 3.1, GTM finding, end of the why line | How to check in 2 minutes | 3.1 only |
| L14 | `assets/app.js:271` | Top bar Help (?) menu, every page (1280 px and wider) | Docs | 3.0 and 3.1 |
| L15 | `assets/app.js:272` | Top bar Help (?) menu | Support | 3.0 and 3.1 |
| L16 | `assets/app.js:273` | Top bar Help (?) menu | Feature request | 3.0 and 3.1 |
| L17 | `assets/app.js:297-299` | Help drawer footer below 1280 px (Docs, Support, Feature request: same targets as L14 to L16) | Docs / Support / Feature request | 3.0 and 3.1 |
| L18 | `onboarding.html:68` | Onboarding step 2, "Pinterest arrives in a later update" tile | Tell us if you need it sooner. | 3.1 only |
| L19 | `assets/app.js:764` | Meta, Server sending, step 1 (create an access token) | How to create one | 3.1 only |

### Platform dashboards (outside sites)

| # | Page | Location | Link text | Version |
|---|---|---|---|---|
| L20 | `platforms.html:174` | Meta, help column, setup step 1 | Meta Events Manager | 3.0 and 3.1 |
| L21 | `platforms-google.html:149` | Google, help column, setup step 1 | Google Ads | 3.0 and 3.1 |
| L22 | `platforms-x.html:138` | X, help column, setup step 1 | X Ads Manager | 3.0 and 3.1 |
| L23 | `platforms-microsoft.html:139` | Microsoft, help column, setup step 1 | Microsoft Advertising | 3.0 and 3.1 |
| L24 | `catalog.html:230` | Catalog (Pro), help column, setup step 1 | Commerce Manager | 3.0 and 3.1 |

### Store and purchase actions

| # | Page | Location | Link text | Version |
|---|---|---|---|---|
| L25 | `settings.html:226` | Settings > Plan, Pro column (Free plan). Target in 3.0: the WooCommerce.com product page (Pro sold only there, decided 2026-11-03) | Upgrade to Pro | 3.0 and 3.1 |
| L26 | `whats-new.html:25` | What's new, old Pro 1.1.4 detected banner | Update Pro | 3.0 and 3.1 |
| L27 | `onboarding.html:215` | Onboarding step 5 (Verify), opens the storefront through a test link | Open your store | 3.0 and 3.1 |
| L28 | `settings.html:229` | Settings > Plan, Pro column (Pro plan), replaces "Active until [DATE]". Target in 3.0: the buyer's WooCommerce.com subscriptions page | Manage your subscription on WooCommerce.com | 3.0 and 3.1 |

### Count

28 link placeholders in all (L17 counts once, as it repeats L14 to L16 in the drawer). In the 3.0 view: 24 (L12, L13, L18 and L19 are 3.1 only).

## Not listed here

- The simulated WordPress chrome links in `assets/app.js:222-236` (admin bar, WooCommerce menu). WP core owns them; they are not CT placeholders.
- Sample data that stands in for a real store: chart dates and order values in `assets/app.js`, the sample Pixel ID, the Catalog feed figures (248 products, 31 left out, 06:00 / 06:02) and the feed URL, the Weekly email dates. These are demo content, not values waiting for a decision.
