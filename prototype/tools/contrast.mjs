// Measures the contrast of every visible text element against the background
// it actually sits on, on every page, in Free and Pro and the extra states.
// Colours are normalised through a canvas, so oklch() and color-mix() tokens
// are measured exactly as Chrome paints them. Threshold: 4.5:1 for all text
// (stricter than WCAG's 3:1 for large text). Disabled controls are reported
// apart, since WCAG exempts them.
// Also saves the rendered DOM of each page to tools/rendered/ so the
// JS-built parts (shell, log rows, state bar) can be validated too.
// Usage (from prototype/tools): node contrast.mjs
import { chromium } from 'playwright';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const renderedDir = path.join(here, 'rendered');
mkdirSync(renderedDir, { recursive: true });
const pages = readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const base = { install: 'working', doctor: 'ran', connection: 'connected', doctorResult: 'findings', log: 'rows', oldPro: 'no', onbAt: '1' };
const wizard = { onbPicked: 'meta,google,x,microsoft,custom', onbConnected: 'meta,google,x', eu: 'yes' };
// Opens the role access modal on the Access panel.
const openRole = (page) => page.click('label:has(input[value="customer"])');
const runs = [];
// Every page in both plans and both versions (3.1 with the server connected).
for (const p of pages) for (const plan of ['free', 'pro']) {
	runs.push([p, { plan }]);
	runs.push([p, { plan, version: '3.1', server: 'connected' }]);
}
runs.push(['platforms', { plan: 'free', version: '3.1', server: 'not' }], ['platforms', { plan: 'pro', version: '3.1', server: 'not' }]);
runs.push(['index', { plan: 'free', install: 'new' }], ['index', { plan: 'free', install: 'upgrade' }], ['index', { plan: 'pro', doctor: 'not' }],
	['platforms', { plan: 'free', connection: 'not' }], ['platforms-x', { plan: 'free', install: 'upgrade' }], ['log', { plan: 'free', log: 'empty' }],
	['doctor', { plan: 'free', doctorResult: 'clear' }], ['whats-new', { plan: 'pro', oldPro: 'yes' }],
	['catalog', { plan: 'pro', feed: 'fail', feedId: 'sku' }], ['doctor', { plan: 'pro', feed: 'fail', feedId: 'sku' }],
	['index', { plan: 'free', install: 'new', onbAt: '4' }], ['index', { plan: 'pro', doctor: 'plugin' }], ['catalog', { plan: 'pro', install: 'upgrade' }],
	['settings#access', { plan: 'pro' }, openRole], ['settings#access', { plan: 'pro', install: 'upgrade' }]);
for (const step of [2, 3, 4, 5, 6]) for (const plan of ['free', 'pro']) runs.push([`onboarding?step=${step}`, { plan, ...wizard, verified: step === 6 ? 'yes' : 'no' }]);
runs.push(['onboarding?step=5', { plan: 'free', ...wizard, verified: 'yes' }]);
for (const migration of ['done', 'progress', 'attention']) for (const plan of ['free', 'pro']) runs.push(['whats-new', { plan, install: 'upgrade', migration }]);

const browser = await chromium.launch();
const pairs = new Map();
const focusPairs = new Map();

