// Checks that every local href / src in the prototype (static HTML and the
// links app.js renders) resolves to a file, and that #fragments exist.
// Usage (from prototype/tools): node check-links.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = readdirSync(root).filter((f) => f.endsWith('.html'));
const sources = [...htmlFiles, 'assets/app.js'];
const ids = (file) => new Set([...readFileSync(path.join(root, file), 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

let checked = 0;
let placeholders = 0;
const broken = [];
const pairs = new Set();

for (const src of sources) {
	const text = readFileSync(path.join(root, src), 'utf8');
	for (const m of text.matchAll(/(?:href|src)="([^"]*)"/g)) {
		const url = m[1];
		if (url.includes("' +")) continue; // built at runtime from a variable
		if (url === '#') { placeholders++; continue; }
		if (/^(https?:|mailto:)/.test(url)) { broken.push(`${src}: external URL ${url} (prototype must not load the network)`); continue; }
		checked++;
		const [file, frag] = url.split('#');
		const target = file || (src.endsWith('.html') ? src : null);
		if (file && !existsSync(path.join(root, file))) { broken.push(`${src}: ${url} -> missing file`); continue; }
		if (frag && target && target.endsWith('.html') && !ids(target).has(frag)) broken.push(`${src}: ${url} -> no id="${frag}"`);
		if (file.endsWith('.html')) pairs.add(`${src} -> ${file}`);
	}
}
// Runtime-built targets in app.js (pick-platforms continue button, screen jump).
for (const m of readFileSync(path.join(root, 'assets/app.js'), 'utf8').matchAll(/'([a-z-]+\.html)(#[a-z-]+)?'/g)) {
	checked++;
	if (!existsSync(path.join(root, m[1]))) broken.push(`app.js: ${m[1]} -> missing file`);
	if (m[2] && !ids(m[1]).has(m[2].slice(1))) broken.push(`app.js: ${m[1]}${m[2]} -> no id`);
}
// Every page must be reachable from at least one other page.
for (const f of htmlFiles) {
	if (f === 'index.html') continue;
	if (![...pairs].some((p) => p.endsWith(`-> ${f}`) && !p.startsWith(`${f} `))) broken.push(`${f}: no page links to it`);
}

console.log(`Checked ${checked} local links and asset references across ${sources.length} files; ${placeholders} are "#" placeholders for external pages (docs, Meta Events Manager, etc.).`);
if (broken.length) {
	console.log('Broken:\n' + broken.join('\n'));
	process.exitCode = 1;
} else {
	console.log('All resolve from file://. Every page is linked from another page.');
}
