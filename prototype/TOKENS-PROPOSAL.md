# Token proposal for the plugin-ui team

From: Conversion Tracking 3.0 (CT), design decision D4, locked 2026-11-02.
Baseline: `@wedevs/plugin-ui` at getdokan/plugin-ui `acc2771` (2026-09-30), `src/styles.css`.

CT uses every plugin-ui token under its own name. It adds two things that plugin-ui has no token for. Both are defined in `prototype/assets/tokens.css`. In the React build, CT would pass them through `ThemeProvider tokens` until plugin-ui adopts them. We are asking whether plugin-ui wants to own them, so other weDevs plugins in WP admin get the same values.

Contrast figures are WCAG 2.x ratios, measured from the sRGB values Chrome paints.

## 1. `--page-muted-foreground`

| | |
|---|---|
| Name | `--page-muted-foreground` |
| Value | `oklch(0.48 0 0)` (renders `#5d5d5d`) |
| Purpose | Secondary text that sits straight on the WP admin page background (`#f0f0f1`), not inside a card |
| Contrast | 5.78:1 on `#f0f0f1`, 6.58:1 on white |

**Where CT uses it (8 rules):**

| Selector | What it is |
|---|---|
| `.page-sub` | Subtitle under each page title (every page) |
| `.section-label.is-quiet` | Quiet section labels on the page background |
| `.field.is-compact > label` | Compact field labels |
| `.set-head p` | Section descriptions on Catalog ("Product IDs", "Leave out of the feed") |
| `.pick-tile.is-soon` | The "TikTok and Pinterest arrive later" tile in onboarding |
| `.pick-count` | "N selected" count in onboarding step 2 |
| `.lead` | Lead paragraph on onboarding and What's new |
| `.email-meta` (`email.css`) | Date and sender line in the email preview |

**Why no plugin-ui token covers it:** `--muted-foreground` (`oklch(0.556 0 0)`, `#737373`) is built for card and popover surfaces. On white it passes (4.74:1), but on the WP admin grey `#f0f0f1` it is 4.16:1, below the 4.5:1 that body text needs. plugin-ui has no token for "muted text on the host page background", because its own surfaces are always `--background` or `--card`. Any plugin-ui consumer that puts muted text directly on the WP admin page hits the same gap.

**Suggested shape in plugin-ui:** either this token as is, or darken `--muted-foreground` to about `oklch(0.50 0 0)` so one token passes on both white and `#f0f0f1`. The second option changes every plugin-ui consumer, so it is plugin-ui's call.

## 2. Status tone map: `--tone-{ok,warn,bad,off}-{bg,fg,dot}`

| Token | Value | Tailwind name | Contrast |
|---|---|---|---|
| `--tone-ok-bg` | `#d1fae5` | emerald-100 | |
| `--tone-ok-fg` | `#047857` | emerald-700 | 4.84:1 on ok-bg, 5.48:1 on white |
| `--tone-ok-dot` | `#10b981` | emerald-500 | dot only, no text |
| `--tone-warn-bg` | `#fef3c7` | amber-100 | |
| `--tone-warn-fg` | `#b45309` | amber-700 | 4.51:1 on warn-bg, 5.02:1 on white |
| `--tone-warn-dot` | `#f59e0b` | amber-500 | dot only |
| `--tone-bad-bg` | `#ffe4e6` | rose-100 | |
| `--tone-bad-fg` | `#be123c` | rose-700 | 5.24:1 on bad-bg, 6.29:1 on white |
| `--tone-bad-dot` | `#f43f5e` | rose-500 | dot only |
| `--tone-off-bg` | `#f3f4f6` | gray-100 | |
| `--tone-off-fg` | `#4b5563` | gray-600 | 6.87:1 on off-bg, 7.56:1 on white |
| `--tone-off-dot` | `#9ca3af` | gray-400 | dot only |

**Purpose:** one named set of colours for status: a pill, a dot, an icon circle or a line of hint text that says "working", "needs a look", "failed" or "off". `bad` is used for Activity log rows only; everywhere else a problem is `warn` (amber), never red.

**Where CT uses it (58 references in `components.css`):**

