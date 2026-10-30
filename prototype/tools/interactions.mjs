// Exercises every interactive state listed in prompts/02-html-prototype.md.
// Usage (from prototype/tools): node interactions.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { readdirSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (p) => pathToFileURL(path.join(root, `${p}.html`)).href;
const browser = await chromium.launch();
const results = [];
const errors = [];

async function fresh(width = 1440) {
	const context = await browser.newContext({ viewport: { width, height: 900 } });
	const page = await context.newPage();
	page.on('pageerror', (e) => errors.push(e.message));
	return { context, page };
}
async function check(name, fn) {
	try {
		await fn();
		results.push(`PASS ${name}`);
	} catch (e) {
		results.push(`FAIL ${name}: ${e.message.split('\n').slice(0, 12).join(' | ')}`);
	}
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }
const visible = (page, sel) => page.locator(sel).first().isVisible();
const st = (page, key, val) => page.evaluate(([k, v]) => window.WCCT_PROTO.setState(k, v), [key, val]);

const { page } = await fresh();

await check('State bar: Plan Pro persists across pages (localStorage)', async () => {
	await page.goto(url('index'));
	expect(!(await visible(page, '[data-state-key="plan"]')), 'state bar should start collapsed');
	await page.click('#proto-state summary');
	await page.click('[data-state-key="plan"][data-state-val="pro"]');
	await page.click('#proto-state summary');
	await page.waitForTimeout(100); // the details toggle event that stores "closed" is async
	await page.goto(url('log'));
	expect(await visible(page, '#log-search'), 'Pro search not shown after navigating');
	await page.goto(url('index'));
	await st(page, 'plan', 'free');
});

await check('Dashboard: Install New shows welcome banner and hides stats', async () => {
	await page.goto(url('index'));
	await st(page, 'install', 'new');
	expect(await visible(page, '#welcome-title'), 'welcome missing');
	expect(!(await visible(page, '.stat-grid')), 'stats still shown');
	await st(page, 'install', 'upgrade');
	expect(await page.getByText('Updated to 3.0.').isVisible(), 'upgrade banner missing');
	await st(page, 'install', 'working');
});

await check('Dashboard: Doctor ran / not run', async () => {
	await st(page, 'doctor', 'not');
	expect(await page.getByRole('link', { name: 'Check my store' }).first().isVisible(), 'invite missing');
	await st(page, 'doctor', 'ran');
	expect(await page.getByText('2 things worth a look').isVisible(), 'ran state missing');
});

await check('Dashboard: filter chips', async () => {
	await page.click('[data-filter="attention"]');
	expect(await page.locator('[data-platform-status]:visible').count() === 1, 'attention filter');
	await page.click('[data-filter="all"]');
	expect(await page.locator('[data-platform-status]:visible').count() === 3, 'all filter');
});

await check('Pick platforms: count updates as tiles toggle', async () => {
	await page.goto(url('pick-platforms'));
	await page.click('[data-platform="x"]');
	expect((await page.textContent('[data-pick-count]')).startsWith('3 selected'), 'count not 3');
	await page.click('[data-platform="meta"]');
	await page.click('[data-platform="google"]');
	await page.click('[data-platform="x"]');
	expect((await page.textContent('[data-pick-count]')).startsWith('Nothing selected'), 'count not 0');
	await page.click('[data-platform="google"]');
	expect((await page.getAttribute('[data-pick-continue]', 'href')) === 'platforms-google.html', 'continue link');
});

await check('Platforms: Pause tracking confirm dialog, then Paused', async () => {
	await page.goto(url('platforms'));
	await page.click('text=Pause tracking');
	expect(await visible(page, '#pause-dialog'), 'dialog not open');
	await page.click('#pause-dialog button[value="pause"]');
	await page.waitForTimeout(100); // the dialog close event is async
	expect(await page.locator('.detail-head .pill', { hasText: 'Paused' }).isVisible(), 'not paused');
	await page.click('[data-resume]');
	await page.waitForTimeout(100);
});

await check('Platforms: connected / not connected', async () => {
	await st(page, 'connection', 'not');
	expect(await visible(page, '[data-connect]'), 'Connect missing');
	await st(page, 'connection', 'connected');
	expect(await visible(page, '[data-save]'), 'Saved missing');
});

