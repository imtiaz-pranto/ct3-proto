// Screenshots every prototype page at 1440 and 1920 px in Free and Pro, plus
// the extra states, and checks for horizontal page scroll at 1024 / 1280 /
// 1440 / 1920.
// Usage (from prototype/tools): node screenshot.mjs
import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'screenshots');
mkdirSync(path.join(out, 'states'), { recursive: true });
mkdirSync(path.join(out, '1920', 'states'), { recursive: true });

const pages = readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const base = { version: '3.0', server: 'not', install: 'working', doctor: 'ran', connection: 'connected', doctorResult: 'findings', log: 'rows', oldPro: 'no', onbAt: '1' };
const wizard = { onbPicked: 'meta,google,x,microsoft', onbConnected: 'meta,google,x', eu: 'yes' };

// Extra states worth a look, beyond Free / Pro.
const extras = [
	['index', { plan: 'free', install: 'new' }, 'index-new-install'],
	['index', { plan: 'free', install: 'upgrade' }, 'index-upgraded'],
	['index', { plan: 'free', doctor: 'not' }, 'index-doctor-not-run'],
	['platforms', { plan: 'free', connection: 'not' }, 'platforms-not-connected'],
	['platforms-x', { plan: 'free', install: 'upgrade' }, 'platforms-x-upgraded'],
	['log', { plan: 'free', log: 'empty' }, 'log-empty'],
	['doctor', { plan: 'free', doctorResult: 'clear' }, 'doctor-all-clear'],
	['whats-new', { plan: 'free', oldPro: 'yes' }, 'whats-new-old-pro'],
	['catalog', { plan: 'pro', feed: 'fail', feedId: 'sku' }, 'catalog-pro-feed-fail-ids-differ'],
	['settings#access', { plan: 'free' }, 'settings-access-free'],
	['settings#access', { plan: 'pro' }, 'settings-access-pro'],
	['settings#plan', { plan: 'free' }, 'settings-plan-free'],
	['doctor', { plan: 'pro', feed: 'fail', feedId: 'sku' }, 'doctor-pro-catalog-findings'],
	// Trimmed 3.0 scope and Phase 2 (2026-10-30).
	['index', { plan: 'free', install: 'new', onbAt: '4' }, 'index-new-install-checklist'],
	['index', { plan: 'free', doctor: 'plugin' }, 'index-doctor-plugin-recheck'],
	['doctor', { plan: 'free' }, 'doctor-30-free-working-open', { prep: (p) => p.click('[data-working] summary') }],
	['doctor', { plan: 'pro', feedId: 'sku' }, 'doctor-30-pro-ids-differ'],
	['doctor', { plan: 'pro', version: '3.1' }, 'doctor-31-pro'],
	['settings#access', { plan: 'pro' }, 'settings-access-role-modal', { prep: (p) => p.click('label:has(input[value="customer"])'), full: false }],
	['settings#access', { plan: 'pro', install: 'upgrade' }, 'settings-access-pro-upgraded'],
	['onboarding', { plan: 'free' }, 'onboarding-1-welcome'],
	['onboarding?step=2', { plan: 'free', ...wizard }, 'onboarding-2-platforms'],
	['onboarding?step=3', { plan: 'free', ...wizard }, 'onboarding-3-connect'],
	['onboarding?step=4', { plan: 'free', ...wizard }, 'onboarding-4-europe-yes'],
	['onboarding?step=4', { plan: 'free', ...wizard, eu: 'no' }, 'onboarding-4-europe-no'],
	['onboarding?step=5', { plan: 'free', ...wizard }, 'onboarding-5-verify-waiting'],
	['onboarding?step=5', { plan: 'free', ...wizard, verified: 'yes' }, 'onboarding-5-verify-sent'],
	['onboarding?step=6', { plan: 'free', ...wizard, verified: 'yes' }, 'onboarding-6-done'],
	['whats-new', { plan: 'free', install: 'upgrade', migration: 'done' }, 'whats-new-migration-done'],
	['whats-new', { plan: 'free', install: 'upgrade', migration: 'progress' }, 'whats-new-migration-in-progress'],
	['whats-new', { plan: 'free', install: 'upgrade', migration: 'attention' }, 'whats-new-migration-needs-attention'],
	['whats-new', { plan: 'pro', install: 'upgrade', migration: 'attention', oldPro: 'yes' }, 'whats-new-migration-old-pro'],
	['catalog', { plan: 'pro', install: 'upgrade' }, 'catalog-pro-upgraded'],
	['platforms', { plan: 'free', install: 'upgrade' }, 'platforms-upgraded-custom-preset'],
];

