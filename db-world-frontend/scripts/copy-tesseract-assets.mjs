/**
 * Copies Tesseract's worker, wasm cores and English model out of node_modules into `public/`, so
 * OCR is served from this origin rather than fetched from a public CDN at runtime.
 *
 * WHY SELF-HOST. tesseract.js defaults to pulling its core and language data from jsDelivr the
 * first time you scan. Nothing sensitive leaves the device either way — the image is never
 * uploaded — but a wallet holding government IDs should not be making third-party requests at the
 * moment somebody scans one, and a CDN outage should not be able to break a feature in an app that
 * otherwise works offline.
 *
 * WHY NOT COMMIT THE FILES. They are ~9 MB of binaries derived entirely from two npm dependencies,
 * so they are generated, not authored — `public/tesseract/` is gitignored and this script runs on
 * `postinstall`, which covers a fresh clone, CI's `npm ci`, dev and build alike.
 *
 * Only the LSTM cores are copied. Tesseract ships a legacy engine as well, roughly doubling the
 * payload, and nothing here uses it.
 */
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'tesseract');
const nm = join(root, 'node_modules');

/** The fast integer model (~2.9 MB) rather than `4.0.0` (~11 MB). On a phone that difference is the
 *  whole question of whether scanning is usable on mobile data; the accuracy gap on the large,
 *  high-contrast type printed on an ID card is not what limits this feature. */
const LANG_SRC = join(nm, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz');

const files = [
  [join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js')],
  [LANG_SRC, join(out, 'lang', 'eng.traineddata.gz')],
];

async function main() {
  if (!existsSync(nm)) {
    console.log('[tesseract-assets] node_modules missing — skipping');
    return;
  }
  if (!existsSync(LANG_SRC)) {
    // A partial install shouldn't fail the whole postinstall; OCR simply won't be offered.
    console.log('[tesseract-assets] language data not installed — skipping');
    return;
  }

  await mkdir(join(out, 'lang'), { recursive: true });
  await mkdir(join(out, 'core'), { recursive: true });

  for (const [src, dest] of files) {
    await copyFile(src, dest);
  }

  // Copy every LSTM core variant: tesseract.js picks between the plain, SIMD and relaxed-SIMD
  // builds at runtime based on what the browser reports, so all of them have to be present.
  const coreDir = join(nm, 'tesseract.js-core');
  const coreFiles = (await readdir(coreDir)).filter((f) => f.includes('lstm') && !f.endsWith('.map'));
  for (const f of coreFiles) {
    await copyFile(join(coreDir, f), join(out, 'core', f));
  }

  console.log(`[tesseract-assets] copied ${files.length + coreFiles.length} files to public/tesseract`);
}

main().catch((e) => {
  // Never fail an install over this. The feature degrades to "Scan unavailable", which the dialog
  // already handles, and a broken postinstall would block everything else.
  console.warn('[tesseract-assets] skipped:', e.message);
});