for (const [name, state, prep] of runs) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	await context.addInitScript((s) => window.localStorage.setItem('wcct-proto-v1', JSON.stringify(s)), { ...base, ...state });
	const page = await context.newPage();
	const [file, rest] = name.split(/(?=[?#])/);
	await page.goto(pathToFileURL(path.join(root, `${file}.html`)).href + (rest || ''));
	if (prep) await prep(page);
	// Measure collapsed content too: Advanced settings, the Doctor's Working list.
	await page.evaluate(() => {
		document.querySelectorAll('details.advanced-settings, details.working-list').forEach((d) => { d.open = true; });
		if (!document.querySelector('dialog[open]')) document.querySelectorAll('[data-settings-panel]').forEach((p) => { p.hidden = false; });
	});
	await page.waitForTimeout(100);
	const is31Meta = name === 'platforms' && state.version === '3.1' && state.server === 'connected';
	if (state.plan === 'free' && (Object.keys(state).length === 1 || is31Meta)) {
		writeFileSync(path.join(renderedDir, is31Meta ? 'platforms-3.1.html' : `${name}.html`), '<!DOCTYPE html>\n' + (await page.evaluate(() => document.documentElement.outerHTML)).replace(/ (hidden|checked|disabled|open|selected|required)=""/g, ' $1'));
	}
	const found = await page.evaluate(() => {
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		const ctx = cv.getContext('2d', { willReadFrequently: true });
		const rgba = (c) => {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = '#000';
			ctx.fillStyle = c;
			ctx.fillRect(0, 0, 1, 1);
			const d = ctx.getImageData(0, 0, 1, 1).data;
			return [d[0], d[1], d[2], d[3] / 255];
		};
		const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
		const bgOf = (el) => {
			const stack = [];
			for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
				const c = rgba(getComputedStyle(n).backgroundColor);
				if (c[3] > 0) stack.push(c);
				if (c[3] === 1) break;
			}
			let out = [255, 255, 255, 1];
			for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
			return out;
		};
		const opacityOf = (el) => {
			let o = 1;
			for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
			return o;
		};
		const lum = (c) => {
			const ch = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
			return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
		};
		const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
		const out = [];
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		const seen = new Set();
		while (walker.nextNode()) {
			const t = walker.currentNode;
			const el = t.parentElement;
			if (!t.textContent.trim() || seen.has(el)) continue;
			seen.add(el);
			const cs = getComputedStyle(el);
			const r = el.getBoundingClientRect();
			if (!r.width || !r.height || cs.visibility === 'hidden' || el.closest('[hidden], .sr-only, option, select, script, style, svg')) continue;
			const bg = bgOf(el);
			const op = opacityOf(el);
			const fg = over([...rgba(cs.color).slice(0, 3), rgba(cs.color)[3] * op], bg);
			const L1 = lum(fg);
			const L2 = lum(bg);
			const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
			const disabled = !!el.closest('[disabled], [aria-disabled="true"]');
			out.push({ fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio * 100) / 100, disabled, size: cs.fontSize, weight: cs.fontWeight, text: t.textContent.trim().slice(0, 50), area: el.closest('.state-bar') ? 'state bar (prototype only)' : el.closest('.wp-adminbar, .wp-adminmenu') ? 'WP chrome' : 'app' });
		}
		return out;
	});
	for (const f of found) {
		const key = `${f.fg} on ${f.bg}${f.disabled ? ' (disabled)' : ''}`;
		if (!pairs.has(key)) pairs.set(key, { ...f, pages: new Set(), samples: new Set() });
		pairs.get(key).pages.add(name);
		if (pairs.get(key).samples.size < 3) pairs.get(key).samples.add(f.text);
	}
	// Focus indicators (added 2026-11-02): every enabled focusable control in
	// the plugin area, focused after a key press so :focus-visible applies.
	// The indicator is the outline, or for text fields the border, measured
	// against the surface it sits on. Threshold 3:1 (WCAG 1.4.11).
	await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' }); // read end states, not mid-transition
	await page.keyboard.press('Shift');
	const focused = await page.evaluate(() => {
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		const ctx = cv.getContext('2d', { willReadFrequently: true });
		const rgba = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
		const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
		const bgOf = (el) => {
			const stack = [];
			for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] === 1) break; }
			let out = [255, 255, 255, 1];
			for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
			return out;
		};
		const lum = (c) => { const ch = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]; };
		const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
		const out = [];
		const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
		for (const el of document.querySelectorAll(`.wp-content :is(${sel})`)) {
			if (el.closest('.state-bar, [hidden], dialog:not([open]), [aria-disabled="true"]')) continue;
			const target = el.matches('.switch input') ? el.nextElementSibling : el;
			const r = target.getBoundingClientRect();
			if (!r.width || !r.height || getComputedStyle(target).visibility === 'hidden') continue;
			el.focus({ preventScroll: true });
			if (document.activeElement !== el || !el.matches(':focus-visible')) continue;
			const cs = getComputedStyle(target);
			const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1;
			const ind = rgba(outline ? cs.outlineColor : cs.borderTopColor);
			const surface = outline && parseFloat(cs.outlineOffset) < 0 ? bgOf(target) : bgOf(target.parentElement);
			const fg = over(ind, surface);
			const L1 = lum(fg), L2 = lum(surface);
			out.push({ kind: outline ? `outline ${cs.outlineWidth}` : 'border', fg: hex(fg), bg: hex(surface), ratio: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100, text: (el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/)[0] + ' ' : el.tagName.toLowerCase() + ' ') + (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30) });
			el.blur();
		}
		return out;
	});
	for (const f of focused) {
		const key = `${f.kind} ${f.fg} on ${f.bg}`;
		if (!focusPairs.has(key)) focusPairs.set(key, { ...f, pages: new Set(), samples: new Set() });
		focusPairs.get(key).pages.add(name);
		if (focusPairs.get(key).samples.size < 3) focusPairs.get(key).samples.add(f.text);
	}
	await context.close();
}
await browser.close();

const rows = [...pairs.values()].sort((a, b) => a.ratio - b.ratio);
const fails = rows.filter((r) => r.ratio < 4.5 && !r.disabled);
console.log(`Unique text/background pairs: ${rows.length} (from ${runs.length} page/state runs)\n`);
console.log('ratio  | fg      | bg      | area | example');
for (const r of rows) {
	console.log(`${r.ratio.toFixed(2).padStart(6)} | ${r.fg} | ${r.bg} | ${r.area}${r.disabled ? ', disabled' : ''} | "${[...r.samples][0]}" (${[...r.pages].slice(0, 3).join(', ')}${r.pages.size > 3 ? ', …' : ''})`);
}
if (fails.length) {
	console.log(`\nFAIL: ${fails.length} pair(s) below 4.5:1`);
	process.exitCode = 1;
} else {
	console.log('\nAll enabled text passes 4.5:1.');
}

const frows = [...focusPairs.values()].sort((a, b) => a.ratio - b.ratio);
const ffails = frows.filter((r) => r.ratio < 3);
console.log(`\nFocus indicators: ${frows.length} unique indicator/surface pairs\n`);
console.log('ratio  | indicator  | colour  | surface | example');
for (const r of frows) {
	console.log(`${r.ratio.toFixed(2).padStart(6)} | ${r.kind.padEnd(10)} | ${r.fg} | ${r.bg} | "${[...r.samples][0]}" (${[...r.pages].slice(0, 3).join(', ')}${r.pages.size > 3 ? ', …' : ''})`);
}
if (ffails.length) {
	console.log(`\nFAIL: ${ffails.length} focus indicator(s) below 3:1`);
	process.exitCode = 1;
} else {
	console.log('\nEvery focus indicator is at least 3:1 against its surface.');
}