await check('Google: radio changes fields; label hint until 10+ chars', async () => {
	await page.goto(url('platforms-google'));
	await page.check('input[value="analytics"]');
	expect(!(await visible(page, '#aw-label')), 'ads fields still shown');
	expect(await visible(page, '#ga-id'), 'GA field hidden');
	await page.check('input[value="ads"]');
	expect(!(await visible(page, '#ga-id')), 'GA field still shown');
	expect(await visible(page, '#label-bad'), 'incomplete hint missing');
	await page.fill('#aw-label', 'AbCdEfGhIj');
	expect(!(await visible(page, '#label-bad')) && (await visible(page, '#label-good')), 'hint did not clear at 10 chars');
	expect(await page.locator('.detail-head .pill.ok').isVisible(), 'status did not turn Working');
});

await check('Events table: Meta lists all 8, counts, presets, Pro locks', async () => {
	await page.goto(url('platforms'));
	const t = '[data-events="meta"]';
	const count = () => page.textContent(`${t} .events-count`);
	const pressed = () => page.getAttribute(`${t} [aria-pressed="true"]`, 'data-ev-preset');
	expect((await count()) === '4 of 8 on' && (await pressed()) === 'rec', 'default not 4 of 8, Recommended');
	expect(await page.locator(`${t} tbody tr:visible`).count() === 8, 'all 8 events should be listed');
	expect((await page.locator(`${t} [data-ev-more], ${t} tfoot`).count()) === 0, 'there should be no Show more row');
	const cat = page.locator(`${t} tr[data-ev="category"]`);
	expect(await cat.locator('.pro-badge').isVisible() && (await cat.locator('[role="switch"]').count()) === 0, 'View category not locked on Free');
	expect(await page.locator(`${t} tr[data-ev="wishlist"] .pro-badge`).isVisible(), 'wishlist row missing or unlocked');
	await page.click(`${t} label:has([data-ev-toggle="search"])`);
	expect((await count()) === '5 of 8 on' && (await pressed()) === 'custom', 'editing a row did not switch to Custom');
	expect(!(await page.locator('[data-save]').isDisabled()), 'Save not enabled after an edit');
	await page.click(`${t} [data-ev-preset="all"]`);
	expect((await count()) === '6 of 8 on', 'All on Free should turn on the 6 unlocked events');
	await st(page, 'plan', 'pro');
	await page.click(`${t} [data-ev-preset="all"]`);
	expect((await count()) === '8 of 8 on', 'All on Pro should be 8 of 8');
	await page.click(`${t} [data-ev-preset="rec"]`);
	expect((await count()) === '4 of 8 on', 'Recommended did not reset');
	await st(page, 'plan', 'free');
});

await check('Event parity: Google and X Registration (Pro), Microsoft 4 events', async () => {
	await page.goto(url('platforms-google'));
	expect(await page.locator('[data-events="google"] tr[data-ev="registration"] .pro-badge').isVisible(), 'Google Registration');
	await page.goto(url('platforms-x'));
	expect(await page.locator('[data-events="x"] tr[data-ev="registration"] .pro-badge').isVisible(), 'X Registration');
	await page.goto(url('platforms-microsoft'));
	await st(page, 'plan', 'pro');
	const names = await page.locator('[data-events="microsoft"] tbody th .ev-name').allTextContents();
	expect(names.join(',') === 'Page view,Add to cart,Start checkout,Purchase', 'Microsoft events: ' + names.join(','));
	await st(page, 'plan', 'free');
});

await check('Advanced settings: collapsed, Meta holds the old Advanced options, developer block last', async () => {
	await page.goto(url('platforms'));
	expect(!(await visible(page, '#meta-product-id')), 'Advanced settings should start collapsed');
	await page.click('#advanced-settings summary');
	for (const sel of ['#meta-value', '#meta-product-id', '#meta-roles']) expect(await visible(page, sel), sel + ' missing');
	expect(await page.getByText('Custom parameters').first().isVisible() && await page.getByText('More than one pixel').isVisible(), 'Pro rows missing on Free');
	const last = await page.$eval('#advanced-settings .advanced-body', (b) => [...b.children].filter((c) => c.getClientRects().length).pop().className);
	expect(last === 'dev-block', 'developer block is not last: ' + last);
	await page.goto(url('platforms-custom'));
	expect(await page.locator('.placeholder-list code').count() === 11, 'custom script should list 11 placeholders');
	expect(await page.locator('[id^="script-"][role="switch"]').count() === 3, 'custom script should have 3 placements');
});

