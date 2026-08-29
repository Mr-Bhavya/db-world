/**
 * On-device OCR for document scanning.
 *
 * Everything runs in the browser: the image is never uploaded, never decrypted server-side, and
 * never sent to a third-party vision API. That is not incidental — these are Indian government IDs,
 * and shipping an Aadhaar image to a cloud OCR service would be a meaningful thing to do quietly.
 * The engine, the wasm core and the language model are all served from this origin (see
 * `scripts/copy-tesseract-assets.mjs`), so scanning makes no outbound request at all.
 *
 * `tesseract.js` and its ~6 MB of assets are behind a dynamic import and loaded only when somebody
 * actually taps Scan. They are not in the main bundle and cost nothing to anyone who never uses the
 * feature.
 */

/** One worker, reused. Spinning one up costs the wasm compile and the model load; scanning a second
 * document in the same session should not pay that twice. */
let workerPromise = null;

/** Self-hosted asset paths — see the copy script. Absolute so they resolve identically on the web
 * and inside the Android WebView, where the app is not served from the filesystem root. */
const ASSETS = {
  workerPath: '/tesseract/worker.min.js',
  corePath: '/tesseract/core',
  langPath: '/tesseract/lang',
  gzip: true,
};

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        ...ASSETS,
        logger: (m) => {
          // `progress` is 0-1 within whatever phase the engine is in; the caller only wants a
          // single bar, so the loading phases and the recognise phase are reported the same way.
          if (typeof m?.progress === 'number') onProgress?.(Math.round(m.progress * 100), m.status);
        },
      });
    })().catch((e) => {
      // Don't cache a failed boot — a flaky first load (assets still deploying, storage full)
      // should be retryable rather than poisoning the session.
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** True when scanning can be offered at all — an image, or a PDF, which is rasterised first. */
export const isScannable = (file) =>
  !!file && (String(file.type).startsWith('image/') || file.type === 'application/pdf');

/**
 * Renders the FIRST page of a PDF to a canvas so OCR has pixels to read.
 *
 * Page one only: a scanned ID is a single page, and a multi-page PDF is a prospectus or an
 * agreement, neither of which has a document number worth guessing at.
 *
 * `scale: 2` is the reason this works at all. At the natural 1x a 12pt number renders around 16px
 * tall, which Tesseract reads badly; doubling it costs a moment and a few megabytes of canvas and
 * takes accuracy from unusable to comparable with a photograph.
 *
 * pdf.js is loaded through the same `?worker` entry `PdfViewer` uses — bundling its worker rather
 * than pointing `workerSrc` at a URL is what stops Vite serving a stale or missing worker and
 * leaving `getDocument` hanging.
 */
/**
 * Rejects if `promise` hasn't settled in `ms`.
 *
 * pdf.js drives `page.render` from `requestAnimationFrame`, which the browser stops delivering
 * while a tab is backgrounded — so a scan started and then left alone can sit unresolved forever
 * rather than failing. A bounded wait turns that into a visible "try again" instead of a spinner
 * nobody can escape.
 */
const withTimeout = (promise, ms, what) => Promise.race([
  promise,
  new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error(`${what} timed out — keep this tab in the foreground and try again.`)), ms);
  }),
]);

/** Rendering a single page is fast; anything past this is a stall, not slow work. */
const PDF_RENDER_TIMEOUT_MS = 30_000;
/** Recognition itself is genuinely slow on a large photo, so this is generous. */
const RECOGNISE_TIMEOUT_MS = 120_000;

async function pdfFirstPageToCanvas(file) {
  const [pdfjsLib, { default: PdfWorker }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'),
  ]);
  if (!pdfjsLib.GlobalWorkerOptions.workerPort) {
    pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
  }
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    // A transparent PDF background reads as black once flattened, which inverts the page and
    // destroys contrast for OCR. Paint white first.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await withTimeout(
      page.render({ canvasContext: context, viewport }).promise,
      PDF_RENDER_TIMEOUT_MS,
      'Rendering the PDF',
    );
    return canvas;
  } finally {
    doc.destroy();
  }
}

/**
 * Reads the text out of an image or a PDF.
 *
 * Returns the raw recognised text — deciding whether any of it is a document number is
 * `documentNumber.js`'s job, deliberately kept separate so that logic stays pure and testable
 * without an OCR engine anywhere near it.
 */
export async function recogniseImageText(file, onProgress) {
  const worker = await getWorker(onProgress);
  const source = file.type === 'application/pdf'
    ? await pdfFirstPageToCanvas(file)
    : file;
  const { data } = await withTimeout(worker.recognize(source), RECOGNISE_TIMEOUT_MS, 'Reading the document');
  return data?.text ?? '';
}

/** Releases the worker and its wasm heap. Worth doing when the dialog closes: the engine holds
 * several megabytes, which is a lot to keep alive on a phone for a feature used once. */
export async function releaseOcr() {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Nothing useful to do — the worker either never started or is already gone.
  }
}
