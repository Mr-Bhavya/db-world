import React, { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { motion, useReducedMotion } from 'framer-motion';

import { Box, Button, Container, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import {
  ArrowBackRounded, DeleteForeverRounded, DeleteOutlineRounded, RestoreFromTrashRounded,
} from '@mui/icons-material';

import BrandLogo, { domainFromUrl } from '@shared/brand/BrandLogo';
import { useT } from '@shared/theme';
import usePageMeta from '@shared/hooks/usePageMeta';
import { getTrash, restoreCredential, purgeCredential } from '@shared/services/ApiServices';

import { looksLikeSite } from './entryUtils';
import { VaultAurora, GlassPanel, ConfirmDialog, useScrollTop, goBackOr } from './vaultShared';
import { VAULT_QUERY_KEY, TRASH_QUERY_KEY } from './useVault';

// Entries stay restorable this long; the server removes them after (TrashPurgeJob).
const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const errorMessage = (err, fallback) => err?.response?.data?.message ?? fallback;

/** "Deleted 3 days ago · 27 days left", from the server's deletedAt. */
const trashedLine = (deletedAt) => {
  const at = deletedAt ? new Date(deletedAt).getTime() : NaN;
  if (Number.isNaN(at)) return '';
  const elapsed = Math.max(0, Math.floor((Date.now() - at) / DAY_MS));
  const left = Math.max(0, RETENTION_DAYS - elapsed);
  const when = elapsed === 0 ? 'Deleted today' : `Deleted ${elapsed} ${elapsed === 1 ? 'day' : 'days'} ago`;
  return `${when} · ${left} ${left === 1 ? 'day' : 'days'} left`;
};

// ─────────────────────────────────────────────────────────────────────────────
// One trashed entry
// ─────────────────────────────────────────────────────────────────────────────

const TrashRow = memo(({ cred, host, busy, onRestore, onPurge, T }) => {
  const label = cred.name || host;
  return (
    <Box
      sx={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1,
        p: 1.25, borderRadius: 2.5, border: `1px solid ${T.glassBorder}`,
        bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: T.textPrimary, fontWeight: 800, fontSize: '0.92rem', overflowWrap: 'anywhere' }}>{label}</Typography>
        {cred.username && (
          <Typography sx={{ color: T.textMuted, fontSize: '0.8rem', overflowWrap: 'anywhere' }}>{cred.username}</Typography>
        )}
        <Typography sx={{ color: T.textFaint, fontSize: '0.74rem', mt: 0.25 }}>{trashedLine(cred.deletedAt)}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Restore">
          <span>
            <Button
              size="small" disabled={busy} onClick={() => onRestore(cred.id)} aria-label={`Restore ${label}`}
              startIcon={<RestoreFromTrashRounded fontSize="small" />}
              sx={{ minHeight: 40, color: T.teal, fontWeight: 800, borderRadius: 2, '&:hover': { bgcolor: T.tealBg } }}
            >
              Restore
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Delete forever">
          <span>
            <Button
              size="small" disabled={busy} onClick={() => onPurge({ id: cred.id, label })} aria-label={`Delete ${label} forever`}
              startIcon={<DeleteForeverRounded fontSize="small" />}
              sx={{ minHeight: 40, color: '#f87171', fontWeight: 800, borderRadius: 2, display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Delete forever
            </Button>
            <Button
              size="small" disabled={busy} onClick={() => onPurge({ id: cred.id, label })} aria-label={`Delete ${label} forever`}
              sx={{ minWidth: 40, minHeight: 40, color: '#f87171', borderRadius: 2, display: { xs: 'inline-flex', sm: 'none' } }}
            >
              <DeleteForeverRounded fontSize="small" />
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
});
TrashRow.displayName = 'TrashRow';

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const VaultTrash = () => {
  usePageMeta('Vault trash');
  useScrollTop();

  const T = useT();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [purgeTarget, setPurgeTarget] = useState(null);   // { id, label }
  const [emptying, setEmptying] = useState(false);        // the "Empty trash" confirm is open

  const { data: groups = [], isLoading, isError, refetch } = useQuery({
    queryKey: TRASH_QUERY_KEY,
    queryFn: async () => (await getTrash()).data ?? [],
  });

  const entryIds = useMemo(
    () => groups.flatMap((g) => (g.credentials ?? []).map((c) => c.id)),
    [groups],
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: VAULT_QUERY_KEY });
  };

  const { mutate: restore, isPending: restoring } = useMutation({
    mutationFn: (id) => restoreCredential(id),
    onSuccess: () => { notify.success('Restored to your vault'); refresh(); },
    // A 409 says which live entry is in the way: show the server's words.
    onError: (err) => notify.error(errorMessage(err, 'Failed to restore')),
  });

  const { mutate: purge, isPending: purging } = useMutation({
    mutationFn: (id) => purgeCredential(id),
    onSuccess: () => { notify.success('Deleted forever'); refresh(); setPurgeTarget(null); },
    onError: (err) => notify.error(errorMessage(err, 'Failed to delete')),
  });

  // One request per entry, one after the other: each purge is its own transaction on the server.
  const { mutate: emptyTrash, isPending: emptyingNow } = useMutation({
    mutationFn: async () => {
      let removed = 0;
      for (const id of entryIds) {
        await purgeCredential(id);
        removed += 1;
      }
      return removed;
    },
    onSuccess: (removed) => { notify.success(`Deleted ${removed} ${removed === 1 ? 'entry' : 'entries'} forever`); refresh(); setEmptying(false); },
    onError: (err) => { notify.error(errorMessage(err, 'Failed to empty the trash')); refresh(); setEmptying(false); },
  });

  const busy = restoring || purging || emptyingNow;

  return (
    <Box sx={{ position: 'relative', bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' }, overflowX: 'hidden' }}>
      <VaultAurora />

      <Container maxWidth={false} sx={{
        position: 'relative', zIndex: 1, width: '100%',
        maxWidth: { xs: '100%', sm: 760, md: 980 },
        px: { xs: 2, sm: 2.5, md: 3 }, py: { xs: 2.5, sm: 3.5, md: 5 },
      }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: { xs: 2, md: 2.5 } }}>
          <Button startIcon={<ArrowBackRounded />} onClick={() => goBackOr(navigate)}
            sx={{ color: T.textMuted, fontWeight: 700, px: 1, minHeight: 44, borderRadius: 2, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
            Back
          </Button>
          <Button startIcon={<DeleteForeverRounded />} disabled={entryIds.length === 0 || busy} onClick={() => setEmptying(true)}
            sx={{ color: '#f87171', fontWeight: 800, px: 2, minHeight: 44, borderRadius: 2, whiteSpace: 'nowrap', border: '1px solid rgba(248,113,113,0.35)', '&:hover': { bgcolor: 'rgba(248,113,113,0.08)' } }}>
            Empty trash
          </Button>
        </Box>

        {/* Header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', gap: 1.4, mb: 2.5 }}>
          <Box sx={{ width: { xs: 42, sm: 46 }, height: { xs: 42, sm: 46 }, borderRadius: 2.5, bgcolor: T.tealBg, border: `1px solid ${T.teal}44`, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: `0 0 28px ${T.tealGlow}` }}>
            <DeleteOutlineRounded sx={{ fontSize: 22, color: T.teal }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 'clamp(1.25rem, 5vw, 1.6rem)', lineHeight: 1.1, fontWeight: 900, color: T.textPrimary }}>Trash</Typography>
            <Typography sx={{ mt: 0.35, fontSize: { xs: '0.78rem', sm: '0.84rem' }, color: T.textMuted }}>
              Deleted entries stay here for {RETENTION_DAYS} days, then they are removed for good.
            </Typography>
          </Box>
        </Box>

        {isLoading ? (
          <Stack spacing={1.5}>
            {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={110} sx={{ bgcolor: T.glassBorder, borderRadius: 3 }} />)}
          </Stack>
        ) : isError ? (
          <GlassPanel sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ color: T.textMuted, mb: 1.5 }}>Could not load the trash.</Typography>
            <Button onClick={() => refetch()} sx={{ color: T.teal, fontWeight: 800 }}>Try again</Button>
          </GlassPanel>
        ) : groups.length === 0 ? (
          <GlassPanel sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <DeleteOutlineRounded sx={{ fontSize: 40, color: T.textFaint, mb: 1 }} />
            <Typography sx={{ color: T.textPrimary, fontWeight: 800 }}>Trash is empty</Typography>
            <Typography sx={{ color: T.textMuted, fontSize: '0.85rem', mt: 0.5 }}>Entries you delete from the vault wait here before they are gone.</Typography>
          </GlassPanel>
        ) : (
          <Stack spacing={{ xs: 1.5, sm: 2 }}>
            {groups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04 }}
              >
                <GlassPanel sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                    <BrandLogo logoDomain={looksLikeSite(group.host) ? domainFromUrl(group.host) : ''} companyName={group.host} size={34} radius={2} />
                    <Typography sx={{ color: T.textPrimary, fontWeight: 900, fontSize: { xs: '0.95rem', sm: '1.02rem' }, overflowWrap: 'anywhere' }} title={group.host}>{group.host}</Typography>
                  </Box>
                  <Stack spacing={1}>
                    {(group.credentials ?? []).map((cred) => (
                      <TrashRow key={cred.id} cred={cred} host={group.host} busy={busy} T={T}
                        onRestore={restore} onPurge={setPurgeTarget} />
                    ))}
                  </Stack>
                </GlassPanel>
              </motion.div>
            ))}
          </Stack>
        )}
      </Container>

      {purgeTarget && (
        <ConfirmDialog
          title="Delete forever"
          body={`Delete "${purgeTarget.label}" forever? This cannot be undone.`}
          confirmLabel="Delete forever" loadingLabel="Deleting…"
          loading={purging} onConfirm={() => purge(purgeTarget.id)} onClose={() => setPurgeTarget(null)}
        />
      )}
      {emptying && (
        <ConfirmDialog
          title="Empty trash"
          body={`Delete ${entryIds.length} ${entryIds.length === 1 ? 'entry' : 'entries'} forever? This cannot be undone.`}
          confirmLabel="Empty trash" loadingLabel="Deleting…"
          loading={emptyingNow} onConfirm={() => emptyTrash()} onClose={() => setEmptying(false)}
        />
      )}
    </Box>
  );
};

export default VaultTrash;