await check('Log: tabs filter, row click updates detail, Pro search', async () => {
	await page.goto(url('log'));
	await page.click('[data-log-tab="missed"]');
	expect(await page.locator('[data-log-rows] tr').count() === 1, 'missed tab');
	await page.click('[data-log-rows] tr');
	expect((await page.textContent('[data-log-detail]')).includes('Order #1311'), 'detail not updated');
	await page.click('[data-log-tab="all"]');
	await st(page, 'plan', 'pro');
	await page.fill('#log-search', '1306');
	expect(await page.locator('[data-log-rows] tr').count() === 1, 'search');
	await st(page, 'log', 'empty');
	expect(await page.getByText('No events yet. Place a test order and come back in a minute.').isVisible(), 'empty state');
	await st(page, 'log', 'rows');
	await st(page, 'plan', 'free');
});

await check('Log at 1024 px: row opens detail dialog', async () => {
	const { context, page: p } = await fresh(1024);
	await p.goto(url('log'));
	await p.click('[data-log-rows] tr:nth-child(2)');
	expect(await p.locator('#log-dialog').isVisible(), 'dialog not open');
	await context.close();
});

await check('Settings > Alerts (default panel): switches reflect plan; Send a test shows a toast', async () => {
	await page.goto(url('settings'));
	expect(await visible(page, '#alerts') && !(await visible(page, '#access')) && !(await visible(page, '#plan')), 'Alerts should be the only panel shown by default');
	expect((await page.getAttribute('[data-settings-link="alerts"]', 'aria-current')) === 'page', 'Alerts not marked current');
	expect(await page.locator('.crown-link:visible').count() === 3, 'Free should show 3 locked rows');
	await page.click('.crown-link:visible >> nth=0');
	await page.waitForTimeout(100); // hashchange is async
	expect(await visible(page, '#plan') && !(await visible(page, '#alerts')), 'Upgrade link should open the Plan panel');
	await page.click('[data-settings-link="alerts"]');
	await page.waitForTimeout(100);
	await st(page, 'plan', 'pro');
	expect(await page.locator('.crown-link:visible').count() === 0, 'Pro still locked');
	await page.click('[data-send-test]');
	await page.waitForSelector('.toast', { timeout: 2000 });
	await st(page, 'plan', 'free');
});

await check('Doctor: 2 findings / all clear; Check again 2 s; Dismiss', async () => {
	await page.goto(url('doctor'));
	await page.click('[data-finding-dismiss] >> nth=0');
	expect((await page.textContent('[data-findings-title]')).includes('1 is worth a look'), 'dismiss count');
	await page.click('[data-check-again]');
	expect(await visible(page, '[data-doctor-running]'), 'running state missing');
	await page.waitForTimeout(1500);
	expect(await visible(page, '[data-doctor-running]'), 'running ended before 2 s');
	await page.waitForTimeout(800);
	expect(!(await visible(page, '[data-doctor-running]')) && (await page.textContent('[data-findings-title]')).includes('2 are'), 'results not back');
	await st(page, 'doctorResult', 'clear');
	expect(await page.getByText('Everything looks good').isVisible(), 'all clear');
	await st(page, 'doctorResult', 'findings');
});

await check("What's new: Free / Pro / old Pro detected", async () => {
	await page.goto(url('whats-new'));
	await st(page, 'oldPro', 'yes');
	expect(await page.getByText('Conversion Tracking Pro 1.1.4 is installed but paused.').isVisible(), 'old pro');
	await st(page, 'oldPro', 'no');
	await st(page, 'plan', 'pro');
	expect(await page.getByText('Pro 3.0 is active.').isVisible(), 'pro');
	await st(page, 'plan', 'free');
});

