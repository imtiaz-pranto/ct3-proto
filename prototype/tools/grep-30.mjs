// D2 check: the 3.0 state must not mention server-side features anywhere.
// Loads every page in 3.0 (Free and Pro, plus extra states), opens More
// settings and every collapsed events list, then searches the visible text
// and, separately, hidden DOM text. The prototype state bar is excluded.
// Usage (from prototype/tools): node grep-30.mjs
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const terms = ['3.1', 'backup sending', 'server', 'Conversions API', 'CAPI', 'Measurement Protocol', 'refund'];
// Hits that stay, with the reason. Matched against the snippet.
const keep = [
	['14-day refund', 'Purchase guarantee for buying Pro, not refund tracking.'],
];
const base = { version: '3.0', install: 'working', doctor: 'ran', connection: 'connected', doctorResult: 'findings', log: 'rows', oldPro: 'no', feed: 'ok' };
const runs = [];
for (const p of pages) for (const plan of ['free', 'pro']) runs.push([p, { plan }]);
runs.push(['index', { plan: 'free', install: 'new' }], ['index', { plan: 'pro', install: 'upgrade' }], ['whats-new', { plan: 'pro', oldPro: 'yes' }],
	['doctor', { plan: 'pro', feed: 'fail', feedId: 'sku' }], ['catalog', { plan: 'pro', feed: 'fail' }], ['log', { plan: 'pro' }]);

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
console.log(bad ? `\n${bad} leak(s) in 3.0.` : '\nNo server-side references in 3.0 apart from the kept hits above.');
process.exitCode = bad ? 1 : 0;
