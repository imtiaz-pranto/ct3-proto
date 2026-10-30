# Conversion Tracking 3.0 prototype

**Confidential. Internal to weDevs. Do not share outside the company.**

A clickable HTML prototype of the Conversion Tracking 3.0 admin UI, shown inside a simulated WP admin. It is review material and a spec for the React build, not product code. `prototype/README.md` has the full file map and design notes. `CT-3.0-SCOPE.md` is the plan of record.

## Run it

```bash
python3 -m http.server 8731 --bind 127.0.0.1 --directory prototype
```

Then open http://localhost:8731.

## The States panel

The dark **PROTOTYPE** bar in the bottom-right corner fakes product states. Click it to open.

| Control | What it changes |
|---|---|
| Plan | Free or Pro: Pro badges and locked rows, upgrade cards, Pro-only fields |
| Install | New (welcome banner, nothing connected), Upgraded ("Updated to 3.0" banner, X re-setup notice), Working (normal state) |
| Version | 3.0 (no server-side features) or 3.1 (server sending for platforms flagged in `assets/config.js`) |
| Server | Shown only in 3.1. Not connected (token steps) or Connected (delivery stats, Test mode) |
| Screen | Jumps to any page, including ones the nav doesn't reach (Pick platforms, What's new, Weekly email) |

Each screen also has its own states, and **Reset all states** restores the defaults. State is kept in `localStorage` under `wcct-proto-v1`.

## Review tooling

`prototype/tools/` holds the checks (HTML validation, links, contrast, interactions, the 3.0 server-text grep, screenshots). Screenshots and rendered output are gitignored.

```bash
cd prototype/tools && npm install && npm run verify
```

## Change history

See [REVAMP-LOG.md](REVAMP-LOG.md).