await check('X: re-setup notice for upgraders; Microsoft: Pro lock / UET field', async () => {
	await page.goto(url('platforms-x'));
	await st(page, 'install', 'upgrade');
	expect(await page.getByText('X retired the old single-event codes').isVisible(), 'X notice');
	await st(page, 'install', 'working');
	await page.goto(url('platforms-microsoft'));
	expect(await page.getByText('Microsoft Advertising is part of Pro').isVisible(), 'lock');
	await st(page, 'plan', 'pro');
	expect(await visible(page, '#uet-id'), 'UET field');
	await st(page, 'plan', 'free');
});

await check('Help menu opens and closes with Escape', async () => {
	await page.goto(url('index'));
	await page.click('[data-help]');
	expect(await visible(page, '#help-menu'), 'menu');
	await page.keyboard.press('Escape');
	expect(!(await visible(page, '#help-menu')), 'menu still open');
});

await check('Nav: Catalog after Platforms, no Alerts tab, Settings last', async () => {
	await page.goto(url('index'));
	const tabs = await page.locator('.topbar-nav a').allTextContents();
	expect(tabs.join(',') === 'Dashboard,Platforms,Catalog,Activity log,Doctor,Settings', tabs.join(','));
});

await check('Catalog: Free lock; Pro feed, copy, category search, ID mismatch warning and Doctor finding', async () => {
	await page.goto(url('catalog'));
	expect(await page.getByText('The Meta catalog feed is part of Pro').isVisible(), 'Free lock missing');
	expect(await page.getByRole('link', { name: 'Continue with Free' }).isVisible(), 'Continue with Free missing');
	await st(page, 'plan', 'pro');
	expect(await page.locator('.dest-tabs a').count() === 1, 'only the Meta destination should show');
	await page.click('[data-copy="feed-url"]');
	await page.waitForSelector('.toast', { timeout: 2000 });
	await page.fill('[data-cat-search]', 'tops');
	const shown = await page.locator('[data-cat-tree] label:visible').allTextContents();
	expect(shown.join(',') === 'Men,Tops,Women,Tops', 'search should keep parents: ' + shown.join(','));
	await page.fill('[data-cat-search]', 'zzz');
	expect(await visible(page, '[data-cat-empty]'), 'no-match text missing');
	await page.fill('[data-cat-search]', '');
	const box = await page.$eval('.pick-box-list', (l) => [l.scrollHeight, l.clientHeight, getComputedStyle(l).overflowY]);
	expect(box[0] > box[1] && box[1] <= 296 && box[2] === 'auto', 'category list should scroll inside its box: ' + box.join(' / '));
	expect((await page.textContent('[data-cat-count]')) === '2 of 29 left out', 'initial count');
	await page.click('[data-cat-tree] label:has(input[value="men"])');
	expect((await page.textContent('[data-cat-count]')) === '10 of 29 left out', 'ticking Men should tick its 7 children too');
	await page.click('[data-cat-tree] label:has(input[value="men-shoes"])');
	expect(await page.$eval('input[value="men"]', (i) => i.indeterminate && !i.checked), 'Men should show partial');
	await page.click('[data-cat-clear]');
	expect((await page.textContent('[data-cat-count]')) === '0 of 29 left out', 'Clear');
	expect(await visible(page, '[data-id-match="yes"]'), 'match line missing');
	await page.selectOption('[data-feed-id-type]', 'sku');
	expect(await visible(page, 'p[data-id-match="no"]') && !(await visible(page, 'p[data-id-match="yes"]')), 'mismatch warning missing');
	await page.goto(url('doctor'));
	expect(await page.getByText('Your feed and your pixel use different product IDs').isVisible(), 'Doctor mismatch finding missing');
	await page.goto(url('catalog'));
	await page.selectOption('[data-feed-id-type]', 'id');
	await page.goto(url('doctor'));
	expect(await page.getByText('Catalog feed product IDs match the product IDs your Meta pixel sends').isVisible(), 'Doctor match check missing');
	expect(await page.getByText('Catalog feed is reachable').isVisible(), 'Doctor reachable check missing');
	await page.goto(url('platforms') + '#product-id-sent');
	expect(await visible(page, '#meta-product-id'), 'link did not open Advanced settings');
	await st(page, 'plan', 'free');
});

