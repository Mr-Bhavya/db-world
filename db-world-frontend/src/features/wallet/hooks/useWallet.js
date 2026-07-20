import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import * as api from '../api/walletApi';

const errMsg = (e, fallback) => e?.response?.data?.message ?? fallback;

export function useDocumentTypes() {
  return useQuery({ queryKey: ['wallet', 'types'], queryFn: api.fetchDocumentTypes, staleTime: 60_000 });
}

export function useDocuments(filters) {
  return useQuery({
    queryKey: ['wallet', 'documents', filters],
    queryFn: () => api.fetchDocuments(filters),
  });
}

export function useAddDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ values, onProgress }) => api.addDocument(values, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      notify.success('Document added');
    },
    onError: (e) => notify.error(errMsg(e, 'Failed to add document')),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.updateDocument(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'document', vars?.id] });
      notify.success('Document updated');
    },
    onError: (e) => notify.error(errMsg(e, 'Failed to update document')),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      notify.success('Document deleted');
    },
    onError: (e) => notify.error(errMsg(e, 'Failed to delete document')),
  });
}
