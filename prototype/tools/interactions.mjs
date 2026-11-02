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
// Version is stamped at load, so changing it reloads the page.
async function setVersion(page, v) {
	await Promise.all([page.waitForEvent('load'), st(page, 'version', v).catch(() => {})]);
}
const onb = (page, step) => page.goto(url('onboarding') + (step ? `?step=${step}` : ''));
const shownStep = (page) => page.$eval('[data-onb-step]:not([hidden])', (s) => s.getAttribute('data-onb-step'));

const { page } = await fresh();

await check('State bar: Plan Pro persists across pages (localStorage)', async () => {
	await page.goto(url('index'));
	expect(!(await visible(page, '[data-state-key="plan"]')), 'state bar should start collapsed');
	await page.click('#proto-state summary');
	await page.click('[data-state-key="plan"][data-state-val="pro"]');
	await page.click('#proto-state summary');
	await page.waitForTimeout(100); // the details toggle event that stores "closed" is async
	await page.goto(url('platforms-microsoft'));
	expect(await visible(page, '#uet-id'), 'Pro UET field not shown after navigating');
	await page.goto(url('index'));
	await st(page, 'plan', 'free');
});

await check('Dashboard: Install New shows the setup checklist and hides stats', async () => {
	await page.goto(url('index'));
	await st(page, 'onbAt', '1');
	await st(page, 'install', 'new');
	expect(await visible(page, '#welcome-title'), 'welcome missing');
	expect((await page.textContent('[data-onb-continue]')).trim() === 'Continue setup', 'Continue setup missing');
	expect(!(await visible(page, '.stat-grid')), 'stats still shown');
	await st(page, 'install', 'upgrade');
	expect(await page.getByText('Updated to 3.0.').isVisible(), 'upgrade banner missing');
	await st(page, 'install', 'working');
	await st(page, 'onbAt', '0');
});

await check('Dashboard: Doctor ran / not run / quiet re-check after a plugin is activated', async () => {
	await st(page, 'doctor', 'not');
	expect(await page.getByRole('link', { name: 'Check my store' }).first().isVisible(), 'invite missing');
	await st(page, 'doctor', 'plugin');
	expect(await page.getByText('1 new thing worth a look').isVisible() && (await page.locator('dialog[open]').count()) === 0, 'plugin re-check card missing, or a popup opened');
	await st(page, 'doctor', 'ran');
	expect(await page.getByText('3 things worth a look').isVisible(), 'ran state missing');
});

await check('Dashboard 3.0: missed-sale card offers only 3.0 actions', async () => {
	const links = await page.locator('[aria-label="Missed sales"] a:visible').evaluateAll((a) => a.map((l) => `${l.textContent.trim()} -> ${l.getAttribute('href')}`));
	expect(links.join('; ') === 'Open the orders in the Activity log -> log.html?tab=missed; Check cookie choices -> platforms.html#cookie-choices; Run the Doctor -> doctor.html', links.join('; '));
	await page.click('text=Open the orders in the Activity log');
	expect((await page.getAttribute('[data-log-tab="missed"]', 'aria-selected')) === 'true' && (await page.textContent('[data-log-detail]')).includes('Order #1311'), 'missed tab or order not opened');
});

await check('Dashboard: filter chips', async () => {
	await page.goto(url('index'));
	await page.click('[data-filter="attention"]');
	expect(await page.locator('[data-platform-status]:visible').count() === 1, 'attention filter');
	await page.click('[data-filter="all"]');
	expect(await page.locator('[data-platform-status]:visible').count() === 3, 'all filter');
});

await check('Onboarding: Install New opens the wizard; 6-step indicator; opt-in off; What\'s shared', async () => {
	await page.goto(url('index'));
	await st(page, 'install', 'new');
	await page.goto(url('index'));
	await page.waitForURL(/onboarding\.html/);
	expect((await page.locator('.topbar-steps .step').allTextContents()).join(',') === '1Welcome,2Platforms,3Connect,4Europe,5Verify,6Done', 'step indicator');
	expect((await shownStep(page)) === '1' && (await page.getAttribute('[data-step-dot="1"]', 'aria-current')) === 'step', 'not on step 1');
	expect(await page.getByText('about 3 minutes').isVisible(), 'about 3 minutes missing');
	expect(!(await page.isChecked('#onb-usage')), 'usage opt-in should start off');
	expect(!(await visible(page, '#onb-shared')), 'shared list should start closed');
	await page.click('[data-onb-shared]');
	expect(await visible(page, '#onb-shared') && (await page.locator('#onb-shared li').count()) === 4, 'shared list did not open');
	for (const n of [1, 2, 3, 4, 5]) expect(await page.locator(`[data-onb-step="${n}"] [data-onb-skip]`).count() === 1, `step ${n} has no Skip for now`);
	expect((await page.locator('.wcct-app .upgrade-card, .wcct-app .crown-link, .wcct-app a[href*="#plan"]').count()) === 0, 'upsell inside onboarding');
});