await check('Settings > Integration access: Free lock; Pro role picker lists every role incl. Dokan Vendor', async () => {
	await page.goto(url('settings') + '#access');
	expect(await page.getByText('Role access is part of Pro').isVisible(), 'Free lock missing');
	expect(!(await visible(page, '#alerts')), 'only the Access panel should show');
	await st(page, 'plan', 'pro');
	const roles = await page.locator('.check-list .check > span').evaluateAll((els) => els.map((e) => e.firstChild.textContent.trim()));
	expect(roles.join(',') === 'Administrator,Shop manager,Editor,Author,Contributor,Subscriber,Customer,Vendor', roles.join(','));
	await st(page, 'plan', 'free');
});

await check('Version toggle: Server state only in 3.1; 3.0 shows no server UI', async () => {
	await page.goto(url('platforms'));
	await page.click('#proto-state summary');
	expect(await visible(page, '[data-state-key="version"][data-state-val="3.0"][aria-pressed="true"]'), 'Version should default to 3.0');
	expect((await page.locator('[data-state-key="server"]').count()) === 0, 'Server state shown in 3.0');
	expect((await page.locator('.server, .col-from, .events-note').count()) === 0, 'server UI in 3.0');
	await page.click('[data-state-key="version"][data-state-val="3.1"]');
	expect(await visible(page, '[data-state-key="server"]'), 'Server state missing in 3.1');
	await page.click('#proto-state summary');
	await st(page, 'version', '3.0');
});

await check('3.1 Meta: Sent from column, note, connect flow, Free locks, test mode, delivery settings; flag off elsewhere', async () => {
	await page.goto(url('platforms'));
	await st(page, 'version', '3.1');
	const t = '[data-events="meta"]';
	expect(await visible(page, `${t} th.col-from`), 'Sent from column missing');
	expect((await page.textContent(`${t} .events-note`)).includes('Browser tracking always runs. Server sending only adds a second copy, and Meta keeps one.'), 'note line');
	expect((await page.textContent(`${t} tr[data-ev="purchase"] .col-from`)).trim() === 'Browser', 'not connected should read Browser');
	expect((await page.locator(`${t} .col-from select, ${t} .col-from input`).count()) === 0, 'Sent from must be read-only');
	expect(await page.getByText('Create an access token').isVisible() && await visible(page, '#server-token-meta'), 'not-connected steps');
	expect(await page.getByText('Free and Pro').isVisible(), 'Free upgrade box missing');
	await page.click('[data-server-connect]');
	await page.waitForTimeout(1100);
	expect(await page.locator('.server .pill.ok', { hasText: 'Connected' }).isVisible(), 'did not connect');
	expect((await page.textContent(`${t} tr[data-ev="purchase"] .col-from`)).trim() === 'Browser + server', 'Purchase should be Browser + server');
	await page.click(`${t} label:has([data-ev-toggle="search"])`);
	expect(await page.locator(`${t} tr[data-ev="search"] .col-from .lock-inline`).isVisible(), 'Free Search should show Browser plus a lock');
	for (const label of ['Sent from server', 'Delivered', 'Retrying']) expect(await page.locator('.server .stat-label', { hasText: label }).isVisible(), label);
	expect(!(await visible(page, '#server-test-code-meta')), 'test code shown before Test mode');
	await page.click('.server label:has([data-server-test])');
	expect(await visible(page, '#server-test-code-meta'), 'test code missing with Test mode on');
	await page.click('#advanced-settings summary');
	expect(await visible(page, '#server-delivery-meta') && await visible(page, '#server-retries-meta'), 'delivery settings missing');
	expect(!(await page.getByText(/server only|server-only/i).count()), 'server-only option offered');
	await st(page, 'plan', 'pro');
	expect(!(await page.getByText('Free and Pro').isVisible()), 'Pro should not see the upgrade box');
	expect((await page.textContent(`${t} tr[data-ev="search"] .col-from`)).trim() === 'Browser + server', 'Pro Search should be Browser + server');
	for (const p of ['platforms-google', 'platforms-x', 'platforms-microsoft']) {
		await page.goto(url(p));
		expect((await page.locator('.server, .col-from, .events-note').count()) === 0, p + ' shows server UI with its flag off');
	}
	await st(page, 'plan', 'free');
	await st(page, 'server', 'not');
	await st(page, 'version', '3.0');
});

