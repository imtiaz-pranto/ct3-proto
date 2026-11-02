// 3.0 check: the 3.0 state must not mention server-side or other 3.1
// features anywhere (trimmed 3.0 scope, 2026-10-30). Loads every page in
// 3.0 (Free and Pro, plus extra states), opens every collapsed section, then
// searches the visible text and, separately, hidden DOM text. The prototype
// state bar is excluded. 3.1-only markup sits in <template data-v31>, which
// is not part of the 3.0 DOM.
// Usage (from prototype/tools): node grep-30.mjs
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const terms = ['3.1', 'backup sending', 'server', 'Conversions API', 'CAPI', 'Measurement Protocol', 'refund', 'weekly', 'digest', 'export', 'retention', 'loopback', 'Delivered', '401',
	// Widened 2026-11-02 after catalog.html promised daily feed checks in 3.0.
	'daily', 'every day', 'reachable', 'email', 'alert'];
// Hits that stay, with the reason. Matched against the snippet.
const keep = [
	['?action=wcct-product-export', 'The catalog feed URL. It must stay exactly as it was so Meta keeps fetching it after the update.'],
	['refreshes every day', 'Catalog Free preview: Meta fetches the feed on its own schedule. A Meta behaviour, not a CT check.'],
	['daily schedule', 'Catalog setup step in Meta Commerce Manager. The merchant sets the schedule in Meta.'],
	['customer_email', 'Custom script placeholder {customer_email}, one of the 11 kept in 3.0.'],
	['Alerts, who can manage', 'Settings > Alerts exists in 3.0 with the dashboard and Doctor rows only; emails are 3.1.'],
	['Alerts Integration access', 'Settings section list: the Alerts section name (3.0, dashboard and Doctor rows).'],
	['Plan Alerts We tell', 'Settings > Alerts panel title (3.0, dashboard and Doctor rows).'],
	['Every alert ends', 'Settings > Alerts description; 3.0 alerts are in-dashboard only.'],
];
const base = { version: '3.0', install: 'working', doctor: 'ran', connection: 'connected', doctorResult: 'findings', log: 'rows', oldPro: 'no', feed: 'ok', onbAt: '1' };
const runs = [];
for (const p of pages) for (const plan of ['free', 'pro']) runs.push([p, { plan }]);
runs.push(['index', { plan: 'free', install: 'new' }], ['index', { plan: 'pro', install: 'upgrade' }], ['index', { plan: 'pro', doctor: 'plugin' }], ['whats-new', { plan: 'pro', oldPro: 'yes' }],
	['doctor', { plan: 'pro', feed: 'fail', feedId: 'sku' }], ['doctor', { plan: 'pro', doctorResult: 'clear' }], ['catalog', { plan: 'pro', feed: 'fail', install: 'upgrade' }], ['log', { plan: 'pro' }],
	['onboarding', { plan: 'pro', onbPicked: 'meta,google,x,microsoft,custom', onbConnected: 'meta,google,x,microsoft', eu: 'yes', verified: 'yes' }],
	['settings', { plan: 'pro', install: 'upgrade' }], ['platforms', { plan: 'pro', install: 'upgrade' }], ['platforms-google', { plan: 'free', install: 'upgrade' }]);
for (const migration of ['done', 'progress', 'attention']) runs.push(['whats-new', { plan: 'free', install: 'upgrade', migration }], ['whats-new', { plan: 'pro', install: 'upgrade', migration }]);

const browser = await chromium.launch();
const hits = { visible: new Map(), hidden: new Map() };
for (const [name, state] of runs) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	await context.addInitScript((s) => window.localStorage.setItem('wcct-proto-v1', JSON.stringify(s)), { ...base, ...state });
	const page = await context.newPage();
	await page.goto(pathToFileURL(path.join(root, `${name}.html`)).href);
	await page.evaluate(() => {
		document.querySelectorAll('details').forEach((d) => { d.open = true; });
		document.querySelectorAll('[data-settings-panel]').forEach((p) => { p.hidden = false; });
	});
	// Every onboarding step, each rendered by the wizard.
	if (name === 'onboarding') {
		for (const step of [2, 3, 4, 5, 6]) {
			await page.goto(pathToFileURL(path.join(root, 'onboarding.html')).href + `?step=${step}`);
			await collect(page, `onboarding step ${step}`, state);
		}
	}
	// Every log row's detail panel too.
	if (name === 'log') {
		for (const id of await page.$$eval('[data-log-rows] tr', (r) => r.map((t) => t.dataset.id))) {
			await page.click(`[data-log-rows] tr[data-id="${id}"]`);
			await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
			await collect(page, `${name} #${id}`, state);
		}
	}
	await collect(page, name, state);
	await context.close();
}
async function collect(page, label, state) {
	const found = await page.evaluate((terms) => {
		document.getElementById('proto-state')?.remove();
		const vis = document.body.innerText;
		const all = document.body.textContent + ' ' + [...document.querySelectorAll('[title],[aria-label],[placeholder],img[alt]')].map((e) => [e.title, e.getAttribute('aria-label'), e.placeholder, e.alt].join(' ')).join(' ');
		const scan = (txt) => terms.flatMap((t) => {
			const re = new RegExp(t.replace('.', '\\.'), 'gi');
			const out = [];
			let m;
			while ((m = re.exec(txt))) out.push(`${t} :: …${txt.slice(Math.max(0, m.index - 50), m.index + t.length + 40).replace(/\s+/g, ' ')}…`);
			return out;
		});
		return { visible: scan(vis), all: scan(all) };
	}, terms);
	const where = `${label} (${state.plan}${Object.keys(state).length > 1 ? ', ' + JSON.stringify(state) : ''})`;
	for (const h of found.visible) hits.visible.set(h, (hits.visible.get(h) || []).concat(where));
	for (const h of found.all) if (!found.visible.includes(h)) hits.hidden.set(h, (hits.hidden.get(h) || []).concat(where));
}
await browser.close();
console.log(`Runs: ${runs.length} page/state runs in 3.0. Terms: ${terms.join(', ')}`);
let bad = 0;
for (const kind of ['visible', 'hidden']) {
	console.log(`\n${kind.toUpperCase()} hits: ${hits[kind].size}`);
	for (const [h, w] of hits[kind]) {
		const why = keep.find(([k]) => h.includes(k));
		if (!why) bad++;
		console.log(`- ${why ? 'KEPT' : 'LEAK'} ${h}${why ? `\n    why: ${why[1]}` : ''}\n    on ${[...new Set(w)].slice(0, 6).join('; ')}`);
	}
}
console.log(bad ? `\n${bad} leak(s) in 3.0.` : '\nNo 3.1 or server-side references in 3.0 apart from the kept hits above.');
process.exitCode = bad ? 1 : 0;
