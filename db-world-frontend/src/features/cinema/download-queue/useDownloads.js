import { useState, useEffect, useRef, useCallback } from 'react';
import DbWorldDownload from '@platform/android/DbWorldDownload';

export function normalizeDownload(item = {}) {
  return {
    ...item,
    downloadId:       item.downloadId,
    title:            item.title || item.fileName || 'Download',
    fileName:         item.fileName || item.title || 'download',
    status:           item.status || 'running',
    progress:         Number.isFinite(item.progress) ? item.progress : 0,
    bytesDownloaded:  item.bytesDownloaded || 0,
    bytesTotal:       item.bytesTotal || 0,
    localUri:         item.localUri   || item.playableUri || item.path || '',
    playableUri:      item.playableUri || item.localUri   || item.path || '',
    mimeType:         item.mimeType   || '',
    thumbnailUrl:     item.thumbnailUrl || '',
    canPlay:          Boolean(item.canPlay),
    speedBytesPerSec: item.speedBytesPerSec || 0,
    etaSeconds:       item.etaSeconds ?? -1,
  };
}

function upsert(items, incoming) {
  const next  = normalizeDownload(incoming);
  const index = items.findIndex(d => d.downloadId === next.downloadId);
  if (index === -1) return [next, ...items];
  const updated = [...items];
  updated[index] = normalizeDownload({ ...updated[index], ...next });
  return updated;
}