await check('Layout: full width at 1920 px, Platforms columns 240 / fluid / 320 at 1440 px', async () => {
	const { context, page: p } = await fresh(1920);
	await p.goto(url('index'));
	const w = await p.evaluate(() => document.querySelector('.page').getBoundingClientRect().width);
	expect(w === 1920 - 160, `page is ${w}px wide, expected 1760`);
	await p.setViewportSize({ width: 1440, height: 900 });
	await p.goto(url('platforms'));
	const cols = await p.evaluate(() => [
		document.querySelector('.master').getBoundingClientRect().width,
		document.querySelector('aside.help').getBoundingClientRect().width,
		getComputedStyle(document.querySelector('.page')).paddingLeft,
	]);
	expect(cols[0] === 240 && cols[1] === 320 && cols[2] === '32px', `got ${cols.join(' / ')}`);
	await context.close();
});

await check('Help drawer below 1280 px: ? opens it, focus moves in, Escape closes; menu at 1440 px', async () => {
	const { context, page: p } = await fresh(1100);
	await p.goto(url('platforms-google'));
	expect(!(await p.locator('aside.help').isVisible()), 'help column should be hidden at 1100 px');
	await p.click('[data-help]');
	await p.waitForTimeout(250);
	expect(await p.locator('aside.help').isVisible(), 'drawer did not open');
	const focused = await p.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.outerHTML.slice(0, 60));
	expect(focused === 'Close help', 'focus not on Close help: ' + focused);
	expect(!(await visible(p, '#help-menu')), 'menu opened instead of drawer');
	await p.keyboard.press('Escape');
	await p.waitForTimeout(250);
	expect(!(await p.locator('aside.help').isVisible()), 'drawer still open');
	expect(await p.evaluate(() => document.activeElement.hasAttribute('data-help')), 'focus not back on ?');
	await p.setViewportSize({ width: 1440, height: 900 });
	await p.click('[data-help]');
	expect(await visible(p, '#help-menu'), 'menu should open at 1440 px');
	await context.close();
});

await check('One setting per line: no two form controls share a line; inputs <= 560 px', async () => {
	const { context, page: p } = await fresh(1920);
	const bad = [];
	const names = readdirSync(root).filter((f) => f.endsWith('.html') && f !== 'email-weekly.html').map((f) => f.replace('.html', ''));
	for (const plan of ['free', 'pro']) {
		for (const name of names) {
			await p.goto(url(name));
			await st(p, 'plan', plan);
			bad.push(...await p.evaluate((n) => {
				document.querySelectorAll('details.advanced-settings').forEach((d) => { d.open = true; });
				document.querySelectorAll('[data-settings-panel]').forEach((p) => { p.hidden = false; });
				// Settings controls only. Table toolbars, page-head filters and
				// action-button groups are not settings.
				const sel = '.wcct-app input:not([type="radio"]):not([type="search"]), .wcct-app select:not([data-chart-period]), .wcct-app textarea, .wcct-app .radio-card';
				const els = [...document.querySelectorAll(sel)]
					.map((e) => (e.closest('.switch') || e))
					.filter((e, i, a) => a.indexOf(e) === i && e.getClientRects().length && !e.closest('.table-toolbar, .page-head, .chart-head'));
				const out = [];
				els.forEach((a, i) => els.slice(i + 1).forEach((b) => {
					const r1 = a.getBoundingClientRect();
					const r2 = b.getBoundingClientRect();
					if (r1.top < r2.bottom - 2 && r2.top < r1.bottom - 2) out.push(`${n}: ${a.id || a.className} beside ${b.id || b.className}`);
				}));
				document.querySelectorAll('.field input[type="text"], .field input[type="email"], .field select, .field textarea').forEach((e) => {
					if (e.getClientRects().length && e.getBoundingClientRect().width > 560) out.push(`${n}: ${e.id} is ${e.getBoundingClientRect().width}px`);
				});
				return out;
			}, `${name} (${plan})`));
		}
	}
	await st(p, 'plan', 'free');
	expect(!bad.length, bad.join('; '));
	await context.close();
});

await browser.close();
console.log(results.join('\n'));
if (errors.length) console.log('JS errors:\n' + errors.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length + errors.length;
console.log(failed ? `\n${failed} problem(s)` : `\nAll ${results.length} checks pass, no JS errors.`);
process.exitCode = failed ? 1 : 0;