const browser = await chromium.launch();
const problems = [];

async function shoot(name, state, file, width, { full = true, save = true, prep } = {}) {
	const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
	await context.addInitScript((s) => {
		window.localStorage.setItem('wcct-proto-v1', JSON.stringify(s));
	}, { ...base, ...state });
	const page = await context.newPage();
	page.on('pageerror', (e) => problems.push(`${name} @${width}: JS error ${e.message}`));
	page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name} @${width}: console ${m.text()}`); });
	const [pageFile, rest] = name.split(/(?=[?#])/);
	await page.goto(pathToFileURL(path.join(root, `${pageFile}.html`)).href + (rest || ''));
	await page.addStyleTag({ content: '.state-bar{display:none!important}' });
	if (prep) await prep(page);
	await page.waitForTimeout(150);
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	if (overflow > 0) problems.push(`${name} @${width} (${JSON.stringify(state)}): horizontal page scroll ${overflow}px`);
	const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
	if (broken.length) problems.push(`${name}: broken images ${broken.join(', ')}`);
	if (save) {
		// Grow the viewport to the page height so sticky bars sit where a reader
		// would see them at the end of the page, and the WP menu spans the page.
		const h = await page.evaluate(() => document.documentElement.scrollHeight);
		if (full) await page.setViewportSize({ width, height: Math.max(900, h) });
		await page.waitForTimeout(50);
		await page.screenshot({ path: file });
	}
	await context.close();
}

for (const name of pages) {
	for (const plan of ['free', 'pro']) {
		await shoot(name, { plan }, path.join(out, `${name}-${plan}.png`), 1440);
		await shoot(name, { plan }, path.join(out, '1920', `${name}-${plan}-1920.png`), 1920);
		for (const w of [1024, 1280]) await shoot(name, { plan }, null, w, { save: false });
	}
}
for (const [name, state, file, opts = {}] of extras) {
	await shoot(name, state, path.join(out, 'states', `${file}.png`), 1440, opts);
	await shoot(name, state, path.join(out, '1920', 'states', `${file}-1920.png`), 1920, opts);
	await shoot(name, state, null, 1024, { ...opts, save: false });
}
// 3.1: every page in both plans is checked for errors and scroll; pages with
// server UI (Meta) are also saved.
for (const name of pages) {
	for (const plan of ['free', 'pro']) {
		for (const server of ['not', 'connected']) {
			const state = { plan, version: '3.1', server };
			if (name === 'platforms') {
				await shoot(name, state, path.join(out, 'states', `platforms-3.1-${plan}-${server}.png`), 1440);
				await shoot(name, state, path.join(out, '1920', 'states', `platforms-3.1-${plan}-${server}-1920.png`), 1920);
			} else {
				await shoot(name, state, null, 1440, { save: false });
			}
			await shoot(name, state, null, 1024, { save: false });
		}
	}
}
// Narrow-layout references.
for (const name of ['index', 'platforms', 'log']) {
	await shoot(name, { plan: 'free' }, path.join(out, 'states', `${name}-1024.png`), 1024);
}

await browser.close();
console.log(`Pages: ${pages.length}, screenshots in ${path.relative(process.cwd(), out)}`);
if (problems.length) {
	console.log('Problems:\n' + problems.join('\n'));
	process.exitCode = 1;
} else {
	console.log('No JS errors, no broken images, no horizontal page scroll at 1024 / 1280 / 1440 / 1920.');
}
