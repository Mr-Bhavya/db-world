import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
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
  const { enqueueSnackbar } = useSnackbar();
  return useMutation({
    mutationFn: ({ values, onProgress }) => api.addDocument(values, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      enqueueSnackbar('Document added', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errMsg(e, 'Failed to add document'), { variant: 'error' }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation({
    mutationFn: ({ id, body }) => api.updateDocument(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'document', vars?.id] });
      enqueueSnackbar('Document updated', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errMsg(e, 'Failed to update document'), { variant: 'error' }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation({
    mutationFn: (id) => api.deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      enqueueSnackbar('Document deleted', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errMsg(e, 'Failed to delete document'), { variant: 'error' }),
  });
}