export function useDownloads() {
  const [downloads, setDownloads] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [wifiOnly,  setWifiOnly]  = useState(false);
  const [concurrency,    setConcurrencyState] = useState(1);
  const [maxConcurrency, setMaxConcurrency]   = useState(3);

  const refresh = useCallback(async () => {
    try {
      const res = await DbWorldDownload.listDownloads();
      setDownloads(prev => {
        const prevById = new Map(prev.map(d => [d.downloadId, d]));
        return (res.downloads ?? []).map(item => {
          const next = normalizeDownload(item);
          // A full re-list drops transient client flags; carry "resuming" forward
          // until real progress arrives or the download settles.
          const old = prevById.get(next.downloadId);
          if (old?._resuming && (next.status === 'pending' || next.status === 'running')
              && !(next.speedBytesPerSec > 0)) {
            next._resuming = true;
          }
          return next;
        });
      });
    } catch (e) {
      console.error('[useDownloads] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + load settings
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const s = await DbWorldDownload.getSettings();
        setWifiOnly(Boolean(s?.wifiOnly));
        if (Number.isFinite(s?.concurrentLimit))    setConcurrencyState(s.concurrentLimit);
        if (Number.isFinite(s?.maxConcurrentLimit)) setMaxConcurrency(s.maxConcurrentLimit);
      } catch { /* web stub / older native — ignore */ }
    })();
  }, []);

  // Real-time events
  useEffect(() => {
    const listeners = [];
    (async () => {
      listeners.push(
        // First byte after a resume → drop the transient "resuming" flag.
        await DbWorldDownload.addListener('downloadProgress', d =>
          setDownloads(prev => upsert(prev, {
            ...d,
            status: d.status || 'running',
            ...(d.speedBytesPerSec > 0 ? { _resuming: false } : {}),
          }))),
        await DbWorldDownload.addListener('downloadStateChanged', d => {
          // Keep "resuming" through the pending→running churn; only a settled state
          // (paused/cancelled/failed/success) ends it. Progress (below) clears it too.
          const settled = ['paused', 'cancelled', 'failed', 'success'].includes(d.status);
          setDownloads(prev => upsert(prev, settled ? { ...d, _resuming: false } : d));
        }),
        await DbWorldDownload.addListener('downloadComplete', d =>
          setDownloads(prev => upsert(prev, { ...d, status: 'success', progress: 100 }))),
        await DbWorldDownload.addListener('downloadError', d =>
          setDownloads(prev => upsert(prev, { ...d, status: 'failed' }))),
        await DbWorldDownload.addListener('downloadAdded', d =>
          setDownloads(prev => upsert(prev, { ...d, status: d.status || 'pending' }))),
        await DbWorldDownload.addListener('downloadRemoved', d =>
          setDownloads(prev => prev.filter(x => x.downloadId !== d.downloadId))),
      );
    })();
    return () => listeners.forEach(l => l?.remove());
  }, []);

  // Polling fallback: events fire only when this component is mounted.
  // If a download was started from another page, events were missed.
  // Poll listDownloads() every 2 s while any download is active/queued.
  const downloadsRef = useRef(downloads);
  useEffect(() => { downloadsRef.current = downloads; }, [downloads]);

  useEffect(() => {
    const id = setInterval(() => {
      const hasActive = downloadsRef.current.some(
        d => d.status === 'running' || d.status === 'pending' || d.status === 'paused'
      );
      if (hasActive) refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  // Actions
  const pause = useCallback(async (id) => {
    await DbWorldDownload.pauseDownload({ downloadId: id });
    setDownloads(prev => prev.map(d => d.downloadId === id ? { ...d, status: 'paused' } : d));
  }, []);

  // Resume: optimistically show a "resuming" state so the UI reacts instantly
  // instead of dwelling on "pending" while Fetch re-queues and negotiates the range.
  const resume = useCallback(async (id) => {
    setDownloads(prev => prev.map(d =>
      d.downloadId === id ? { ...d, status: 'running', _resuming: true, speedBytesPerSec: 0 } : d));
    await DbWorldDownload.resumeDownload({ downloadId: id });
  }, []);

  // Cancel STOPS the transfer but keeps a 'cancelled' record (redownload-able).
  const cancel = useCallback(async (id) => {
    await DbWorldDownload.cancelDownload({ downloadId: id });
    setDownloads(prev => prev.map(d =>
      d.downloadId === id ? { ...d, status: 'cancelled', speedBytesPerSec: 0 } : d));
  }, []);

  const remove = useCallback(async (id) => {
    await DbWorldDownload.deleteDownload({ downloadId: id });
    setDownloads(prev => prev.filter(d => d.downloadId !== id));
  }, []);

  const retry = useCallback(async (id) => {
    await DbWorldDownload.retryDownload({ downloadId: id });
    setDownloads(prev => prev.map(d => d.downloadId === id ? { ...d, status: 'pending' } : d));
  }, []);

  const pauseAll = useCallback(async () => {
    const ids = downloadsRef.current
      .filter(d => d.status === 'running' || d.status === 'pending')
      .map(d => d.downloadId);
    setDownloads(prev => prev.map(d =>
      (d.status === 'running' || d.status === 'pending')
        ? { ...d, status: 'paused', _resuming: false, speedBytesPerSec: 0 } : d));
    for (const id of ids) {
      try { await DbWorldDownload.pauseDownload({ downloadId: id }); } catch { /* keep going */ }
    }
  }, []);

  const resumeAll = useCallback(async () => {
    const ids = downloadsRef.current.filter(d => d.status === 'paused').map(d => d.downloadId);
    setDownloads(prev => prev.map(d =>
      d.status === 'paused' ? { ...d, status: 'running', _resuming: true, speedBytesPerSec: 0 } : d));
    for (const id of ids) {
      try { await DbWorldDownload.resumeDownload({ downloadId: id }); } catch { /* keep going */ }
    }
  }, []);

  const toggleWifiOnly = useCallback(async (next) => {
    setWifiOnly(next);
    try {
      await DbWorldDownload.setNetworkPolicy({ wifiOnly: next });
    } catch (e) {
      console.error('[useDownloads] setNetworkPolicy failed', e);
      setWifiOnly(prev => !prev); // revert on failure
    }
  }, []);

  const setConcurrency = useCallback(async (next) => {
    const prev = concurrency;
    setConcurrencyState(next); // optimistic
    try {
      const res = await DbWorldDownload.setConcurrentLimit({ limit: next });
      if (Number.isFinite(res?.concurrentLimit)) setConcurrencyState(res.concurrentLimit);
    } catch (e) {
      console.error('[useDownloads] setConcurrentLimit failed', e);
      setConcurrencyState(prev); // revert on failure
    }
  }, [concurrency]);

  return {
    downloads, loading, refresh,
    wifiOnly, toggleWifiOnly,
    concurrency, maxConcurrency, setConcurrency,
    actions: { pause, resume, cancel, remove, retry, pauseAll, resumeAll },
  };
}