| Component | Tokens |
|---|---|
| `.pill.ok / .warn / .bad / .off` (plugin-ui `Badge` with a tone class) and their dots | all four tones, bg + fg + dot |
| `.field-good`, `.field-bad`, `.field.is-bad input` (ID checked as you type) | ok-fg, warn-fg, warn-dot |
| `.stat-icon.is-ok / .is-warn / .is-off` (Dashboard `MatricsCard` icons) | bg + fg |
| `.summary-icon.ok / .warn` (Doctor and What's new summary cards) | bg + fg |
| `.step-icon`, `.check-dot.is-done`, `.step.is-done` (onboarding, setup checklist) | ok and warn |
| `.timeline li` dots (log detail) | ok, warn, off dots |
| `.ev-seen` "Last seen" dot (events table) | ok-dot |
| Quiet text on tinted or selected surfaces: `.finding-why`, `.notice .muted`, `.compare-table` row heads, `.feed-url-label`, `.pick-box-bar`, `.dev-list dt`, `.onb-verify-text`, selected log row | off-fg |
| `.feature-list .icon`, `.toast .icon` (check marks) | ok-fg |
| `.crown-link` (inline "Pro" upsell link) | warn-fg |

**Why no plugin-ui token covers it:** plugin-ui has `--success`, `--warning`, `--destructive` and `--info` as solid fills meant to carry white or dark foreground text (buttons, `Notice` borders). Used as text on their own 10 % tint, the way a status pill needs, they fail:

| plugin-ui token | As text on its own `/10` tint | As text on white |
|---|---|---|
| `--success` `#00bc7c` | 2.25:1 | 2.48:1 |
| `--warning` `#fe9a00` | 1.98:1 | 2.13:1 |
| `--destructive` `#e7000b` | 4.01:1 | 4.77:1 |
| `--info` `#0083ff` | 3.27:1 | 3.69:1 |

There is also no neutral "off / not set up" status token. `--muted-foreground` on `--muted` is 4.35:1, below 4.5:1. Texty 2.0 solves this by putting Tailwind palette classes (`bg-emerald-100 text-emerald-700` …) straight on `Badge`. That works, but each plugin picks its own shades. Naming the map once in plugin-ui keeps every weDevs plugin's status colours the same and keeps them at 4.5:1 or better.

**Suggested shape in plugin-ui:** a `tone` prop on `Badge` (`ok | warn | bad | off`) backed by these 12 tokens, so consumers stop passing palette classes.

## 3. Focus indicator

Not a new token: a change to how plugin-ui uses `--ring`.

**The problem.** plugin-ui shows keyboard focus as `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`: the border turns `--ring` and a 3px glow at 50 % opacity appears. With CT's `--ring` (`#166daf`), that glow paints `#83afd0` on the WP admin grey and `#8bb6d7` on white, which is **2.05:1** and **2.15:1** against the surface. WCAG 1.4.11 asks for 3:1. The glow is often the only change:

| Control | What changes on focus |
|---|---|
| `Button` outline variant | Nothing but the glow; its border is already `--primary` |
| `Button` default (primary), destructive, Pro | Nothing but the glow; the border change is hidden by the fill |
| `Switch` when on, `Checkbox` and `RadioGroupItem` when checked | Nothing but the glow; already `--primary` |
| Selection card when selected | Nothing but the glow |
| `Input` in an error state | The border keeps its error colour, so only the glow |

Measured in the prototype on 2026-11-02, before the fix: the outline button "Run the Doctor" on the Dashboard showed no visible change apart from a 2.05:1 glow.

**The CT fix.** Every control that relied on the glow now shows a solid 2 px `--ring` outline, 2 px out from the control, and nothing on mouse clicks (`:focus-visible`):

```css
.btn:focus-visible,
.switch input:focus-visible + .switch-track,
.radio-card input:focus-visible,
.check input:focus-visible,
.pick-tile:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; box-shadow: none; }
.input:focus-visible,
.select:focus-visible /* and .field controls */ { outline: 2px solid var(--ring); outline-offset: 2px; border-color: var(--ring); box-shadow: none; }
```

The 2 px gap shows the surface the control sits on, so the ring is measured against that surface. `tools/contrast.mjs` now focuses every enabled control on every page and state (86 runs) and checks this. Result: 9 ring/surface pairs, all at least 3:1. The lowest is **4.80:1** (`#166daf` on the WP grey `#f0f0f1`). The highest is 9.41:1 (`--pro` ring on the dark prototype bar). Links already had this outline from the global `:focus-visible` rule.

**Suggested plugin-ui change.** In the shared focus classes (Button, Input, Select, Textarea, Switch, Checkbox, RadioGroupItem, selection card), replace `focus-visible:ring-3 focus-visible:ring-ring/50` with `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`, and keep `focus-visible:border-ring` on fields. One change in plugin-ui gives every consumer a focus ring at full `--ring` strength. With plugin-ui's default `--ring` (`oklch(0.708 0 0)`, `#a1a1a1`) a solid ring is 2.6:1 on white, so plugin-ui would also need a darker default ring, about `oklch(0.55 0 0)` (≈ 4.9:1 on white), or to document that consumers must pick a `--ring` of 3:1 or better.

## Not part of this proposal

`--pro` (`#FFBC00`) is plugin-ui's own `TopBar` `proBadgeBg` default, so it needs nothing new. The `color-mix()` helpers in `tokens.css` (`--primary-5`, `--primary-10`, `--card-ring` and the rest) stand in for Tailwind opacity modifiers like `bg-primary/10`; in React they are class names, not tokens. The `--wp-*` and layout variables are prototype scaffolding.
