#!/usr/bin/env node
/**
 * The design-system library, fetched when it is used.
 *
 * 2,144 specs are 26MB of markdown. Shipped in the npm package, every install
 * carried all of them and `init` copied every one into a project that would use
 * one or two. The package now carries the index - design-systems/library.json,
 * with a name, category, description and sha256 per spec - and a spec arrives
 * the first time something asks for it.
 *
 * Where a spec comes from, in order:
 *   1. the destination already has it - nothing to fetch
 *   2. this kit carries it (a git clone, a plugin install) - copied, no network
 *   3. the repository at the tag the index was generated for, then a mirror
 *
 * Every byte from 2 and 3 must hash to the index's sha256 before it is written.
 * A source that fails or serves something else falls through to the next; when
 * none serves the right bytes nothing is written and the exit code is 1. The
 * index shipped inside the package, so a moved tag or a compromised mirror can
 * withhold a spec but cannot change one.
 *
 *   node scripts/library.mjs get <name>... [--into <dir>] [--force]
 *   node scripts/library.mjs pull [--into <dir>] [--force]
 *
 * --into defaults to the kit root, which in an initialised project is the
 * project; the spec lands at <dir>/design-systems/library/<name>/DESIGN.md,
 * where the skills read it. A spec already there that differs from the index is
 * someone's edit and is left alone unless --force.
 *
 * UX_UI_LIBRARY_BASE replaces the sources with a comma-separated list of base
 * URLs laid out like the repository (<base>/<ref>/design-systems/library/...),
 * for a private mirror or a test server. The sha256 check still applies.
 *
 * Node built-ins only, like the rest of the kit.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const TIMEOUT_MS = 20000;
const PARALLEL = 8;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const specPath = (root, slug) => join(root, 'design-systems', 'library', slug, 'DESIGN.md');

export function loadIndex(kit = KIT) {
  return JSON.parse(readFileSync(join(kit, 'design-systems', 'library.json'), 'utf8'));
}

/** Every URL a spec may be fetched from, in the order they are tried. */
export function sources(index, slug) {
  const file = `design-systems/library/${slug}/DESIGN.md`;
  const env = process.env.UX_UI_LIBRARY_BASE;
  if (env) {
    return env.split(',').map(s => s.trim()).filter(Boolean)
      .map(base => `${base.replace(/\/+$/, '')}/${index.ref}/${file}`);
  }
  return [
    `https://raw.githubusercontent.com/${index.repo}/${index.ref}/${file}`,
    `https://cdn.jsdelivr.net/gh/${index.repo}@${index.ref}/${file}`,
  ];
}

/** Read a response body, but never more than `limit` bytes of it. */
async function body(res, limit) {
  const chunks = [];
  let n = 0;
  for await (const chunk of res.body) {
    n += chunk.length;
    if (n > limit) throw new Error(`more than the ${limit - 1} bytes the index records`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** The spec's bytes from the first source that serves exactly what the index records. */
async function download(index, slug) {
  const want = index.systems[slug];
  const tried = [];
  for (const url of sources(index, slug)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) { tried.push(`${url}: HTTP ${res.status}`); continue; }
      const buf = await body(res, want.bytes + 1);
      const got = sha256(buf);
      if (got !== want.sha256) { tried.push(`${url}: sha256 ${got} is not the index's ${want.sha256}`); continue; }
      return { buf, url };
    } catch (e) {
      tried.push(`${url}: ${e.cause?.code || e.message}`);
    }
  }
  const err = new Error(`no source served the spec whose sha256 the index records\n    ${tried.join('\n    ')}`);
  err.refused = true;
  throw err;
}

/** Write through a temporary file, so a failed write never leaves half a spec. */
function put(file, buf) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, file);
}

/**
 * Make one spec present under `into` and return it.
 *
 * status: present (already there and intact), kept (there, edited, left alone),
 * copied (from this kit), fetched (from `from`). `repair` treats an edited copy
 * as absent, for a cache nobody edits on purpose.
 */
