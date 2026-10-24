import React, { memo, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';

import {
  Box, Button, Dialog, DialogContent, DialogTitle, Skeleton, Stack, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import { HistoryRounded, RestoreRounded } from '@mui/icons-material';

import { useT } from '@shared/theme';
import CommonServices from '@shared/services/CommonServices';
import { getHistory, restorePassword } from '@shared/services/ApiServices';

import FieldValue from './FieldValue';
import { ResponsiveDialogActions } from './vaultShared';
import { VAULT_QUERY_KEY } from './useVault';

export const HISTORY_QUERY_KEY = 'pm-history';
export const historyQueryKey = (credentialId) => [HISTORY_QUERY_KEY, credentialId];

const errorMessage = (err, fallback) => err?.response?.data?.message ?? fallback;

/** "24 Oct 2026, 10:00": when the password stopped being the current one. */
export const changedLabel = (changedAt) => {
  const at = changedAt ? new Date(changedAt) : null;
  if (!at || Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// ─────────────────────────────────────────────────────────────────────────────
// One earlier password
// ─────────────────────────────────────────────────────────────────────────────

const HistoryRow = memo(({ row, busy, copied, onCopy, onRestore, T }) => (
  <Box
    sx={{
      p: 1.25, borderRadius: 2.5, border: `1px solid ${T.glassBorder}`, minWidth: 0,
      bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    }}
  >
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ color: T.textFaint, fontSize: '0.76rem', fontWeight: 700 }}>
        Replaced {changedLabel(row.changedAt)}
      </Typography>
      <Button
        size="small" disabled={busy} onClick={() => onRestore(row.id)}
        aria-label={`Restore the password replaced ${changedLabel(row.changedAt)}`}
        startIcon={<RestoreRounded fontSize="small" />}
        sx={{ minHeight: 40, color: T.teal, fontWeight: 800, borderRadius: 2, '&:hover': { bgcolor: T.tealBg } }}
      >
        Restore
      </Button>
    </Box>
    <FieldValue
      field={{ fieldKey: 'Password', fieldValue: row.password, fieldType: 'HIDDEN' }}
      copied={copied}
      onCopy={(value) => onCopy(value, row.id)}
    />
  </Box>
));
HistoryRow.displayName = 'HistoryRow';

// ─────────────────────────────────────────────────────────────────────────────
// Dialog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The last five passwords an entry had, newest first. Fetched only while the dialog is open.
 * "Restore" makes one the current password; the one it replaces goes into this list, so it can be undone.
 */
const PasswordHistoryDialog = ({ open = true, credentialId, label, host, onClose }) => {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState('');

  const { data: rows = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: historyQueryKey(credentialId),
    queryFn: async () => (await getHistory(credentialId)).data ?? [],
    enabled: open && !!credentialId,
    // Always the server's list on open: the app-wide staleTime (2 min) would otherwise show a list
    // that is missing the newest password, or lists a row the server has since trimmed.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { mutate: restore, isPending: restoring } = useMutation({
    mutationFn: (historyId) => restorePassword(credentialId, historyId),
    onSuccess: () => {
      notify.success('Password restored');
      queryClient.invalidateQueries({ queryKey: historyQueryKey(credentialId) });
      queryClient.invalidateQueries({ queryKey: VAULT_QUERY_KEY });
    },
    onError: (err) => notify.error(errorMessage(err, 'Failed to restore the password')),
  });

  const copy = useCallback(async (text, id) => {
    const res = await CommonServices.handleCopy(String(text));
    if (res.success) { setCopiedId(id); setTimeout(() => setCopiedId(''), 1400); }
    else notify.error('Copy failed');
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: T.bg, border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`, borderRadius: fullScreen ? 0 : 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: T.tealBg, border: `1px solid ${T.teal}44`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <HistoryRounded sx={{ fontSize: 22, color: T.teal }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: T.textPrimary, fontWeight: 900, fontSize: '1.08rem', lineHeight: 1.2 }}>Password history</Typography>
            <Typography sx={{ color: T.textMuted, fontWeight: 500, fontSize: { xs: '0.76rem', sm: '0.8rem' }, overflowWrap: 'anywhere' }}>
              {[label, host].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: '12px !important' }}>
        {isLoading ? (
          <Stack spacing={1.25} aria-label="Loading password history">
            {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={84} sx={{ bgcolor: T.glassBorder, borderRadius: 2.5 }} />)}
          </Stack>
        ) : isError ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ color: T.textMuted, mb: 1.5 }}>Could not load the password history.</Typography>
            <Button onClick={() => refetch()} sx={{ color: T.teal, fontWeight: 800, minHeight: 44 }}>Try again</Button>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <HistoryRounded sx={{ fontSize: 40, color: T.textFaint, mb: 1 }} />
            <Typography sx={{ color: T.textPrimary, fontWeight: 800 }}>No earlier passwords</Typography>
            <Typography sx={{ color: T.textMuted, fontSize: '0.85rem', mt: 0.5 }}>
              When you change this password, the old one is kept here. The last 5 are saved.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {rows.map((row) => (
              <HistoryRow key={row.id} row={row} busy={restoring || isFetching} T={T}
                copied={copiedId === row.id} onCopy={copy} onRestore={restore} />
            ))}
          </Stack>
        )}
      </DialogContent>

      <ResponsiveDialogActions>
        <Button onClick={onClose} sx={{ color: T.textMuted, fontWeight: 700 }}>Close</Button>
      </ResponsiveDialogActions>
    </Dialog>
  );
};

export default PasswordHistoryDialog;
