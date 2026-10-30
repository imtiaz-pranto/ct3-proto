/*
 * Conversion Tracking 3.0 prototype runtime.
 *
 * 1. Prototype state (Plan, Install, per-screen states) in localStorage.
 * 2. Elements with data-when="key=value" show only when the state matches.
 *    Several conditions join with ";", alternatives with "|", "!=" negates:
 *    data-when="plan=pro;install!=new"
 * 3. Renders the simulated WP admin chrome, the plugin top bar and the
 *    prototype-only state bar, so each page file holds only its content.
 * 4. Shared behaviour (switches, dialogs, toasts, help menu) and one small
 *    init function per page, keyed by <body data-page>.
 *
 * Nothing here is meant for the real build; the React screens replace it.
 */
(function () {
	'use strict';

	var ICONS = window.WCCT_ICONS || {};
	var CONFIG = window.WCCT_CONFIG || { platforms: {} };
	var KEY = 'wcct-proto-v1';
	var DEFAULTS = {
		plan: 'free',
		install: 'working',
		doctor: 'ran',
		connection: 'connected',
		doctorResult: 'findings',
		log: 'rows',
		oldPro: 'no',
		version: '3.0',
		server: 'not',
		pixelId: 'id',
		feedId: 'id',
		feed: 'ok'
	};

	var GLOBAL_STATES = [
		{ key: 'version', label: 'Version', options: [['3.0', '3.0'], ['3.1', '3.1']] },
		{ key: 'server', label: 'Server', when: 'version=3.1', options: [['not', 'Not connected'], ['connected', 'Connected']] },
		{ key: 'plan', label: 'Plan', options: [['free', 'Free'], ['pro', 'Pro']] },
		{ key: 'install', label: 'Install', options: [['new', 'New'], ['upgrade', 'Upgraded'], ['working', 'Working']] }
	];

	var PAGE_STATES = {
		'index': [{ key: 'doctor', label: 'Doctor', options: [['ran', 'Ran'], ['not', 'Not run']] }],
		'platforms': [{ key: 'connection', label: 'Meta', options: [['connected', 'Connected'], ['not', 'Not connected']] }],
		'platforms-x': [{ key: 'connection', label: 'X', options: [['connected', 'Connected'], ['not', 'Not connected']] }],
		'platforms-microsoft': [{ key: 'connection', label: 'Microsoft (Pro only)', options: [['connected', 'Connected'], ['not', 'Not connected']] }],
		'log': [{ key: 'log', label: 'Rows', options: [['rows', 'With rows'], ['empty', 'Empty']] }],
		'doctor': [{ key: 'doctorResult', label: 'Result', options: [['findings', '2 findings'], ['clear', 'All clear']] }, { key: 'feed', label: 'Catalog feed (Pro)', options: [['ok', 'Healthy'], ['fail', 'Unreachable']] }],
		'whats-new': [{ key: 'oldPro', label: 'Old Pro 1.1.4', options: [['no', 'Not installed'], ['yes', 'Detected']] }],
		'catalog': [{ key: 'feed', label: 'Feed', options: [['ok', 'Healthy'], ['fail', 'Unreachable']] }]
	};

	var SCREENS = [
		['index.html', 'Dashboard'],
		['pick-platforms.html', 'Pick platforms'],
		['platforms.html', 'Platforms: Meta'],
		['platforms-google.html', 'Platforms: Google'],
		['platforms-x.html', 'Platforms: X'],
		['platforms-microsoft.html', 'Platforms: Microsoft'],
		['platforms-custom.html', 'Platforms: Custom script'],
		['catalog.html', 'Catalog'],
		['log.html', 'Activity log'],
		['doctor.html', 'Doctor'],
		['whats-new.html', 'What\'s new'],
		['email-weekly.html', 'Weekly email'],
		['settings.html', 'Settings']
	];

	var state = load();
	var page = document.body.getAttribute('data-page') || '';

	/* ------------------------------------------------------------ state */

	function load() {
		var saved = {};
		try {
			saved = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {};
		} catch (e) {
			saved = {};
		}
		var merged = {};
		Object.keys(DEFAULTS).forEach(function (k) {
			merged[k] = saved[k] || DEFAULTS[k];
		});
		return merged;
	}

	function save() {
		try {
			window.localStorage.setItem(KEY, JSON.stringify(state));
		} catch (e) { /* private mode: state lives for this page only */ }
	}

	function setState(key, value) {
		state[key] = value;
		save();
		applyState();
		renderStateBar();
		document.dispatchEvent(new CustomEvent('wcct:state', { detail: { key: key } }));
	}

	function matches(expr) {
		return expr.split(';').every(function (cond) {
			var neg = cond.indexOf('!=') !== -1;
			var parts = cond.split(neg ? '!=' : '=');
			var vals = parts[1].split('|');
			var has = vals.indexOf(state[parts[0].trim()]) !== -1;
			return neg ? !has : has;
		});
	}

	// Server sending UI shows only in 3.1 and only where config.js says the
	// platform can do it.
	function serverOn(key) {
		var p = CONFIG.platforms[key];
		return state.version === '3.1' && !!(p && p.serverSending);
	}

	function applyState() {
		document.querySelectorAll('[data-when]').forEach(function (el) {
			el.hidden = !matches(el.getAttribute('data-when'));
		});
		// Filled only when server sending shows, so 3.0 carries no trace of it.
		document.querySelectorAll('[data-server-term]').forEach(function (el) {
			var key = el.getAttribute('data-server-term');
			el.textContent = serverOn(key) ? ' ' + CONFIG.platforms[key].serverTerm : '';
		});
		var idsMatch = state.pixelId === state.feedId ? 'yes' : 'no';
		// Adds to data-when on the same element: either can hide it.
		document.querySelectorAll('[data-id-match]').forEach(function (el) {
			el.hidden = (el.hasAttribute('data-when') && el.hidden) || el.getAttribute('data-id-match') !== idsMatch;
		});
		document.querySelectorAll('[data-pixel-id-label]').forEach(function (el) {
			el.textContent = state.pixelId === 'sku' ? 'SKU' : 'Product ID';
		});
		Object.keys(state).forEach(function (k) {
			document.body.setAttribute('data-state-' + k.toLowerCase(), state[k]);
		});
	}

	/* ------------------------------------------------------------ icons */

	function svg(name) {
		var def = ICONS[name] || '';
		var box = typeof def === 'object' ? def.viewBox : '0 0 24 24';
		var width = typeof def === 'object' ? def.stroke : 2;
		return '<svg viewBox="' + box + '" fill="none" stroke="currentColor" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (typeof def === 'object' ? def.path : def) + '</svg>';
	}

	function hydrateIcons(root) {
		(root || document).querySelectorAll('[data-icon]').forEach(function (el) {
			if (el.getAttribute('data-icon-done')) {
				return;
			}
			el.innerHTML = svg(el.getAttribute('data-icon'));
			el.classList.add('icon');
			el.setAttribute('aria-hidden', 'true');
			el.setAttribute('data-icon-done', '1');
		});
	}

	function ic(name) {
		return '<span data-icon="' + name + '"></span>';
	}

	/* ------------------------------------------------------------ shell */

	function renderChrome() {
		var shell = document.body.getAttribute('data-shell') || 'app';
		if (shell === 'none') {
			return;
		}
		var content = document.querySelector('.wp-content');
		document.body.classList.add('wp-chrome');

		var bar = document.createElement('div');
		bar.className = 'wp-adminbar';
		bar.innerHTML =
			'<a href="#" aria-label="About WordPress">' + ic('house') + '</a>' +
			'<a href="#">store.example.com</a>' +
			'<a href="#" aria-label="0 comments awaiting moderation">' + ic('message-square') + '0</a>' +
			'<a href="#">' + ic('plus') + 'New</a>' +
			'<a href="#" class="wp-howdy">Howdy, admin</a>';

		var menu = document.createElement('nav');
		menu.className = 'wp-adminmenu';
		menu.setAttribute('aria-label', 'WordPress admin menu');
		var top = ['Dashboard', 'Posts', 'Media', 'Pages', 'Comments'];
		var woo = ['Home', 'Orders', 'Customers', 'Reports', 'Settings', 'Status', 'Extensions'];
		var after = ['Products', 'Payments', 'Analytics', 'Marketing', 'Appearance', 'Plugins', 'Users', 'Tools', 'Settings'];
		var li = function (t) { return '<li><a href="#">' + t + '</a></li>'; };
		menu.innerHTML = '<ul>' + top.map(li).join('') +
			'<li class="is-open"><a href="#">WooCommerce</a><ul class="wp-submenu">' + woo.map(li).join('') +
			'<li><a href="index.html" aria-current="page">Conversion Tracking</a></li></ul></li>' +
			after.map(li).join('') + '</ul>';

		document.body.insertBefore(menu, content);
		document.body.insertBefore(bar, menu);

		var header = document.createElement('header');
		header.className = 'topbar';
		header.id = 'wcct-header';
		var brand =
			'<div class="topbar-brand">' +
			'<span class="brand-mark">' + '<span data-icon="activity"></span>' + '</span>' +
			'<a class="brand-name" href="index.html">Conversion Tracking</a>' +
			'<span class="topbar-versions"><span class="version-badge">Lite 3.0.0</span>' +
			'<span class="version-badge is-pro" data-when="plan=pro">Pro 3.0.0<span class="version-crown">' + ic('pui-crown') + '</span></span></span>' +
			'</div>';

		if (shell === 'wizard') {
			header.innerHTML = brand +
				'<ol class="topbar-steps">' +
				'<li class="step" aria-current="step"><b>1</b>Pick platforms</li>' +
				'<li class="step"><b>2</b>Connect</li>' +
				'<li class="step"><b>3</b>Done</li></ol>' +
				'<div class="topbar-end"><a class="btn ghost" href="index.html">Skip for now</a></div>';
		} else {
			var current = document.body.getAttribute('data-nav') || '';
			var tabs = [['dashboard', 'index.html', 'Dashboard'], ['platforms', 'platforms.html', 'Platforms'], ['catalog', 'catalog.html', 'Catalog'], ['log', 'log.html', 'Activity log'], ['doctor', 'doctor.html', 'Doctor'], ['settings', 'settings.html', 'Settings']];
			header.innerHTML = brand +
				'<nav class="topbar-nav" aria-label="Conversion Tracking pages">' +
				tabs.map(function (t) {
					return '<a href="' + t[1] + '"' + (t[0] === current ? ' aria-current="page"' : '') + '>' + t[2] + '</a>';
				}).join('') + '</nav>' +
				'<div class="topbar-end">' +
				'<button type="button" class="btn secondary icon-only round" aria-label="Help" aria-haspopup="true" aria-expanded="false" aria-controls="help-menu" data-help>' + ic('circle-help') + '</button>' +
				'<div class="menu" id="help-menu" hidden>' +
				'<a href="#">' + ic('book-open') + 'Docs</a>' +
				'<a href="#">' + ic('message-square') + 'Support</a>' +
				'<a href="#">' + ic('lightbulb') + 'Feature request</a></div></div>';
		}
		content.insertBefore(header, content.firstChild);
		renderHelpDrawers();
	}

	// Below 1280 px each Help column becomes a drawer opened by the ? button.
	// The drawer also carries the Docs / Support links from the help menu.
	var helpNarrow = window.matchMedia('(max-width: 1279px)');

	function renderHelpDrawers() {
		var helps = document.querySelectorAll('aside.help');
		if (!helps.length) {
			return;
		}
		helps.forEach(function (aside, i) {
			aside.id = aside.id || 'help-drawer-' + i;
			var head = document.createElement('div');
			head.className = 'help-drawer-head';
			head.innerHTML = '<h2 class="detail-title">Help</h2>' +
				'<button type="button" class="btn ghost icon-only" data-help-close aria-label="Close help">' + ic('x') + '</button>';
			aside.insertBefore(head, aside.firstChild);
			var more = document.createElement('div');
			more.className = 'help-drawer-more';
			more.innerHTML = '<a href="#">' + ic('book-open') + 'Docs</a>' +
				'<a href="#">' + ic('message-square') + 'Support</a>' +
				'<a href="#">' + ic('lightbulb') + 'Feature request</a>';
			aside.appendChild(more);
		});
		var backdrop = document.createElement('div');
		backdrop.className = 'help-backdrop';
		backdrop.setAttribute('data-help-close', '');
		document.body.appendChild(backdrop);
		helpNarrow.addEventListener('change', function () {
			if (!helpNarrow.matches) {
				setHelpDrawer(false);
			}
		});
	}

	function visibleHelp() {
		return Array.prototype.filter.call(document.querySelectorAll('aside.help'), function (a) {
			return !a.closest('[hidden]');
		})[0];
	}

	function setHelpDrawer(open) {
		var btn = document.querySelector('[data-help]');
		var aside = visibleHelp();
		document.body.classList.toggle('is-help-open', open);
		if (btn) {
			btn.setAttribute('aria-expanded', String(open));
			btn.setAttribute('aria-controls', open && aside ? aside.id : 'help-menu');
		}
		if (open && aside) {
			aside.querySelector('[data-help-close]').focus();
		} else if (btn && document.activeElement && document.activeElement.closest('aside.help')) {
			btn.focus();
		}
	}

	function renderStateBar() {
		var bar = document.getElementById('proto-state');
		// Collapsed by default so it never hides a Save button; remembers the choice.
		var open = false;
		try {
			open = window.localStorage.getItem(KEY + '-bar') === 'open';
		} catch (e) { /* ignore */ }
		if (bar) {
			open = bar.open;
			bar.remove();
		}
		bar = document.createElement('details');
		bar.className = 'state-bar';
		bar.id = 'proto-state';
		bar.open = open;
		var groups = GLOBAL_STATES.concat(PAGE_STATES[page] || []).filter(function (g) { return !g.when || matches(g.when); });
		bar.innerHTML = '<summary><span class="proto-tag">PROTOTYPE</span>States: ' + state.version + ', ' + state.plan.replace('free', 'Free').replace('pro', 'Pro') + ', ' + { 'new': 'New', upgrade: 'Upgraded', working: 'Working' }[state.install] + '</summary>' +
			'<p class="state-note">Prototype only, not part of the product.</p>' +
			'<div class="state-bar-body">' +
			groups.map(function (g) {
				return '<fieldset class="state-group"><legend>' + g.label + '</legend><div class="state-seg">' +
					g.options.map(function (o) {
						return '<button type="button" data-state-key="' + g.key + '" data-state-val="' + o[0] + '" aria-pressed="' + (state[g.key] === o[0]) + '">' + o[1] + '</button>';
					}).join('') + '</div></fieldset>';
			}).join('') +
			'<label class="state-group"><span>Screen</span><select class="input" data-screen-jump aria-label="Jump to screen">' +
			SCREENS.map(function (s) {
				return '<option value="' + s[0] + '"' + (s[0].replace('.html', '') === page ? ' selected' : '') + '>' + s[1] + '</option>';
			}).join('') + '</select></label>' +
			'<button type="button" class="link-btn" data-state-reset>Reset all states</button>' +
			'</div>';
		document.body.appendChild(bar);
		bar.addEventListener('toggle', function () {
			try {
				window.localStorage.setItem(KEY + '-bar', bar.open ? 'open' : 'closed');
			} catch (e) { /* ignore */ }
		});
	}

	/* ----------------------------------------------------- shared widgets */

	function toast(message, opts) {
		opts = opts || {};
		var wrap = document.querySelector('.toasts');
		if (!wrap) {
			wrap = document.createElement('div');
			wrap.className = 'toasts';
			wrap.setAttribute('role', 'status');
			wrap.setAttribute('aria-live', 'polite');
			document.body.appendChild(wrap);
		}
		var t = document.createElement('div');
		t.className = 'toast';
		t.innerHTML = ic(opts.icon || 'circle-check') + '<span></span>';
		t.querySelector('span:last-child').textContent = message;
		if (opts.undo) {
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'link-btn';
			b.textContent = 'Undo';
			b.addEventListener('click', function () {
				opts.undo();
				t.remove();
			});
			t.appendChild(b);
		}
		wrap.appendChild(t);
		hydrateIcons(t);
		setTimeout(function () { t.remove(); }, opts.ms || 3200);
	}

	function busy(btn, label, ms, done) {
		var original = btn.innerHTML;
		btn.disabled = true;
		btn.classList.add('is-busy');
		btn.innerHTML = ic('loader-circle') + label;
		hydrateIcons(btn);
		setTimeout(function () {
			btn.disabled = false;
			btn.classList.remove('is-busy');
			btn.innerHTML = original;
			done();
		}, ms);
	}

	function bindGlobal() {
		document.addEventListener('click', function (e) {
			var stateBtn = e.target.closest('[data-state-key]');
			if (stateBtn) {
				setState(stateBtn.getAttribute('data-state-key'), stateBtn.getAttribute('data-state-val'));
				return;
			}
			if (e.target.closest('[data-state-reset]')) {
				state = JSON.parse(JSON.stringify(DEFAULTS));
				save();
				window.location.reload();
				return;
			}
			if (e.target.closest('[data-help-close]')) {
				setHelpDrawer(false);
				return;
			}
			var help = e.target.closest('[data-help]');
			var menu = document.getElementById('help-menu');
			if (help && helpNarrow.matches && visibleHelp()) {
				setHelpDrawer(!document.body.classList.contains('is-help-open'));
				return;
			}
			if (help && menu) {
				var openNow = menu.hidden;
				menu.hidden = !openNow;
				help.setAttribute('aria-expanded', String(openNow));
				return;
			}
			if (menu && !menu.hidden && !e.target.closest('#help-menu')) {
				menu.hidden = true;
				document.querySelector('[data-help]').setAttribute('aria-expanded', 'false');
			}
			var opener = e.target.closest('[data-dialog-open]');
			if (opener) {
				document.getElementById(opener.getAttribute('data-dialog-open')).showModal();
				return;
			}
			var copy = e.target.closest('[data-copy]');
			if (copy) {
				var text = document.getElementById(copy.getAttribute('data-copy')).textContent;
				// file:// or no permission: the toast still confirms the prototype action
				if (navigator.clipboard) {
					navigator.clipboard.writeText(text).catch(function () {});
				}
				toast('Copied the feed URL.', { icon: 'copy' });
				return;
			}
			var toaster = e.target.closest('[data-toast]');
			if (toaster) {
				toast(toaster.getAttribute('data-toast'));
				return;
			}
			var dismiss = e.target.closest('[data-dismiss]');
			if (dismiss) {
				var target = dismiss.closest(dismiss.getAttribute('data-dismiss'));
				target.hidden = true;
				toast('Dismissed', { undo: function () { target.hidden = false; } });
			}
		});
		document.addEventListener('change', function (e) {
			if (e.target.matches('[data-screen-jump]')) {
				window.location.href = e.target.value;
			}
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && document.body.classList.contains('is-help-open')) {
				setHelpDrawer(false);
				return;
			}
			var menu = document.getElementById('help-menu');
			if (e.key === 'Escape' && menu && !menu.hidden) {
				menu.hidden = true;
				document.querySelector('[data-help]').setAttribute('aria-expanded', 'false');
				document.querySelector('[data-help]').focus();
			}
		});
		// A link to a setting inside a closed Advanced settings opens it.
		if (window.location.hash) {
			var target = document.getElementById(window.location.hash.slice(1));
			var details = target && target.closest('details');
			if (details) {
				details.open = true;
				target.scrollIntoView({ block: 'center' });
			}
		}
		// Collapsible switch cards: body follows the switch.
		document.querySelectorAll('.event-row').forEach(syncEventRow);
		document.addEventListener('change', function (e) {
			var row = e.target.closest('.event-row');
			if (row && e.target.matches('.event-row-head .switch input')) {
				syncEventRow(row);
			}
		});
	}

	function syncEventRow(row) {
		var input = row.querySelector('.event-row-head .switch input');
		if (!input) {
			return;
		}
		var body = row.querySelector('.event-row-body');
		if (body) {
			body.hidden = !input.checked;
		}
		var pill = row.querySelector('.event-row-head .pill');
		if (pill) {
			pill.className = 'pill ' + (input.checked ? 'ok' : 'off');
			pill.textContent = input.checked ? 'On' : 'Off';
		}
	}

	/* ------------------------------------------------------- events table
	 * <div data-events="meta"> renders the platform's events from config.js:
	 * Event / On / (3.1: Sent from) / Last seen and a Recommended | All |
	 * Custom preset. Every event is listed; Recommended only sets which are on.
	 */
	function eventsTable(el) {
		var key = el.getAttribute('data-events');
		var p = CONFIG.platforms[key];
		var on = {};
		var preset = 'rec';
		p.events.forEach(function (e) { on[e.key] = !!e.rec; });

		function locked(e) {
			return e.pro && state.plan !== 'pro';
		}
		function isOn(e) {
			return on[e.key] && !locked(e);
		}
		function applyPreset(name) {
			preset = name;
			if (name === 'custom') {
				return;
			}
			p.events.forEach(function (e) { on[e.key] = name === 'all' || !!e.rec; });
		}
		function sentFrom(e) {
			if (!isOn(e)) {
				return '<span class="ev-off">Not sent</span>';
			}
			var proOnly = e.server === 'pro' && state.plan !== 'pro';
			if (state.server !== 'connected' || proOnly) {
				return '<span class="ev-from">' + ic('monitor') + 'Browser' +
					(proOnly && state.server === 'connected' ? '<span class="lock-inline" title="Pro also sends this from your server">' + ic('lock') + '<span class="sr-only">. Pro also sends this from your server.</span></span>' : '') + '</span>';
			}
			return '<span class="ev-from">' + ic('monitor') + 'Browser + server</span>';
		}
		function seen(e) {
			if (!isOn(e)) {
				return '<span class="ev-off">Off</span>';
			}
			if (state.connection === 'not' && key !== 'google') {
				return '<span class="ev-off">Not yet</span>';
			}
			return '<span class="ev-seen">' + e.seen + '</span>';
		}
		function render() {
			var server = serverOn(key);
			var count = p.events.filter(isOn).length;
			var rows = p.events.map(function (e) {
				var lockedNow = locked(e);
				return '<tr data-ev="' + e.key + '">' +
					'<th scope="row"><span class="ev-name">' + esc(e.name) +
					(lockedNow ? '<span class="pro-badge">' + ic('pui-crown') + 'PRO</span>' : '') + '</span>' +
					'<span class="ev-desc">' + esc(e.desc) + '</span></th>' +
					'<td class="col-on">' + (lockedNow
						? '<span class="lock-icon">' + ic('lock') + '<span class="sr-only">' + esc(e.name) + ' is a Pro event</span></span>'
						: '<label class="switch"><input type="checkbox" role="switch" data-ev-toggle="' + e.key + '"' + (on[e.key] ? ' checked' : '') + '><span class="switch-track"></span><span class="sr-only">Send ' + esc(e.name) + '</span></label>') +
					'</td>' +
					(server ? '<td class="col-from">' + sentFrom(e) + '</td>' : '') +
					'<td class="col-seen">' + seen(e) + '</td></tr>';
			}).join('');
			var presets = [['rec', 'Recommended'], ['all', 'All'], ['custom', 'Custom']];
			el.innerHTML = '<div class="events-head">' +
				'<h3 class="events-title" id="events-title-' + key + '">Events</h3>' +
				'<span class="events-count" aria-live="polite">' + count + ' of ' + p.events.length + ' on</span>' +
				'<div class="chips" role="group" aria-label="Event preset">' + presets.map(function (o) {
					return '<button type="button" class="chip" data-ev-preset="' + o[0] + '" aria-pressed="' + (preset === o[0]) + '">' + o[1] + '</button>';
				}).join('') + '</div></div>' +
				'<div class="events-wrap"><table class="events-table" aria-labelledby="events-title-' + key + '">' +
				'<thead><tr><th scope="col">Event</th><th scope="col" class="col-on">On</th>' +
				(server ? '<th scope="col" class="col-from">Sent from</th>' : '') +
				'<th scope="col" class="col-seen">Last seen</th></tr></thead>' +
				'<tbody>' + rows + '</tbody>' +
				'</table></div>' +
				(server ? '<p class="events-note">Browser tracking always runs. Server sending only adds a second copy, and ' + esc(p.name) + ' keeps one.</p>' : '');
			hydrateIcons(el);
		}
		function changed() {
			el.dispatchEvent(new Event('change', { bubbles: true }));
		}
		el.addEventListener('click', function (e) {
			var b = e.target.closest('[data-ev-preset]');
			if (b) {
				applyPreset(b.getAttribute('data-ev-preset'));
				render();
				changed();
				el.querySelector('[data-ev-preset="' + preset + '"]').focus();
			}
		});
		el.addEventListener('change', function (e) {
			var t = e.target.closest('[data-ev-toggle]');
			if (!t) {
				return;
			}
			on[t.getAttribute('data-ev-toggle')] = t.checked;
			preset = 'custom';
			render();
			el.querySelector('[data-ev-toggle="' + t.getAttribute('data-ev-toggle') + '"]').focus();
		});
		document.addEventListener('wcct:state', render);
		render();
	}

	/* ---------------------------------------------------- server sending
	 * 3.1 only, and only for platforms whose config.js flag is on. Browser
	 * tracking always runs; the server adds a second copy that the platform
	 * deduplicates by event ID. There is no server-only option anywhere.
	 * Free/Pro split per decision C1, confirmed 2026-10-28: Free sends Purchase and
	 * the shopping steps with basic matching; Pro sends every event with
	 * full matching.
	 */
	function serverSection(el) {
		var key = el.getAttribute('data-server-section');
		var p = CONFIG.platforms[key];
		var testMode = false;

		function render() {
			if (!serverOn(key)) {
				el.innerHTML = '';
				el.hidden = true;
				return;
			}
			el.hidden = false;
			var pro = state.plan === 'pro';
			var connected = state.server === 'connected';
			var freeEvents = p.events.filter(function (e) { return e.server === 'free'; }).map(function (e) { return e.name; });
			var h = '<div class="server">' +
				'<div class="server-head">' +
				'<span class="server-icon">' + ic('server') + '</span>' +
				'<div class="server-head-text"><h3 class="events-title" id="server-title-' + key + '">Server sending</h3>' +
				'<p class="small muted">Sales still reach ' + esc(p.name) + ' when an ad blocker or a declined cookie banner stops the browser pixel.</p></div>' +
				'<span class="pill ' + (connected ? 'ok">Connected' : 'off">Not connected') + '</span></div>' +
				'<div class="server-body">' +
				'<div class="flow" role="group" aria-label="How server sending works">' +
				'<span class="flow-node">' + ic('monitor') + 'Shopper\'s browser</span><span class="flow-op" aria-hidden="true">+</span>' +
				'<span class="flow-node">' + ic('store') + 'Your store\'s server</span><span class="flow-op" aria-hidden="true">' + ic('arrow-right') + '</span>' +
				'<span class="flow-node"><span class="logo xs"><img src="assets/logos/' + ({ meta: 'meta.svg', google: 'google-analytics.svg', x: 'x.svg', microsoft: 'microsoft.svg' })[key] + '" alt=""></span>' + esc(p.name) + ' keeps one copy</span></div>';
			if (!connected) {
				h += '<ol class="server-steps">' +
					'<li><span class="server-step-title">Create an access token</span>' +
					'<span class="small muted">In ' + esc(p.name) + ' Events Manager, open your pixel\'s Settings, find Conversions API and choose Generate access token. <a href="#">How to create one</a></span></li>' +
					'<li><div class="field"><label for="server-token-' + key + '">Paste the access token</label>' +
					'<input type="text" id="server-token-' + key + '" placeholder="Starts with EAA" autocomplete="off" spellcheck="false"></div></li></ol>' +
					'<div><button type="button" class="btn primary" data-server-connect>Connect and send a test event</button></div>';
			} else {
				h += '<div class="server-block"><h4>What\'s being sent</h4><p class="small">' +
					(pro ? 'Every event that\'s on in the table above, built from your store\'s own records.'
						: esc(freeEvents.join(', ').replace(/, ([^,]*)$/, ' and $1')) + ', built from your store\'s own records.') +
					' Each copy carries the same event ID as the browser, so ' + esc(p.name) + ' counts it once.</p></div>' +
					'<div class="server-block"><h4>Last 7 days</h4><div class="stat-grid is-3">' +
					'<div class="card stat-card"><span class="stat-icon">' + ic('server') + '</span><div><span class="stat-value">1,284</span><span class="stat-label">Sent from server</span></div></div>' +
					'<div class="card stat-card"><span class="stat-icon is-ok">' + ic('check') + '</span><div><span class="stat-value">1,281</span><span class="stat-label">Delivered</span></div></div>' +
					'<div class="card stat-card"><span class="stat-icon is-off">' + ic('refresh-cw') + '</span><div><span class="stat-value">3</span><span class="stat-label">Retrying</span></div></div>' +
					'</div></div>' +
					'<div class="server-block"><h4>Customer details shared</h4><p class="small">' +
					(pro ? 'Email, phone, name, city, zip, customer ID, ad click ID, IP address and browser.'
						: 'Email, phone, ad click ID, IP address and browser.') +
					' They\'re scrambled before they leave your store, so ' + esc(p.name) + ' can match them to people but never sees them in plain text. Only sent when the shopper allows marketing cookies.</p></div>' +
					'<div class="server-block"><h4>Connection</h4>' +
					'<div class="field"><label for="server-token-' + key + '">Access token</label>' +
					'<input type="text" id="server-token-' + key + '" value="••••••••a91F" autocomplete="off" spellcheck="false"></div>' +
					'<div class="option-row"><div><div class="option-title">Test mode</div><div class="option-desc">Sends events to Test events in ' + esc(p.name) + ' Events Manager instead of your reports.</div></div>' +
					'<label class="switch"><input type="checkbox" role="switch" data-server-test' + (testMode ? ' checked' : '') + '><span class="switch-track"></span><span class="sr-only">Test mode</span></label></div>' +
					(testMode ? '<div class="field"><label for="server-test-code-' + key + '">Test event code</label>' +
						'<input type="text" id="server-test-code-' + key + '" placeholder="Like TEST12345" autocomplete="off"></div>' : '') +
					'</div>';
			}
			if (!pro) {
				h += '<div class="server-upgrade"><h4>Free and Pro</h4>' +
					'<table class="compare-table"><thead><tr><th scope="col"><span class="sr-only">Feature</span></th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead><tbody>' +
					'<tr><th scope="row">Events from the server</th><td>Purchase and the shopping steps</td><td>Every event</td></tr>' +
					'<tr><th scope="row">Customer matching</th><td>Email, phone, click ID, IP, browser</td><td>Adds name, city, zip and customer ID</td></tr>' +
					'<tr><th scope="row">Other platforms</th><td>Browser tracking</td><td>Server sending as each platform supports it</td></tr>' +
					'</tbody></table>' +
					'<div><a class="btn pro" href="settings.html#plan">Upgrade to Pro' + ic('pui-crown') + '</a></div></div>';
			}
			el.innerHTML = h + '</div></div>';
			el.setAttribute('aria-labelledby', 'server-title-' + key);
			hydrateIcons(el);
		}
		el.addEventListener('click', function (e) {
			var b = e.target.closest('[data-server-connect]');
			if (b) {
				busy(b, 'Connecting', 900, function () {
					setState('server', 'connected');
					toast('Connected. A test event is on its way to ' + p.name + ' Events Manager.');
				});
			}
		});
		el.addEventListener('change', function (e) {
			if (e.target.matches('[data-server-test]')) {
				testMode = e.target.checked;
				render();
				el.querySelector('[data-server-test]').focus();
			}
		});
		document.addEventListener('wcct:state', render);
		render();
	}

	// Delivery mode and retries, inside Advanced settings.
	function serverSettings(el) {
		var key = el.getAttribute('data-server-settings');
		function render() {
			if (!serverOn(key)) {
				el.innerHTML = '';
				return;
			}
			el.innerHTML = '<div class="stack">' +
				'<div class="field"><label for="server-delivery-' + key + '">Server delivery</label>' +
				'<select id="server-delivery-' + key + '"><option selected>Right away (recommended)</option><option>In batches, once a minute</option></select>' +
				'<p class="field-hint">Batches put less load on busy stores. Events still arrive within a minute.</p></div>' +
				'<div class="field"><label for="server-retries-' + key + '">If ' + esc(CONFIG.platforms[key].name) + ' doesn\'t answer</label>' +
				'<select id="server-retries-' + key + '"><option selected>Retry for up to 24 hours (recommended)</option><option>Retry for up to 1 hour</option><option>Don\'t retry</option></select>' +
				'<p class="field-hint">Retries show as "Retrying" in Server sending until they get through.</p></div></div>';
		}
		document.addEventListener('wcct:state', render);
		render();
	}

	/* ------------------------------------------------------------ pages */

	var pages = {};

	pages['index'] = function () {
		var chips = document.querySelectorAll('[data-filter]');
		chips.forEach(function (chip) {
			chip.addEventListener('click', function () {
				var f = chip.getAttribute('data-filter');
				chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
				document.querySelectorAll('[data-platform-status]').forEach(function (card) {
					var s = card.getAttribute('data-platform-status');
					var inState = !card.hasAttribute('data-when') || matches(card.getAttribute('data-when'));
					card.hidden = !inState || !(f === 'all' || (f === 'working' && s === 'ok') || (f === 'attention' && s === 'warn'));
				});
			});
		});

		var series = {
			'7': { labels: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'], values: [14, 22, 19, 31, 26, 37, 34] },
			'30': { labels: ['Sep 24', 'Oct 1', 'Oct 8', 'Oct 15', 'Oct 22'], values: [18, 22, 17, 25, 21, 28, 24, 30, 26, 31, 22, 27, 35, 29, 24, 33, 28, 36, 31, 25, 30, 38, 33, 29, 34, 40, 31, 37, 35, 34] },
			'month': { labels: ['Oct 1', 'Oct 8', 'Oct 15', 'Oct 22'], values: [22, 27, 35, 29, 24, 33, 28, 36, 31, 25, 30, 38, 33, 29, 34, 40, 31, 37, 35, 30, 34, 36, 34] }
		};
		var chart = document.querySelector('[data-chart]');
		var select = document.querySelector('[data-chart-period]');
		function draw(key) {
			var d = series[key];
			var w = 720;
			var h = 180;
			var max = Math.max.apply(null, d.values) * 1.15;
			var step = w / (d.values.length - 1);
			var pts = d.values.map(function (v, i) { return [Math.round(i * step), Math.round(h - (v / max) * (h - 10))]; });
			var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
			var area = line + ' L' + w + ' ' + h + ' L0 ' + h + 'Z';
			var grid = [40, 90, 140].map(function (y) { return '<line class="grid-line" x1="0" x2="' + w + '" y1="' + y + '" y2="' + y + '"/>'; }).join('');
			var labels = d.labels.map(function (l, i) {
				var x = Math.round(i * (w - 30) / (d.labels.length - 1));
				return '<text class="axis" x="' + x + '" y="198">' + l + '</text>';
			}).join('');
			var total = d.values.reduce(function (a, b) { return a + b; }, 0);
			chart.innerHTML = '<svg viewBox="0 0 720 200" preserveAspectRatio="none" role="img" aria-label="Area chart: ' + total + ' tracked events, ' + select.options[select.selectedIndex].text.toLowerCase() + '">' +
				grid + '<path class="area" d="' + area + '"/><path class="line" d="' + line + '"/>' + labels + '</svg>';
		}
		if (chart && select) {
			draw(select.value);
			select.addEventListener('change', function () { draw(select.value); });
		}
	};

	pages['pick-platforms'] = function () {
		var tiles = document.querySelectorAll('.pick-tile[data-platform]');
		var count = document.querySelector('[data-pick-count]');
		var go = document.querySelector('[data-pick-continue]');
		var names = { meta: 'Meta', google: 'Google', x: 'X', microsoft: 'Microsoft Advertising', custom: 'a custom script' };
		var links = { meta: 'platforms.html', google: 'platforms-google.html', x: 'platforms-x.html', microsoft: 'platforms-microsoft.html', custom: 'platforms-custom.html' };
		function update() {
			var picked = Array.prototype.filter.call(tiles, function (t) { return t.getAttribute('aria-pressed') === 'true'; });
			var n = picked.length;
			if (!n) {
				count.textContent = 'Nothing selected. Pick at least one, or skip for now.';
				go.setAttribute('aria-disabled', 'true');
				go.removeAttribute('href');
				go.textContent = 'Pick a platform to continue';
				return;
			}
			count.textContent = n + ' selected. About 3 minutes each.';
			var first = picked[0].getAttribute('data-platform');
			go.removeAttribute('aria-disabled');
			go.setAttribute('href', links[first]);
			go.textContent = 'Continue to connect ' + names[first];
		}
		tiles.forEach(function (t) {
			t.addEventListener('click', function () {
				t.setAttribute('aria-pressed', String(t.getAttribute('aria-pressed') !== 'true'));
				update();
			});
		});
		update();
	};

	function platformPage(platformName) {
		var form = document.querySelector('[data-platform-form]');
		var saveBtn = document.querySelector('[data-save]');
		var savedNote = document.querySelector('[data-saved-note]');
		var paused = false;

		function renderPause() {
			document.querySelectorAll('[data-when-paused]').forEach(function (el) {
				el.hidden = el.getAttribute('data-when-paused') === 'yes' ? !paused : paused;
			});
		}
		var dialog = document.getElementById('pause-dialog');
		if (dialog) {
			dialog.addEventListener('close', function () {
				if (dialog.returnValue === 'pause') {
					paused = true;
					renderPause();
					toast('Tracking paused on ' + platformName + '. Your settings are kept.', { icon: 'pause' });
				}
			});
		}
		document.querySelectorAll('[data-resume]').forEach(function (b) {
			b.addEventListener('click', function () {
				paused = false;
				renderPause();
				toast('Tracking resumed on ' + platformName + '.');
			});
		});
		renderPause();

		if (form && saveBtn) {
			form.addEventListener('input', markDirty);
			form.addEventListener('change', markDirty);
			saveBtn.addEventListener('click', function () {
				busy(saveBtn, 'Saving', 700, function () {
					saveBtn.disabled = true;
					saveBtn.textContent = 'Saved';
					if (savedNote) {
						savedNote.textContent = 'Saved just now';
					}
					toast('Saved. ' + platformName + ' settings are live.');
				});
			});
		}
		function markDirty() {
			saveBtn.disabled = false;
			saveBtn.textContent = 'Save changes';
			if (savedNote) {
				savedNote.textContent = 'Unsaved changes';
			}
		}
		document.querySelectorAll('[data-connect]').forEach(function (b) {
			b.addEventListener('click', function () {
				busy(b, 'Connecting', 900, function () {
					setState('connection', 'connected');
					toast('Connected. Waiting for the first event from your store.');
				});
			});
		});
	}

	// "Product ID sent" (Meta) and "ID used in the feed" (Catalog) share
	// prototype state so the Catalog page and the Doctor can compare them.
	function bindIdType(sel, key) {
		var el = document.querySelector(sel);
		if (!el) {
			return;
		}
		el.value = state[key];
		el.addEventListener('change', function () { setState(key, el.value); });
	}

	pages['catalog'] = function () {
		platformPage('Catalog');
		bindIdType('[data-feed-id-type]', 'feedId');
		var search = document.querySelector('[data-cat-search]');
		var tree = document.querySelector('[data-cat-tree]');
		var empty = document.querySelector('[data-cat-empty]');
		// Show a category when it or anything below it matches; keep parents
		// visible so the path stays readable.
		function filter() {
			var q = search.value.trim().toLowerCase();
			function walk(li) {
				var own = li.querySelector(':scope > label').textContent.toLowerCase().indexOf(q) !== -1;
				var kids = Array.prototype.map.call(li.querySelectorAll(':scope > ul > li'), walk).some(Boolean);
				li.hidden = !!q && !own && !kids;
				return !li.hidden;
			}
			var any = Array.prototype.map.call(tree.querySelectorAll(':scope > li'), walk).some(Boolean);
			empty.hidden = any;
		}
		search.addEventListener('input', filter);

		// Ticking a parent ticks everything under it; a parent shows a dash
		// when only some of its children are ticked.
		var countEl = document.querySelector('[data-cat-count]');
		var boxes = tree.querySelectorAll('input[type="checkbox"]');
		function kids(input) {
			return input.closest('li').querySelectorAll(':scope > ul input[type="checkbox"]');
		}
		function syncParents() {
			Array.prototype.slice.call(tree.querySelectorAll('li')).reverse().forEach(function (li) {
				var own = li.querySelector(':scope > label input');
				var children = li.querySelectorAll(':scope > ul > li > label input');
				if (!children.length) {
					return;
				}
				var on = Array.prototype.filter.call(children, function (c) { return c.checked; }).length;
				var partial = Array.prototype.some.call(children, function (c) { return c.indeterminate; });
				own.checked = on === children.length;
				own.indeterminate = !own.checked && (on > 0 || partial);
			});
			var left = Array.prototype.filter.call(boxes, function (b) { return b.checked; }).length;
			countEl.textContent = left + ' of ' + boxes.length + ' left out';
		}
		tree.addEventListener('change', function (e) {
			if (!e.target.matches('input[type="checkbox"]')) {
				return;
			}
			Array.prototype.forEach.call(kids(e.target), function (k) { k.checked = e.target.checked; });
			syncParents();
		});
		document.querySelector('[data-cat-clear]').addEventListener('click', function () {
			Array.prototype.forEach.call(boxes, function (b) { b.checked = false; b.indeterminate = false; });
			syncParents();
			tree.dispatchEvent(new Event('change', { bubbles: true }));
		});
		syncParents();
	};

	pages['platforms'] = function () {
		platformPage('Meta');
		bindIdType('[data-pixel-id-type]', 'pixelId');
		var input = document.getElementById('pixel-id');
		var hint = document.querySelector('[data-pixel-hint]');
		var good = document.querySelector('[data-pixel-good]');
		var bad = document.querySelector('[data-pixel-bad]');
		function check() {
			var v = input.value.trim();
			var ok = /^\d{15,16}$/.test(v);
			var token = /^EAA/i.test(v);
			good.hidden = !ok;
			bad.hidden = ok || !v || !(token || v.length > 3);
			bad.querySelector('span:last-child').textContent = token
				? 'That looks like an access token, not a Pixel ID. The Pixel ID is 15 or 16 digits.'
				: 'Pixel IDs are 15 or 16 digits, numbers only. Check the help on the right.';
			hint.hidden = ok || !bad.hidden;
			input.closest('.field').classList.toggle('is-bad', !bad.hidden);
		}
		input.addEventListener('input', check);
		check();
	};

	pages['platforms-x'] = function () {
		platformPage('X');
		// Upgraders carry only the retired single-event code, so the field starts empty.
		var eventId = document.getElementById('x-event-id');
		function sync() {
			eventId.value = state.install === 'upgrade' ? '' : 'tw-o8x2k-o8x3a';
		}
		document.querySelectorAll('[data-focus]').forEach(function (b) {
			b.addEventListener('click', function () { document.getElementById(b.getAttribute('data-focus')).focus(); });
		});
		document.addEventListener('wcct:state', sync);
		sync();
	};
	pages['platforms-microsoft'] = function () { platformPage('Microsoft Advertising'); };

	pages['platforms-google'] = function () {
		platformPage('Google');
		var radios = document.querySelectorAll('input[name="google-products"]');
		var ga = document.getElementById('ga-id');
		var aw = document.getElementById('aw-id');
		var label = document.getElementById('aw-label');
		function product() {
			var r = document.querySelector('input[name="google-products"]:checked');
			return r ? r.value : 'both';
		}
		function check() {
			var p = product();
			document.querySelectorAll('[data-google]').forEach(function (el) {
				var needs = el.getAttribute('data-google');
				el.hidden = !(p === 'both' || p === needs);
			});
			var gaOk = /^G-[A-Z0-9]{6,}$/i.test(ga.value.trim());
			toggleField(ga, gaOk);
			var awOk = /^AW-\d{6,}$/i.test(aw.value.trim());
			toggleField(aw, awOk);
			var labelOk = label.value.trim().length >= 10;
			toggleField(label, labelOk);

			var problems = [];
			if (p !== 'ads' && !gaOk) {
				problems.push('ga');
			}
			if (p !== 'analytics' && (!awOk || !labelOk)) {
				problems.push('ads');
			}
			var attention = problems.length > 0;
			document.querySelectorAll('[data-google-status]').forEach(function (el) {
				var want = el.getAttribute('data-google-status');
				el.hidden = want === 'warn' ? !attention : attention;
			});
		}
		function toggleField(input, ok) {
			var field = input.closest('.field');
			var good = field.querySelector('.field-good');
			var bad = field.querySelector('.field-bad');
			if (good) {
				good.hidden = !ok;
			}
			if (bad) {
				bad.hidden = ok;
			}
			field.classList.toggle('is-bad', !ok);
		}
		radios.forEach(function (r) { r.addEventListener('change', check); });
		[ga, aw, label].forEach(function (i) { i.addEventListener('input', check); });
		check();
	};

	pages['platforms-custom'] = function () { platformPage('Custom script'); };
	// Settings: Alerts, Integration access and Plan, one panel at a time,
	// picked by the URL hash so other pages can link to a section.
	pages['settings'] = function () {
		platformPage('Access');
		var panels = document.querySelectorAll('[data-settings-panel]');
		function show() {
			var want = window.location.hash.slice(1);
			var match = document.getElementById(want);
			var id = match && match.hasAttribute('data-settings-panel') ? want : 'alerts';
			panels.forEach(function (p) { p.hidden = p.id !== id; });
			document.querySelectorAll('[data-settings-link]').forEach(function (a) {
				if (a.getAttribute('data-settings-link') === id) {
					a.setAttribute('aria-current', 'page');
				} else {
					a.removeAttribute('aria-current');
				}
			});
			window.scrollTo(0, 0);
		}
		window.addEventListener('hashchange', show);
		show();
		var testBtn = document.querySelector('[data-send-test]');
		var to = document.getElementById('alert-email');
		if (testBtn) {
			testBtn.addEventListener('click', function () {
				busy(testBtn, 'Sending', 800, function () {
					toast('Test email sent to ' + (to.value || 'your address') + '. Check your inbox in a minute.', { icon: 'send' });
				});
			});
		}
	};

	var LOG = [
		{ id: 1312, time: 'Today 10:42', amount: '$200.00', event: 'Purchase', status: 'counted', reached: ['meta', 'google', 'x'] },
		{ id: 1311, time: 'Today 10:31', amount: '$54.00', event: 'Purchase', status: 'missed', reached: ['google', 'x'], missed: 'meta' },
		{ id: 1310, time: 'Today 09:58', amount: '$120.00', event: 'Purchase', status: 'counted', reached: ['meta', 'google', 'x'] },
		{ id: 1309, time: 'Today 09:40', amount: '$30.00', event: 'Add to cart', status: 'tracked', reached: ['meta', 'google', 'x'] },
		{ id: 1308, time: 'Today 09:12', amount: '$89.00', event: 'Purchase', status: 'pending', reached: [] },
		{ id: 1307, time: 'Yesterday 18:07', amount: '$64.00', event: 'Failed order', status: 'skipped', reached: [] },
		{ id: 1306, time: 'Yesterday 16:55', amount: '$210.00', event: 'Purchase', status: 'counted', reached: ['meta', 'google', 'x'] },
		{ id: 1305, time: 'Yesterday 15:20', amount: '$45.00', event: 'Start checkout', status: 'tracked', reached: ['meta', 'google', 'x'] }
	];
	var PLATFORM = {
		meta: { name: 'Meta', logo: 'meta.svg', hop: 'Browser pixel fired' },
		google: { name: 'Google', label: 'Google Analytics and Ads', logo: 'google-analytics.svg', hop: 'Browser tag fired' },
		x: { name: 'X', logo: 'x.svg', hop: 'Browser pixel fired' }
	};
	var STATUS = {
		counted: { tone: 'ok', text: 'Counted once', tab: 'tracked' },
		tracked: { tone: 'ok', text: 'Tracked', tab: 'tracked' },
		missed: { tone: 'warn', text: 'Missed on Meta', tab: 'missed' },
		pending: { tone: 'off', text: 'Pending payment', tab: 'pending' },
		skipped: { tone: 'off', text: 'Skipped', tab: 'skipped' }
	};

	function esc(s) {
		return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
	}

	function logo(key, size) {
		var p = PLATFORM[key];
		return '<span class="logo ' + size + '"><img src="assets/logos/' + p.logo + '" alt="' + p.name + '"></span>';
	}

	function reachedCell(row) {
		if (row.status === 'pending') {
			return '<span class="reached">Waiting for payment</span>';
		}
		if (row.status === 'skipped') {
			return '<span class="reached">Nothing sent, by design</span>';
		}
		var names = row.reached.map(function (k) { return PLATFORM[k].name; }).join(', ');
		return '<span class="reached" title="' + names + '"><span class="logo-stack">' + row.reached.map(function (k) { return logo(k, 'xs'); }).join('') + '</span></span>';
	}

	function detailHtml(row) {
		var s = STATUS[row.status];
		var sec = function (n) { return '10:4' + (2 + Math.floor(n / 60)) + ':0' + (n % 60); };
		var h = '<div class="row between"><div><h2 class="detail-title">Order #' + row.id + '</h2>' +
			'<div class="detail-desc">' + esc(row.event) + ', ' + row.amount + ', ' + row.time.toLowerCase() + '</div></div>' +
			'<span class="pill ' + s.tone + '">' + s.text + '</span></div>';
		if (row.status === 'pending') {
			h += '<ul class="timeline"><li class="is-off">Order created, waiting for payment</li><li class="is-off">Sent to your platforms once the order is paid</li></ul>' +
				'<p class="small muted">Nothing to do. Bank transfers and cash on delivery stay here until you mark them paid.</p>';
			return h;
		}
		if (row.status === 'skipped') {
			h += '<ul class="timeline"><li class="is-off">Payment failed</li><li class="is-off">Nothing sent to any platform, so it never counts as a sale</li></ul>';
			return h;
		}
		['meta', 'google', 'x'].forEach(function (k, i) {
			var p = PLATFORM[k];
			h += '<div class="timeline-group"><div class="timeline-name">' + logo(k, 'xs') + (p.label || p.name) + '</div><ul class="timeline">';
			if (row.missed === k) {
				h += '<li class="is-warn">The pixel didn\'t fire for this visitor</li></ul>' +
					'<p class="small muted">Most often an ad blocker or a declined cookie banner. A few a week is normal. If it keeps happening, <a href="doctor.html">ask the Doctor</a>.</p></div>';
				return;
			}
			h += '<li>' + p.hop + ', ' + sec(3 + i) + '</li><li>Reported to the log, ' + sec(4 + i) + '</li>';
			if (row.status === 'counted' && k !== 'google') {
				h += '<li>Counted once, even if the thank-you page reloads</li>';
			}
			h += '</ul></div>';
		});
		h += '<p class="small muted">Value sent: ' + row.amount.replace('$', '') + ' USD, items only. Tax and shipping sent as separate fields to Google.</p>' +
			'<details class="small"><summary>For developers</summary><dl class="dev-list"><dt>Event ID</dt><dd><code>wcct_' + row.id + '_' + row.event.toLowerCase().replace(/ /g, '_') + '</code></dd><dt>Source</dt><dd><code>browser</code></dd></dl></details>';
		return h;
	}

	pages['log'] = function () {
		var tbody = document.querySelector('[data-log-rows]');
		var tabs = document.querySelectorAll('[data-log-tab]');
		var search = document.getElementById('log-search');
		var pane = document.querySelector('[data-log-detail]');
		var dialog = document.getElementById('log-dialog');
		var dialogBody = document.querySelector('[data-log-dialog-body]');
		var foot = document.querySelector('[data-log-count]');
		var table = document.querySelector('[data-log-table]');
		var empty = document.querySelector('[data-log-empty]');
		var noMatch = document.querySelector('[data-log-nomatch]');
		var tab = 'all';
		var selected = 1312;
		var narrow = window.matchMedia('(max-width: 1100px)');

		function rows() {
			if (state.log === 'empty') {
				return [];
			}
			var q = search && state.plan === 'pro' ? search.value.replace(/[^0-9]/g, '') : '';
			return LOG.filter(function (r) {
				var okTab = tab === 'all' || STATUS[r.status].tab === tab;
				var okQ = !q || String(r.id).indexOf(q) !== -1;
				return okTab && okQ;
			});
		}
		function render() {
			var list = rows();
			var isEmpty = state.log === 'empty';
			empty.hidden = !isEmpty;
			table.hidden = isEmpty || !list.length;
			noMatch.hidden = isEmpty || list.length > 0;
			pane.hidden = isEmpty;
			tbody.innerHTML = list.map(function (r) {
				var s = STATUS[r.status];
				return '<tr data-id="' + r.id + '" aria-selected="' + (r.id === selected) + '">' +
					'<td class="muted col-time">' + r.time + '</td>' +
					'<td><b>#' + r.id + '</b><div class="order-sub">' + r.amount + ', ' + esc(r.event) + '</div></td>' +
					'<td>' + reachedCell(r) + '</td>' +
					'<td><span class="pill ' + s.tone + '">' + s.text + '</span></td>' +
					'<td><button type="button" class="btn ghost sm" data-view="' + r.id + '">View<span class="sr-only"> order #' + r.id + '</span></button></td></tr>';
			}).join('');
			foot.textContent = isEmpty ? '' : list.length + ' of 142 events';
			showDetail();
		}
		function showDetail(open) {
			var row = LOG.filter(function (r) { return r.id === selected; })[0];
			pane.innerHTML = detailHtml(row);
			dialogBody.innerHTML = detailHtml(row);
			hydrateIcons(pane);
			applyState();
			if (open && narrow.matches) {
				dialog.showModal();
			}
		}
		tbody.addEventListener('click', function (e) {
			var tr = e.target.closest('tr[data-id]');
			if (!tr) {
				return;
			}
			selected = Number(tr.getAttribute('data-id'));
			tbody.querySelectorAll('tr').forEach(function (r) { r.setAttribute('aria-selected', String(r === tr)); });
			showDetail(true);
		});
		tabs.forEach(function (t) {
			t.addEventListener('click', function () {
				tab = t.getAttribute('data-log-tab');
				tabs.forEach(function (o) { o.setAttribute('aria-selected', String(o === t)); });
				render();
			});
		});
		if (search) {
			search.addEventListener('input', render);
		}
		var keep = document.querySelector('[data-log-keep]');
		if (keep) {
			keep.addEventListener('change', function () {
				toast('Saved. The Activity log now keeps ' + keep.value + ' days of history.');
			});
		}
		document.addEventListener('wcct:state', render);
		render();
	};

	pages['doctor'] = function () {
		var btn = document.querySelector('[data-check-again]');
		var running = document.querySelector('[data-doctor-running]');
		var results = document.querySelector('[data-doctor-results]');
		var last = document.querySelector('[data-last-check]');
		var summaryTitle = document.querySelector('[data-findings-title]');
		var findingsSection = document.querySelector('[data-findings]');
		var cleanCard = document.querySelector('[data-clean-after-dismiss]');

		function countOpen() {
			// "Not sure" items are listed but not counted as worth a look.
			var sure = document.querySelectorAll('[data-finding]:not(.is-unsure):not([hidden])').length;
			var any = document.querySelectorAll('[data-finding]:not([hidden])').length;
			var working = document.querySelectorAll('.check-row:not([hidden]):not([data-info])').length;
			summaryTitle.textContent = sure
				? working + ' things are working. ' + (sure === 1 ? '1 is' : sure + ' are') + ' worth a look.'
				: working + ' things are working. One thing we can\'t see inside.';
			document.querySelectorAll('[data-check-total]').forEach(function (el) {
				el.textContent = working + document.querySelectorAll('[data-finding]:not([hidden])').length;
			});
			findingsSection.hidden = any === 0;
			cleanCard.hidden = any !== 0;
		}
		document.querySelectorAll('[data-finding-dismiss]').forEach(function (b) {
			b.addEventListener('click', function () {
				var f = b.closest('[data-finding]');
				f.hidden = true;
				countOpen();
				toast('Dismissed. It won\'t show again unless something changes.', {
					undo: function () {
						f.hidden = false;
						countOpen();
					}
				});
			});
		});
		btn.addEventListener('click', function () {
			running.hidden = false;
			results.hidden = true;
			busy(btn, 'Checking', 2000, function () {
				running.hidden = true;
				results.hidden = false;
				document.querySelectorAll('[data-finding]').forEach(function (f) { f.hidden = false; });
				applyState(); // re-hide findings that don't apply to the current state
				countOpen();
				last.textContent = 'Last check: just now';
				toast('Check finished. ' + document.querySelector('[data-check-total]').textContent + ' things checked.');
			});
		});
		document.addEventListener('wcct:state', countOpen);
		countOpen();
	};

	/* ------------------------------------------------------------- boot */

	renderChrome();
	renderStateBar();
	applyState();
	hydrateIcons(document);
	bindGlobal();
	document.querySelectorAll('[data-events]').forEach(eventsTable);
	document.querySelectorAll('[data-server-section]').forEach(serverSection);
	document.querySelectorAll('[data-server-settings]').forEach(serverSettings);
	if (pages[page]) {
		pages[page]();
	}
	document.addEventListener('wcct:state', function () { hydrateIcons(document); });
	window.WCCT_PROTO = { state: state, setState: setState, toast: toast };
}());
