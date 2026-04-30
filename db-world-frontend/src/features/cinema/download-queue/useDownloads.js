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
    canPlay:          Boolean(item.canPlay),
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

  const refresh = useCallback(async () => {
    try {
      const res = await DbWorldDownload.listDownloads();
      setDownloads((res.downloads ?? []).map(normalizeDownload));
    } catch (e) {
      console.error('[useDownloads] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { refresh(); }, []);

  // Real-time events
  useEffect(() => {
    const listeners = [];
    (async () => {
      listeners.push(
        await DbWorldDownload.addListener('downloadProgress', d =>
          setDownloads(prev => upsert(prev, { ...d, status: d.status || 'running' }))),
        await DbWorldDownload.addListener('downloadStateChanged', d =>
          setDownloads(prev => upsert(prev, d))),
        await DbWorldDownload.addListener('downloadComplete', d =>
          setDownloads(prev => upsert(prev, { ...d, status: 'success', progress: 100 }))),
        await DbWorldDownload.addListener('downloadError', d =>
          setDownloads(prev => upsert(prev, { ...d, status: 'failed' }))),
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

  const resume = useCallback(async (id) => {
    await DbWorldDownload.resumeDownload({ downloadId: id });
    setDownloads(prev => prev.map(d => d.downloadId === id ? { ...d, status: 'running' } : d));
  }, []);

  const cancel = useCallback(async (id) => {
    await DbWorldDownload.cancelDownload({ downloadId: id });
    setDownloads(prev => prev.filter(d => d.downloadId !== id));
  }, []);

  const remove = useCallback(async (id) => {
    await DbWorldDownload.deleteDownload({ downloadId: id });
    setDownloads(prev => prev.filter(d => d.downloadId !== id));
  }, []);

  return { downloads, loading, refresh, actions: { pause, resume, cancel, remove } };
}
