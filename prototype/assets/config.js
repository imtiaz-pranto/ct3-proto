/*
 * Conversion Tracking 3.0 prototype: platform config, the one place that
 * says what each platform can do. app.js renders the events table and the
 * 3.1 server sending section from it.
 *
 * serverSending: per-platform capability flag. A platform shows any server
 *   sending UI (Sent from column, Server sending section, delivery settings)
 *   only when this is true, and only in the 3.1 state.
 * events: rec = in the Recommended preset and shown by default; pro = Pro
 *   only (Free shows a PRO badge and a lock); server = which plan sends the
 *   event from the server too in 3.1 ('free' or 'pro', split per
 *   decision C1 in CT-3.0-PLAN.md, confirmed by Imtiaz 2026-10-28); seen = last seen
 *   when on, shown for Purchase only (decision D2, 2026-11-03: 3.0 hears
 *   back about purchases, not other events); always = sent by the base tag, so
 *   no switch (D11); needsId = id of the input that holds this event's own
 *   event ID, and the event stays off while it's empty (B1, X).
 */
window.WCCT_CONFIG = {
	platforms: {
		meta: {
			name: 'Meta',
			serverSending: true,
			// Developer term, shown in Advanced settings only when server sending shows.
			serverTerm: '"Server sending" = Conversions API, deduplicated against the pixel by event ID.',
			events: [
				{ key: 'view', name: 'View product', desc: 'Every product page.', rec: true, server: 'free', seen: '2 min ago' },
				{ key: 'cart', name: 'Add to cart', desc: 'Classic buttons, quick adds on the shop page and block buttons.', rec: true, server: 'free', seen: '6 min ago' },
				{ key: 'checkout', name: 'Start checkout', desc: 'Classic and block checkout.', rec: true, server: 'free', seen: '14 min ago' },
				{ key: 'purchase', name: 'Purchase', desc: 'Once per order. Failed and cancelled orders are skipped.', rec: true, server: 'free', seen: '2 min ago' },
				{ key: 'search', name: 'Search', desc: 'Store search results.', server: 'pro', seen: '1 h ago' },
				{ key: 'signup', name: 'Sign up', desc: 'A new WordPress or WooCommerce account.', server: 'pro', seen: 'yesterday' },
				{ key: 'category', name: 'View category', desc: 'Product category pages.', pro: true, server: 'pro', seen: '9 min ago' },
				{ key: 'wishlist', name: 'Add to wishlist', desc: 'When a shopper saves a product to a wishlist.', pro: true, server: 'pro', seen: '3 h ago' }
			]
		},
		google: {
			name: 'Google',
			serverSending: false,
			events: [
				{ key: 'view', name: 'View product', desc: 'Analytics view_item on every product page.', rec: true, seen: '2 min ago' },
				{ key: 'cart', name: 'Add to cart', desc: 'Analytics add_to_cart, classic and block buttons.', rec: true, seen: '6 min ago' },
				{ key: 'checkout', name: 'Start checkout', desc: 'Analytics begin_checkout, classic and block checkout.', rec: true, seen: '14 min ago' },
				{ key: 'purchase', name: 'Purchase', desc: 'Analytics purchase and the Ads conversion, once per order.', rec: true, seen: '2 min ago' },
				{ key: 'search', name: 'Search', desc: 'Analytics search on store search results.', seen: '1 h ago' },
				{ key: 'registration', name: 'Registration', desc: 'Counted as an Ads conversion when a shopper creates an account.', pro: true, seen: 'yesterday' }
			]
		},
		x: {
			name: 'X',
			serverSending: false,
			events: [
				{ key: 'page', name: 'Page view', desc: 'The base tag on every page.', rec: true, always: true, seen: '1 min ago' },
				{ key: 'cart', name: 'Add to cart', desc: 'Classic and block buttons.', rec: true, needsId: 'x-cart-id', seen: '41 min ago' },
				{ key: 'checkout', name: 'Start checkout', desc: 'Classic and block checkout.', rec: true, needsId: 'x-checkout-id', seen: '1 h ago' },
				{ key: 'purchase', name: 'Purchase', desc: 'Uses the Purchase event ID above. Once per order.', rec: true, seen: '2 min ago' },
				{ key: 'registration', name: 'Registration', desc: 'A new account on your store.', pro: true, needsId: 'x-registration-id', seen: 'yesterday' }
			]
		},
		microsoft: {
			// The whole platform is Pro; Free sees the locked preview instead.
			name: 'Microsoft',
			serverSending: false,
			events: [
				{ key: 'page', name: 'Page view', desc: 'The UET tag on every page.', rec: true, always: true, seen: '1 min ago' },
				{ key: 'cart', name: 'Add to cart', desc: 'Classic and block buttons.', rec: true, seen: '22 min ago' },
				{ key: 'checkout', name: 'Start checkout', desc: 'Classic and block checkout.', rec: true, seen: '1 h ago' },
				{ key: 'purchase', name: 'Purchase', desc: 'With order value. Once per order.', rec: true, seen: '2 min ago' }
			]
		}
	}
};