export async function ensure(slug, { kit = KIT, into = kit, force = false, repair = false, index = loadIndex(kit) } = {}) {
  if (!SLUG.test(slug) || !Object.hasOwn(index.systems, slug)) {
    const err = new Error(`"${slug}" is not in the library index`);
    err.unknown = true;
    throw err;
  }
  const want = index.systems[slug];
  const dest = specPath(resolve(into), slug);

  if (existsSync(dest) && !force) {
    const buf = readFileSync(dest);
    if (sha256(buf) === want.sha256) return { status: 'present', path: dest, buf };
    if (!repair) return { status: 'kept', path: dest, buf };
  }

  const local = specPath(resolve(kit), slug);
  if (local !== dest && existsSync(local)) {
    const buf = readFileSync(local);
    if (sha256(buf) === want.sha256) {
      put(dest, buf);
      return { status: 'copied', path: dest, buf };
    }
  }

  const { buf, url } = await download(index, slug);
  put(dest, buf);
  return { status: 'fetched', path: dest, buf, from: url };
}

function describe(slug, r) {
  if (r.status === 'present') return `  present  ${slug}  ${r.path}`;
  if (r.status === 'kept') return `  kept     ${slug}  ${r.path}\n           differs from the index, so it was left alone (--force replaces it)`;
  if (r.status === 'copied') return `  copied   ${slug}  ${r.path}  (sha256 verified, from this kit)`;
  return `  fetched  ${slug}  ${r.path}  (sha256 verified, from ${r.from})`;
}

async function main(argv) {
  const opts = { force: false, into: KIT };
  const names = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force' || a === '-f') opts.force = true;
    else if (a === '--into') opts.into = argv[++i];
    else if (a.startsWith('--into=')) opts.into = a.slice(7);
    else if (a.startsWith('-')) return usage(`unknown flag: ${a}`);
    else names.push(a);
  }
  const cmd = names.shift();
  if (!opts.into) return usage('--into needs a directory');

  let index;
  try { index = loadIndex(); }
  catch (e) { console.error(`library: cannot read design-systems/library.json (${e.message})`); return 2; }

  let slugs;
  if (cmd === 'get') {
    if (!names.length) return usage('get needs at least one name');
    slugs = names;
  } else if (cmd === 'pull') {
    if (names.length) return usage('pull takes no names; it fetches every spec');
    slugs = Object.keys(index.systems);
  } else {
    return usage(cmd ? `unknown command: ${cmd}` : '');
  }

  const failed = [];
  const counts = {};
  let next = 0;
  const quiet = cmd === 'pull';
  async function worker() {
    while (next < slugs.length) {
      const slug = slugs[next++];
      try {
        const r = await ensure(slug, { ...opts, index });
        counts[r.status] = (counts[r.status] || 0) + 1;
        if (!quiet || r.status === 'kept') console.log(describe(slug, r));
      } catch (e) {
        failed.push(slug);
        console.error(`  refused  ${slug}: ${e.message}`);
        if (e.unknown) console.error('           python3 scripts/design_systems.py search <term> lists the names it holds');
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, slugs.length) }, worker));

  if (quiet || failed.length) {
    const done = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing';
    console.log(`\n${done}${failed.length ? `, ${failed.length} refused` : ''} - ${slugs.length} asked for, index ${index.ref}`);
  }
  return failed.length ? 1 : 0;
}

function usage(problem) {
  if (problem) console.error(`library: ${problem}\n`);
  console.error([
    'usage: node scripts/library.mjs get <name>... [--into <dir>] [--force]',
    '       node scripts/library.mjs pull [--into <dir>] [--force]',
    '',
    'Fetches a design-system spec into <dir>/design-systems/library/<name>/DESIGN.md',
    '(default <dir>: this kit) and refuses any file whose sha256 is not in the index.',
  ].join('\n'));
  return 2;
}

// Compared as real paths: on macOS /var is a link to /private/var, and a plain
// comparison there skipped main() and exited 0 having done nothing.
const invoked = process.argv[1] && realpathSync(resolve(process.argv[1]));
if (invoked === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await main(process.argv.slice(2));
}