await check('Onboarding: pick platforms multi-select, Microsoft PRO but not pushed', async () => {
	await page.click('[data-onb-step="1"] [data-onb-next]');
	expect((await shownStep(page)) === '2', 'Start did not open step 2');
	expect((await page.textContent('[data-pick-count]')) === '2 selected.', 'default pick');
	await page.click('[data-platform="x"]');
	expect((await page.textContent('[data-pick-count]')) === '3 selected.', 'count not 3');
	await page.click('[data-platform="meta"]');
	await page.click('[data-platform="google"]');
	await page.click('[data-platform="x"]');
	expect((await page.textContent('[data-pick-count]')).startsWith('Nothing selected') && await page.isDisabled('[data-pick-continue]'), 'empty pick should block Continue');
	expect(await page.locator('[data-platform="microsoft"] .pro-badge').isVisible(), 'Microsoft PRO badge missing');
	for (const p of ['meta', 'google', 'microsoft']) await page.click(`[data-platform="${p}"]`);
	expect((await page.textContent('[data-pick-count]')) === '3 selected.', 'count after re-pick');
});

await check('Onboarding: Connect shows one panel per pick, validates as you type, no Advanced settings', async () => {
	await page.click('[data-onb-step="2"] [data-onb-next]');
	const panels = await page.locator('[data-onb-panel]:visible').evaluateAll((p) => p.map((e) => e.dataset.onbPanel));
	expect(panels.join(',') === 'meta,google,microsoft', 'panels: ' + panels.join(','));
	expect(await page.getByText('Microsoft Advertising is part of Pro, so we\'ll leave it out of setup.').isVisible(), 'Free Microsoft note');
	expect((await page.locator('[data-onb-step="3"] .advanced-settings').count()) === 0, 'Advanced settings shown in onboarding');
	expect((await page.textContent('[data-onb-events="meta"]')).includes('Purchase'), 'recommended preset line missing');
	expect(await page.isDisabled('[data-onb-connect-next]'), 'Continue should wait for a valid ID');
	await page.fill('#onb-meta-id', 'EAA123');
	expect(await visible(page, '#onb-meta-bad'), 'bad hint missing');
	await page.fill('#onb-meta-id', '1234567890123456');
	expect(await visible(page, '#onb-meta-good') && !(await page.isDisabled('[data-onb-connect-next]')), 'valid Pixel ID not accepted');
	expect((await page.textContent('[data-onb-panel="meta"] [data-onb-status]')) === 'Looks right', 'Meta pill');
	await page.fill('#onb-ga-id', 'G-7KQ2M9PX3L');
	await page.fill('#onb-aw-label', 'AbC');
	expect(await visible(page, '#onb-label-bad') && (await page.textContent('[data-onb-panel="google"] [data-onb-status]')) === 'Not connected', 'short label should fail');
	await page.fill('#onb-aw-label', '');
	expect((await page.textContent('[data-onb-panel="google"] [data-onb-status]')) === 'Looks right', 'Google should pass without the optional Ads fields');
});

await check('Onboarding: skip lands on the Dashboard checklist; Continue setup resumes', async () => {
	await page.click('[data-onb-step="3"] [data-onb-next]');
	expect((await shownStep(page)) === '4', 'not on step 4');
	await page.click('[data-onb-step="4"] [data-onb-skip]');
	await page.waitForURL(/index\.html/);
	expect(await visible(page, '#welcome-title'), 'dashboard welcome missing after skip');
	const items = await page.locator('[data-onb-checklist] li').evaluateAll((li) => li.map((l) => (l.querySelector('.is-done') ? 'done ' : 'open ') + l.textContent.replace(', done', '').trim()));
	expect(items.join('; ') === 'done Plugin installed; done Pick where you run ads; done Connect your platforms, about 3 minutes; open Tell us if you sell to Europe; open See the first event arrive', items.join('; '));
	await page.click('[data-onb-continue]');
	await page.waitForURL(/onboarding\.html/);
	expect((await shownStep(page)) === '4', 'Continue setup did not resume at step 4');
});

