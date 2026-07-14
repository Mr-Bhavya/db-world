import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker';

// The legacy build + a Vite-bundled worker so PDF preview renders to <canvas> on desktop, mobile web
// and the Android WebView alike (none can be relied on for native <iframe>/<embed> PDF viewing).
// Using ?worker (not ?url) makes Vite emit the worker as a .js chunk and instantiate it directly —
// avoiding the Capacitor WebView serving a bare .mjs with a non-JS MIME type, which silently kills
// the worker and leaves getDocument hanging (blank preview).
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

/**
 * Renders every page of a PDF to a stack of <canvas> elements.
 *
 * @param {Blob|ArrayBuffer|Uint8Array|string} src - PDF bytes (Blob/ArrayBuffer/Uint8Array) or a URL.
 * @param {object} [T] - theme tokens (for spinner / error colour).
 */
export default function PdfViewer({ src, T }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    if (!src) return undefined;
    let cancelled = false;
    let pdfDoc = null;
    const tasks = [];
    const host = pagesRef.current;

    (async () => {
      setStatus('loading');
      if (host) host.replaceChildren();
      try {
        let params;
        if (typeof src === 'string') params = { url: src };
        else if (src instanceof Blob) params = { data: new Uint8Array(await src.arrayBuffer()) };
        else if (src instanceof ArrayBuffer) params = { data: new Uint8Array(src) };
        else params = { data: src };

        pdfDoc = await pdfjsLib.getDocument(params).promise;
        if (cancelled) { pdfDoc.destroy(); return; }

        const cssWidth = Math.max(1, scrollRef.current?.clientWidth || 800);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= pdfDoc.numPages; n += 1) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(n);
          const unscaled = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / unscaled.width) * dpr });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 8px';
          if (!host || cancelled) break;
          host.appendChild(canvas);

          const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          tasks.push(task);
          await task.promise;
        }
        if (!cancelled) setStatus('ready');
      } catch (_e) {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      tasks.forEach((t) => { try { t.cancel(); } catch { /* already settled */ } });
      if (pdfDoc) { try { pdfDoc.destroy(); } catch { /* noop */ } }
    };
  }, [src]);

  return (
    <Box ref={scrollRef} sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto' }}>
      {status === 'loading' && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: T?.teal }} />
        </Box>
      )}
      {status === 'error' && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 2 }}>
          <Typography sx={{ color: T?.textMuted, fontSize: 13 }}>Couldn’t render this PDF.</Typography>
        </Box>
      )}
      <Box ref={pagesRef} sx={{ width: '100%' }} />
    </Box>
  );
}
