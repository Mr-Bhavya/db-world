import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { getStoredUser } from '@shared/auth/tokenStore';
import { useAuth } from '@features/auth/context/Authentication';
import * as api from '../api/walletApi';
import { cacheWallet, readOfflineWallet, readOfflineDocument } from '../offline/walletCache';

const errMsg = (e, fallback) => e?.response?.data?.message ?? fallback;

const currentUserId = () => getStoredUser()?.id ?? getStoredUser()?.userId ?? null;

/**
 * Refuse a write that cannot reach the server, before it is attempted.
 *
 * An offline session holds no token, so every mutation would fail anyway — but it would
 * fail as a network error after the user filled in a form, which reads as the app being
 * broken rather than as the deliberate rule it is. Offline the wallet is READ-ONLY: it
 * exists so the documents are there when nothing else is, and queuing edits would mean
 * conflict rules for a store whose whole value is being trustworthy.
 */
function useOfflineGuard(action) {
  const { auth } = useAuth();
  return () => {
    if (!auth?.offline) return false;
    notify.warning(`Connect to the internet to ${action}.`);
    return true;
  };
}

export function useDocumentTypes() {
  return useQuery({ queryKey: ['wallet', 'types'], queryFn: api.fetchDocumentTypes, staleTime: 60_000 });
}

/**
 * The document list, with an encrypted offline snapshot behind it.
 *
 * Same shape the vault uses: cache write-through on every success (silent, no prompt),
 * and on failure fall back to the local copy behind one unlock. `retry: false` because
 * that fallback can prompt for a fingerprint — a retrying query would ask again and
 * again for the same thing.
 *
 * The snapshot is cached UNFILTERED. A filtered response is a view, not the wallet, and
 * caching one would leave someone offline holding whichever subset they last searched
 * for; filtering then happens locally over the snapshot.
 */
export function useDocuments(filters) {
  return useQuery({
    queryKey: ['wallet', 'documents', filters],
    retry: false,
    queryFn: async () => {
      const userId = currentUserId();
      try {
        const docs = await api.fetchDocuments(filters);
        const filtered = Boolean(filters?.typeId || filters?.q);
        if (!filtered) {
          // Fire and forget: downloading the files must never hold up the list.
          void cacheWallet(userId, docs, (id) => api.fetchContentBlob(id));
        }
        return docs;
      } catch (err) {
        const res = await readOfflineWallet(userId);
        if (res.status !== 'ok') throw err;
        return applyFilters(res.documents, filters);
      }
    },
  });
}

/**
 * Re-apply the server's filters locally.
 *
 * Offline there is no server to narrow the list, but the UI still passes whatever the
 * user typed — so without this, searching offline silently returns everything and looks
 * like the filter is broken.
 *
 * Deliberately mirrors WalletDocumentService.list EXACTLY: `q` matches on the LABEL and
 * nothing else. Searching more fields here would be worse than searching fewer — the
 * same query would return different documents depending on whether there was signal,
 * which is precisely the kind of thing that makes a store stop feeling trustworthy.
 *
 * The number is not searchable offline even in principle: the server holds the real
 * value and only ever sends a masked one, so there is nothing local to match against.
 */
function applyFilters(documents, filters) {
  let out = documents ?? [];
  if (filters?.typeId) out = out.filter((d) => String(d.typeId) === String(filters.typeId));
  if (filters?.q) {
    const q = String(filters.q).trim().toLowerCase();
    if (q) out = out.filter((d) => String(d.label ?? '').toLowerCase().includes(q));
  }
  return out;
}

/**
 * A document's bytes, from the server or — when it cannot be reached — the snapshot.
 *
 * `disposition` only means anything to the server; the cached copy is just bytes, and the
 * caller decides what to do with the Blob either way.
 */
export async function loadDocumentBlob(id, disposition = 'inline') {
  try {
    return await api.fetchContentBlob(id, disposition);
  } catch (err) {
    const res = await readOfflineDocument(currentUserId(), id);
    if (res.status === 'ok') return res.blob;
    throw err;
  }
}

export function useAddDocument() {
  const qc = useQueryClient();
  const blocked = useOfflineGuard('add a document');
  return useMutation({
    mutationFn: ({ values, onProgress }) => {
      if (blocked()) throw new Error('offline');
      return api.addDocument(values, onProgress);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      notify.success('Document added');
    },
    onError: (e) => { if (e?.message !== 'offline') notify.error(errMsg(e, 'Failed to add document')); },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  const blocked = useOfflineGuard('edit a document');
  return useMutation({
    mutationFn: ({ id, body }) => {
      if (blocked()) throw new Error('offline');
      return api.updateDocument(id, body);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'document', vars?.id] });
      notify.success('Document updated');
    },
    onError: (e) => { if (e?.message !== 'offline') notify.error(errMsg(e, 'Failed to update document')); },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const blocked = useOfflineGuard('delete a document');
  return useMutation({
    mutationFn: (id) => {
      if (blocked()) throw new Error('offline');
      return api.deleteDocument(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      notify.success('Document deleted');
    },
    onError: (e) => { if (e?.message !== 'offline') notify.error(errMsg(e, 'Failed to delete document')); },
  });
}