await check('Onboarding: Europe Yes turns on cookie choices with the consent note; No leaves it off', async () => {
	expect(await page.isDisabled('[data-onb-eu-next]'), 'Continue should wait for an answer');
	await page.click('label:has([data-onb-eu][value="yes"])');
	expect(await visible(page, '[data-onb-eu-note="yes"]') && !(await visible(page, '[data-onb-eu-note="no"]')), 'Yes note');
	expect((await page.textContent('[data-onb-eu-note="yes"]')).includes('Respect cookie choices is on') && (await page.textContent('[data-onb-eu-note="yes"]')).includes('consent plugin'), 'consent plugin note');
	await page.click('label:has([data-onb-eu][value="no"])');
	expect(await visible(page, '[data-onb-eu-note="no"]') && !(await visible(page, '[data-onb-eu-note="yes"]')), 'No note');
	expect((await page.evaluate(() => window.WCCT_PROTO.state.eu)) === 'no', 'eu not saved as no');
	await page.click('label:has([data-onb-eu][value="yes"])');
	expect((await page.evaluate(() => window.WCCT_PROTO.state.eu)) === 'yes', 'eu not saved as yes');
});

await check('Onboarding: Verify waits, Simulate first event turns each platform green; Done; Go to dashboard', async () => {
	await page.click('[data-onb-step="4"] [data-onb-next]');
	expect((await page.locator('[data-onb-verify-row]').count()) === 2 && (await page.locator('.onb-verify-row.is-ok').count()) === 0, 'waiting rows');
	expect(await page.isDisabled('[data-onb-verify-next]'), 'Continue before the first event');
	expect(await page.$eval('[data-onb-simulate]', (b) => !!b.closest('.proto-action') && getComputedStyle(b.closest('.proto-action')).backgroundColor === 'rgb(29, 35, 39)'), 'Simulate is not styled as prototype UI');
	await page.click('[data-onb-simulate]');
	await page.waitForTimeout(1000);
	expect((await page.locator('.onb-verify-row.is-ok').count()) === 2 && !(await page.isDisabled('[data-onb-verify-next]')), 'did not turn green');
	await page.click('[data-onb-step="5"] [data-onb-next]');
	const summary = await page.locator('[data-onb-summary] li').allTextContents();
	expect(summary.join('; ') === 'Meta: sending 4 recommended events; Google: sending 4 recommended events; Respect cookie choices: on; Activity log: recording every order', summary.join('; '));
	await page.click('[data-onb-finish]');
	await page.waitForURL(/index\.html/);
	expect(await visible(page, '.stat-grid') && (await page.evaluate(() => window.WCCT_PROTO.state.install)) === 'working', 'finish should land on the working dashboard');
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

await check('Log 3.0: order-level, 24 hours, Sent column; tabs and detail; 3.1 adds search, export, retention', async () => {
	await page.goto(url('log'));
	expect((await page.textContent('[data-log-col-sent]')) === 'Sent', 'column should read Sent');
	expect(await page.locator('[data-log-rows] tr').count() === 6 && (await page.locator('[data-log-rows]', { hasText: 'Add to cart' }).count()) === 0, '3.0 log should list orders only');
	expect((await page.textContent('[data-log-count]')) === '6 orders in the last 24 hours', 'footer: ' + (await page.textContent('[data-log-count]')));
	await page.click('[data-log-tab="missed"]');
	expect(await page.locator('[data-log-rows] tr').count() === 1, 'missed tab');
	await page.click('[data-log-rows] tr');
	expect((await page.textContent('[data-log-detail]')).includes('Order #1311'), 'detail not updated');
	await page.click('[data-log-tab="all"]');
	await st(page, 'plan', 'pro');
	expect(await visible(page, '[data-log-24h]') && (await page.locator('#log-search, #log-keep').count()) === 0, 'Pro 3.0 should keep 24 hours, with no search or retention');
	await st(page, 'log', 'empty');
	expect(await page.getByText('No events yet. Place a test order and come back in a minute.').isVisible(), 'empty state');
	await st(page, 'log', 'rows');
	await setVersion(page, '3.1');
	await page.fill('#log-search', '1306');
	expect(await page.locator('[data-log-rows] tr').count() === 1 && await visible(page, '#log-keep'), '3.1 search or retention');
	await st(page, 'server', 'connected');
	await page.goto(url('log'));
	expect((await page.textContent('[data-log-col-sent]')) === 'Delivered', '3.1 with the server connected should read Delivered');
	await st(page, 'server', 'not');
	await st(page, 'plan', 'free');
	await setVersion(page, '3.0');
});

await check('Log at 1024 px: row opens detail dialog', async () => {
	const { context, page: p } = await fresh(1024);
	await p.goto(url('log'));
	await p.click('[data-log-rows] tr:nth-child(2)');
	expect(await p.locator('#log-dialog').isVisible(), 'dialog not open');
	await context.close();
});

await check('Settings > Alerts: 3.0 has only the dashboard and Doctor rows; 3.1 adds emails and Send a test', async () => {
	await page.goto(url('settings'));
	expect(await visible(page, '#alerts') && !(await visible(page, '#access')) && !(await visible(page, '#plan')), 'Alerts should be the only panel shown by default');
	expect((await page.getAttribute('[data-settings-link="alerts"]', 'aria-current')) === 'page', 'Alerts not marked current');
	const rows = await page.locator('#alerts .option-title').allTextContents();
	expect(rows.join(',') === 'Missed sales, on the dashboard,Doctor found something new', '3.0 rows: ' + rows.join(','));
	await page.click('[data-settings-link="plan"]');
	await page.waitForTimeout(100); // hashchange is async
	const pro = await page.locator('#plan .tier:nth-child(2) .feature-list li').allTextContents();
	expect(pro.join('; ') === 'Microsoft Advertising; More than one Meta pixel, each with its own events; Richer customer matching, Enhanced conversions; Extra events: View category, Add to wishlist, Registration; Custom parameters on any event; Meta catalog feed; Choose which roles can manage tracking', '3.0 Pro list: ' + pro.join('; '));
	await page.goto(url('settings'));
	await setVersion(page, '3.1');
	expect(await page.locator('.crown-link:visible').count() === 3, '3.1 Free should show 3 locked email rows');
	await page.click('.crown-link:visible >> nth=0');
	await page.waitForTimeout(100);
	expect(await visible(page, '#plan') && await page.getByText('Refunds sent to Analytics').isVisible(), 'Upgrade link should open Plan, with the 3.1 Pro list');
	await page.click('[data-settings-link="alerts"]');
	await page.waitForTimeout(100);
	await st(page, 'plan', 'pro');
	expect(await page.locator('.crown-link:visible').count() === 0, 'Pro still locked');
	await page.click('[data-send-test]');
	await page.waitForSelector('.toast', { timeout: 2000 });
	await st(page, 'plan', 'free');
	await setVersion(page, '3.0');
});

const savedState = (page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('wcct-proto-v1') || '{}'));

await check('Settings > Alerts 3.0: in-app rows only, no email wording', async () => {
	await page.goto(url('settings'));
	const text = await page.locator('#alerts').innerText();
	expect(!/e-?mail/i.test(text), '3.0 Alerts mentions email: ' + text.replace(/\s+/g, ' ').slice(0, 200));
	expect((await page.locator('#alerts input, #alerts textarea').count()) === 2, '3.0 Alerts should hold only the 2 switches');
});

await check('Settings > Setup: Run setup wizard again opens the wizard pre-filled from current settings (3.0 and 3.1)', async () => {
	for (const v of ['3.0', '3.1']) {
		await page.goto(url('settings') + '#setup');
		if (v === '3.1') await setVersion(page, '3.1');
		await st(page, 'usage', 'yes'); // a saved choice that differs from the default
		await page.goto(url('settings') + '#setup');
		expect(await visible(page, '#setup') && (await page.getAttribute('[data-settings-link="setup"]', 'aria-current')) === 'page', `${v}: Setup panel not shown`);
		const link = page.locator('[data-setup-rerun]');
		expect((await link.textContent()).trim() === 'Run setup wizard again', `${v}: entry label`);
		await link.click();
		await page.waitForURL(/onboarding\.html\?rerun=1/);
		expect((await shownStep(page)) === '1', `${v}: should open on step 1`);
		expect(await page.isChecked('#onb-usage'), `${v}: opt-in should show the saved choice (on), not the default`);
		const skips = await page.locator('[data-onb-skip]').evaluateAll((a) => a.map((e) => e.textContent.trim() + ' ' + e.getAttribute('href')));
		expect(skips.length === 5 && skips.every((t) => t === 'Close without saving settings.html#setup'), `${v}: close links ` + skips.join(' | '));
		await page.click('[data-onb-step="1"] [data-onb-next]');
		const picked = await page.$$eval('.pick-tile[aria-pressed="true"]', (t) => t.map((e) => e.getAttribute('data-platform')).join(','));
		expect(picked === 'meta,google,x', `${v}: picked tiles should match connected platforms, got ${picked}`);
		await page.click('[data-pick-continue]');
		expect((await page.inputValue('#onb-meta-id')).length >= 15, `${v}: Meta Pixel ID not pre-filled`);
		await page.click('[data-onb-connect-next]');
		expect(await page.isChecked('[data-onb-eu][value="no"]'), `${v}: Europe should reflect cookie choices off`);
	}
	await setVersion(page, '3.0');
	await st(page, 'usage', 'no');
});

await check('Setup wizard re-run: closing or skipping changes nothing; finishing saves only the opt-in', async () => {
	await page.goto(url('settings') + '#setup');
	await st(page, 'usage', 'yes');
	const before = await savedState(page);
	// Change things, then close from step 1 and from a later step.
	for (const leaveAt of [1, 4]) {
		await page.goto(url('onboarding') + '?rerun=1');
		await page.uncheck('#onb-usage');
		await page.click('[data-onb-step="1"] [data-onb-next]');
		await page.click('.pick-tile[data-platform="custom"]');
		if (leaveAt === 4) {
			await page.click('[data-pick-continue]');
			await page.click('[data-onb-connect-next]');
			await page.check('[data-onb-eu][value="yes"]');
		}
		await page.click(`[data-onb-step="${leaveAt === 1 ? 2 : 4}"] [data-onb-skip]`);
		await page.waitForURL(/settings\.html#setup/);
		const after = await savedState(page);
		expect(JSON.stringify(after) === JSON.stringify(before), `state changed after closing at step ${leaveAt}: ` + JSON.stringify(after));
		expect(await visible(page, '#setup'), 'close should land on Settings > Setup');
	}
	// Browser back / closing the tab also saves nothing: the draft never touches storage.
	await page.goto(url('onboarding') + '?rerun=1');
	await page.uncheck('#onb-usage');
	await page.goto(url('settings') + '#setup');
	expect(JSON.stringify(await savedState(page)) === JSON.stringify(before), 'leaving the page changed state');
	// Finishing saves the opt-in and nothing else.
	await page.goto(url('onboarding') + '?rerun=1');
	await page.uncheck('#onb-usage');
	await page.evaluate(() => { document.querySelectorAll('[data-onb-step]').forEach((s) => { s.hidden = s.getAttribute('data-onb-step') !== '6'; }); });
	expect((await page.textContent('[data-onb-finish]')).trim() === 'Save and go to Settings', 'finish label in re-run');
	await page.click('[data-onb-finish]');
	await page.waitForURL(/settings\.html#setup/);
	const saved = await savedState(page);
	expect(saved.usage === 'no' && JSON.stringify({ ...saved, usage: 'yes' }) === JSON.stringify(before), 'finish should change only usage: ' + JSON.stringify(saved));
	// A store still in its first setup continues it instead.
	await st(page, 'install', 'new');
	await page.reload(); // same URL with a hash: goto would not reload
	expect((await page.textContent('[data-setup-rerun]')).trim() === 'Continue setup' && (await page.getAttribute('[data-setup-rerun]', 'href')) === 'onboarding.html', 'new install should offer Continue setup');
	await st(page, 'install', 'working');
	await st(page, 'usage', 'no');
});

await check('3.1 server split reads as not final; 3.0 has no such tag', async () => {
	await page.goto(url('platforms'));
	expect(!(await page.getByText('Not final').count()) && !(await page.getByText('Plan details may change').count()), '3.0 shows the not-final tag');
	await setVersion(page, '3.1');
	await st(page, 'server', 'not');
	expect((await page.textContent('.server-upgrade h4')).includes('Not final') && await page.getByText('Plan details may change.').isVisible(), '3.1 Free: table not marked not final');
	await st(page, 'plan', 'pro');
	await st(page, 'server', 'connected');
	expect((await page.locator('.server-block h4').first().textContent()).includes('Not final') && await page.getByText('Plan details may change.').isVisible(), '3.1 Pro: split not marked not final');
	await st(page, 'plan', 'free');
	await st(page, 'server', 'not');
	await setVersion(page, '3.0');
});

await check('Settings > Integration access: new install is admin only; ticking asks first; Cancel leaves it unticked; Give access applies', async () => {
	await page.goto(url('settings') + '#access');
	await st(page, 'plan', 'pro');
	expect((await page.locator('input[data-role]:checked').count()) === 0, 'only Administrator should be ticked on a new install');
	await page.click('label:has(input[value="editor"])');
	expect(await visible(page, '#role-dialog'), 'dialog did not open');
	expect((await page.textContent('#role-dialog-title')).trim() === 'Give Editor access to Conversion Tracking?', 'title');
	expect((await page.textContent('#role-dialog')).includes('custom scripts that run on every page of your store') && !(await visible(page, '[data-role-outside]')), 'body, or outside-line shown for Editor');
	expect(!(await page.isChecked('input[value="editor"]')), 'box ticked before confirming');
	await page.click('#role-dialog button[value="cancel"]');
	await page.waitForTimeout(100);
	expect(!(await visible(page, '#role-dialog')) && !(await page.isChecked('input[value="editor"]')) && (await page.isDisabled('[data-save]')), 'Cancel should leave Editor unticked and nothing to save');
	await page.click('label:has(input[value="customer"])');
	expect(await visible(page, '[data-role-outside]') && (await page.textContent('[data-role-outside]')) === 'This role usually belongs to people outside your business.', 'Customer outside line');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(100);
	expect(!(await page.isChecked('input[value="customer"]')), 'Escape should cancel');
	await page.click('label:has(input[value="seller"])');
	expect(await visible(page, '[data-role-outside]'), 'Vendor outside line');
	await page.click('#role-dialog button[value="give"]');
	await page.waitForTimeout(100);
	expect(await page.isChecked('input[value="seller"]') && !(await page.isDisabled('[data-save]')), 'Give access should tick Vendor and enable Save');
	await page.click('label:has(input[value="seller"])');
	expect(!(await visible(page, '#role-dialog')) && !(await page.isChecked('input[value="seller"]')), 'unticking should not ask');
	await page.goto(url('settings') + '#access');
	await st(page, 'install', 'upgrade');
	expect(await page.isChecked('input[value="shop_manager"]') && (await page.locator('input[data-role]:checked').count()) === 1, 'upgrade should keep the carried-over Shop manager');
	await st(page, 'install', 'working');
	await st(page, 'plan', 'free');
});

await check('Doctor 3.0: "We checked N things", findings with one action and Dismiss, Working collapsed', async () => {
	await page.goto(url('doctor'));
	const sub = () => page.textContent('[data-doctor-sub]');
	expect((await page.textContent('#doctor-head')) === 'We checked 6 things.', 'Free header: ' + (await page.textContent('#doctor-head')));
	expect((await sub()) === "3 are worth a look and 1 we can't be sure about. Nothing is broken.", 'sub: ' + (await sub()));
	const titles = await page.locator('[data-finding]:visible .finding-title').allTextContents();
	expect(titles.join(' | ') === 'Facebook for WooCommerce is also active | Your Google Ads conversion label looks incomplete | Cookie choices are on, but no consent plugin is connected | A Google Tag Manager plugin is active', titles.join(' | '));
	for (const f of await page.locator('[data-finding]:visible').all()) {
		expect((await f.locator('.finding-actions .btn').count()) === 1 && (await f.locator('[data-finding-dismiss]').count()) === 1 && (await f.locator('.finding-why').count()) === 1, 'each finding needs one action, Dismiss and one why line');
	}
	expect((await page.locator('[data-check="plugins"] .tag').allTextContents()).join(',') === "Meta,Sure it's active,Not sure it sends purchases", 'Sure / Not sure tags');
	expect((await page.locator('[data-check="gtm"] a.btn').textContent()) === 'How to check', 'GTM how-to-check link');
	expect(!(await page.$eval('[data-working]', (d) => d.open)) && (await page.textContent('[data-working-count]')) === '2', 'Working should start collapsed with 2 passed');
	expect(!(await page.getByText(/turn its pixel off for you/).count()), 'no auto-fix offer');
	await st(page, 'plan', 'pro');
	expect((await page.textContent('#doctor-head')) === 'We checked 7 things.', 'Pro header');
	await st(page, 'plan', 'free');
});

await check('Doctor 3.0: Dismiss with Undo; Check again on the duplicate; Check my store runs 2 s and brings items back', async () => {
	const sub = () => page.textContent('[data-doctor-sub]');
	await page.click('[data-check="consent"] [data-finding-dismiss]');
	expect(!(await visible(page, '[data-check="consent"][data-finding]')) && (await sub()).startsWith('2 are worth a look'), 'dismiss count');
	await page.click('.toast .link-btn');
	expect(await visible(page, '[data-check="consent"][data-finding]') && (await sub()).startsWith('3 are'), 'Undo');
	await page.click('[data-check="plugins"] [data-finding-recheck]');
	await page.waitForTimeout(1200);
	expect(!(await visible(page, '[data-check="plugins"][data-finding]')) && (await page.textContent('[data-working-count]')) === '3', 'Check again should move it to Working');
	expect(await page.$eval('[data-pass][data-check="plugins"]', (p) => !p.hidden), 'pass row missing');
	await page.click('[data-check="ids"] [data-finding-dismiss]');
	await page.click('[data-check="consent"] [data-finding-dismiss]');
	await page.click('[data-check="gtm"] [data-finding-dismiss]');
	expect(await visible(page, '[data-clean-after-dismiss]') && (await sub()) === 'Everything is working.', 'all dismissed');
	await page.click('[data-doctor-run]');
	expect(await visible(page, '[data-doctor-running]') && (await page.textContent('[data-doctor-running]')).includes('Checking 6 things'), 'running state');
	await page.waitForTimeout(1500);
	expect(await visible(page, '[data-doctor-running]'), 'running ended before 2 s');
	await page.waitForTimeout(800);
	expect(!(await visible(page, '[data-doctor-running]')) && (await sub()).startsWith('3 are'), 'results not back');
	await st(page, 'doctorResult', 'clear');
	expect((await sub()) === 'Everything is working.' && (await page.textContent('[data-working-count]')) === '6', 'all clear');
	await st(page, 'doctorResult', 'findings');
});

await check('Doctor 3.1: keeps the extended checks, with self-fix steps and Check again', async () => {
	await page.goto(url('doctor'));
	await setVersion(page, '3.1');
	expect(await page.getByText('No second Meta pixel found in your theme or header').isVisible() && await page.getByText('Your cache plugin serves the cookie script uncached').isVisible(), 'loopback checks missing');
	expect(await page.getByText('We sent each of your last 50 purchases once').isVisible(), 'honest duplicate wording');
	expect((await page.locator('[data-finding] .finding-steps').count()) === 1 && (await page.locator('[data-finding-recheck]').count()) === 1, 'self-fix steps / Check again');
	await page.click('[data-finding-dismiss] >> nth=0');
	expect((await page.textContent('[data-findings-title]')).includes('1 is worth a look'), '3.1 dismiss count');
	await setVersion(page, '3.0');
});

await check("What's new: Free / Pro / old Pro detected; previous settings download", async () => {
	await page.goto(url('whats-new'));
	await st(page, 'oldPro', 'yes');
	expect(await page.getByText('Conversion Tracking Pro 1.1.4 is installed but paused.').isVisible(), 'old pro');
	await st(page, 'oldPro', 'no');
	await st(page, 'plan', 'pro');
	expect(await page.getByText('Pro 3.0 is active.').isVisible() && !(await page.getByText('missed-sale emails').count()), 'pro, without 3.1 emails');
	await st(page, 'plan', 'free');
	expect(await page.getByRole('button', { name: 'Download your previous settings (JSON)' }).isVisible(), 'download missing');
	expect(await page.getByText('Saved before the update. Your old settings are also kept, so you can go back to the previous version if you need to.').isVisible(), 'download line');
});

await check('Migration: state only when Upgraded; Done / In progress 45% / Needs attention', async () => {
	await page.goto(url('whats-new'));
	await page.click('#proto-state summary');
	expect((await page.locator('[data-state-key="migration"]').count()) === 0, 'Migration state shown when not Upgraded');
	await st(page, 'install', 'upgrade');
	expect((await page.locator('[data-state-key="migration"]').count()) === 3, 'Migration state missing when Upgraded');
	await page.click('#proto-state summary');
	await st(page, 'migration', 'done');
	expect(await page.getByText('Everything carried over').isVisible() && !(await visible(page, 'progress')), 'done');
	await st(page, 'migration', 'progress');
	expect(await page.getByText('Updating your order history in the background, 45%').isVisible() && await page.getByText('Tracking keeps running. No action needed.').isVisible(), 'progress text');
	expect(await page.$eval('progress', (p) => p.value === 45 && p.max === 100) && !(await page.locator('[data-when*="migration=progress"] .btn').count()), 'progress bar, no action');
	await st(page, 'migration', 'attention');
	const items = await page.locator('[data-when*="migration=attention"] .step-row').evaluateAll((r) => r.map((e) => e.querySelector('b').textContent + ' -> ' + e.querySelector('a').getAttribute('href')));
	expect(items.join('; ') === 'We split your Google Ads ID into a conversion ID and a label. -> platforms-google.html; X retired the old event codes. -> platforms-x.html', items.join('; '));
	expect(!(await page.getByText('placeholder').count()), 'custom script placeholder item should be omitted');
	await page.goto(url('index'));
	expect(await page.locator('[data-platform-status="warn"]:visible', { hasText: 'X retired' }).count() === 1, 'dashboard X card with attention');
	await st(page, 'migration', 'done');
	expect(await page.locator('[data-platform-status]:visible', { hasText: 'X retired' }).count() === 0, 'dashboard X card should clear when done');
	await st(page, 'migration', 'attention');
	await st(page, 'install', 'working');
});

await check('After an upgrade: carried-over events show Custom; feed URL line; Google split notice', async () => {
	await page.goto(url('platforms'));
	await st(page, 'install', 'upgrade');
	const t = '[data-events="meta"]';
	expect((await page.getAttribute(`${t} [aria-pressed="true"]`, 'data-ev-preset')) === 'custom', 'Meta preset should be Custom');
	expect(await page.isChecked(`${t} [data-ev-toggle="search"]`) && !(await page.isChecked(`${t} [data-ev-toggle="checkout"]`)), 'carried events not applied');
	await page.goto(url('platforms-x'));
	expect((await page.getAttribute('[data-events="x"] [aria-pressed="true"]', 'data-ev-preset')) === 'rec', 'X matches Recommended');
	await page.goto(url('platforms-google'));
	expect(await page.getByText('We split your Google Ads ID into a conversion ID and a label').isVisible(), 'Google split notice');
	await page.goto(url('catalog'));
	await st(page, 'plan', 'pro');
	expect((await page.textContent('#feed-url')).endsWith('?action=wcct-product-export') && await page.getByText('Same URL as before, so Meta keeps fetching it.').isVisible(), 'feed URL line');
	await st(page, 'install', 'working');
	expect(!(await page.getByText('Same URL as before').isVisible()), 'feed line only after an upgrade');
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
	expect(await page.getByText('Your catalog feed and your Meta pixel use different product IDs').isVisible(), 'Doctor mismatch finding missing');
	await page.goto(url('catalog'));
	await page.selectOption('[data-feed-id-type]', 'id');
	await page.goto(url('doctor'));
	expect(await page.$eval('[data-pass][data-check="ids-match"]', (p) => !p.hidden) && !(await visible(page, '[data-finding][data-check="ids-match"]')), 'Doctor match check missing');
	expect(!(await page.getByText('Catalog feed is reachable').count()), '3.0 Doctor must not fetch the feed');
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
	await Promise.all([page.waitForEvent('load'), page.click('[data-state-key="version"][data-state-val="3.1"]')]);
	expect(await visible(page, '[data-state-key="server"]'), 'Server state missing in 3.1');
	await page.click('#proto-state summary');
	await setVersion(page, '3.0');
});

await check('3.1 Meta: Sent from column, note, connect flow, Free locks, test mode, delivery settings; flag off elsewhere', async () => {
	await page.goto(url('platforms'));
	await setVersion(page, '3.1');
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
	await setVersion(page, '3.0');
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
