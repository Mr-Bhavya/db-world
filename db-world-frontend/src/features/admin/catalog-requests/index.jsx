import { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButton, ToggleButtonGroup, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CloudUploadRounded, CancelRounded, MovieRounded, LiveTvRounded, RestoreRounded, OpenInNewRounded,
  HourglassEmptyRounded, DoneAllRounded, BlockRounded, CheckCircleRounded,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import Constants from '@shared/constants';
import {
  fetchAdminCatalogRequests, ingestCatalogRequest, markCatalogRequestFulfilledNoIngest,
  dismissCatalogRequest, reopenCatalogRequest, tmdbImg,
} from '@features/cinema/api/cinemaApi';
import VotersPopover from '@features/admin/requests/components/VotersPopover';

const STATUS_META = {
  PENDING:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <HourglassEmptyRounded sx={{ fontSize: 13 }} />, label: 'Pending' },
  INGESTED:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <DoneAllRounded sx={{ fontSize: 13 }} />,        label: 'Ingested' },
  DISMISSED: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <BlockRounded sx={{ fontSize: 13 }} />,         label: 'Dismissed' },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <Chip label={m.label} size="small" icon={m.icon}
      sx={{ bgcolor: m.bg, color: m.color, fontWeight: 700, fontSize: 10, height: 22,
        '& .MuiChip-icon': { color: m.color, ml: 0.5 } }} />
  );
}

function TypeChip({ isMovie, T, S }) {
  return (
    <Chip
      size="small"
      icon={isMovie ? <MovieRounded sx={{ fontSize: 13 }} /> : <LiveTvRounded sx={{ fontSize: 13 }} />}
      label={isMovie ? 'Movie' : 'TV'}
      sx={{ height: 22, fontWeight: 600, bgcolor: 'transparent', border: `1px solid ${S.border}`, color: T.textMuted }}
    />
  );
}

function formatRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const day = 86_400_000;
  if (diff < 60_000)  return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day)     return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CatalogRequestsAdminPage() {
  const T = useT();
  const S = adminSurface(T);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [dismissTarget, setDismissTarget] = useState(null);
  const [dismissReason, setDismissReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-catalog-requests', statusFilter],
    queryFn: () => fetchAdminCatalogRequests(statusFilter),
    staleTime: 30_000,
  });

  const ingestMut = useMutation({
    mutationFn: ingestCatalogRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-catalog-requests'] });
      notify.success('Ingested — voters notified.');
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || 'Could not ingest. Check the logs.';
      notify.error(msg);
    },
  });

  const fulfillNoIngestMut = useMutation({
    mutationFn: markCatalogRequestFulfilledNoIngest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-catalog-requests'] });
      notify.success('Marked fulfilled — voters will find the file via search.');
    },
    onError: () => notify.error('Could not mark fulfilled.'),
  });

  const dismissMut = useMutation({
    mutationFn: ({ id, reason }) => dismissCatalogRequest(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-catalog-requests'] });
      notify.info('Dismissed — voters notified.');
      setDismissTarget(null);
      setDismissReason('');
    },
    onError: () => notify.error('Could not dismiss request.'),
  });

  const reopenMut = useMutation({
    mutationFn: reopenCatalogRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-catalog-requests'] });
      notify.info('Request reopened — back to pending.');
    },
    onError: () => notify.error('Could not reopen request.'),
  });

  const openNewRecord = (req) => {
    if (!req.createdRecordId) return;
    const isMovie = req.mediaType === 'MOVIE';
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    const slug = (req.title ?? '').replace(/\s+/g, '-').toLowerCase();
    navigate(base.replace(':title', `${req.createdRecordId}-${slug}`));
  };

  const tmdbHref = (req) => {
    const path = req.mediaType === 'MOVIE' ? 'movie' : 'tv';
    return `https://www.themoviedb.org/${path}/${req.tmdbId}`;
  };

  const headerCount = useMemo(
    () => (statusFilter === 'PENDING' ? requests.length : null),
    [requests, statusFilter]
  );

  // Action buttons for a row — shared by the desktop table and the mobile cards
  // so the ingest/fulfill/dismiss/reopen logic stays in one place.
  const renderActions = (r) => {
    if (r.status === 'PENDING') {
      return (
        <>
          <Tooltip title="Ingest TMDB metadata & notify voters">
            <span>
              <IconButton size="small" disabled={ingestMut.isPending} onClick={() => ingestMut.mutate(r.id)} sx={{ color: '#10b981' }}>
                <CloudUploadRounded sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Mark fulfilled (file already uploaded — voters find it via search)">
            <span>
              <IconButton size="small" disabled={fulfillNoIngestMut.isPending} onClick={() => fulfillNoIngestMut.mutate(r.id)} sx={{ color: T.teal }}>
                <CheckCircleRounded sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Dismiss (with optional message to voters)">
            <span>
              <IconButton size="small" disabled={dismissMut.isPending} onClick={() => { setDismissTarget(r); setDismissReason(''); }} sx={{ color: T.textMuted }}>
                <CancelRounded sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
        </>
      );
    }
    if (r.status === 'INGESTED') {
      return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {r.createdRecordId && (
            <Tooltip title="Open new record">
              <IconButton size="small" onClick={() => openNewRecord(r)} sx={{ color: T.teal }}>
                <OpenInNewRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {r.ingestedByUsername && (
            <Typography variant="caption" sx={{ color: T.textFaint }}>
              by {r.ingestedByUsername}
            </Typography>
          )}
          <Tooltip title="Reopen (undo ingest)">
            <span>
              <IconButton size="small" disabled={reopenMut.isPending} onClick={() => reopenMut.mutate(r.id)} sx={{ color: T.textMuted }}>
                <RestoreRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      );
    }
    if (r.status === 'DISMISSED') {
      return (
        <Tooltip title="Reopen (undo dismiss)">
          <span>
            <IconButton size="small" disabled={reopenMut.isPending} onClick={() => reopenMut.mutate(r.id)} sx={{ color: T.textMuted }}>
              <RestoreRounded sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      );
    }
    return null;
  };

  const renderPoster = (r, poster, size) => (
    <Box sx={{
      width: size.w, height: size.h, borderRadius: 0.75, overflow: 'hidden',
      bgcolor: S.inset, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {poster
        ? <Box component="img" src={poster} alt={r.title} loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Typography variant="caption" sx={{ color: T.textFaint }}>—</Typography>
      }
    </Box>
  );

  const renderTitleBlock = (r) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: T.text }}>
        {r.title}{r.releaseYear ? ` (${r.releaseYear})` : ''}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
        <Tooltip title="View on TMDB">
          <Typography
            component="a"
            href={tmdbHref(r)}
            target="_blank"
            rel="noreferrer"
            variant="caption"
            sx={{ color: T.teal, textDecoration: 'none', fontWeight: 600 }}
          >
            TMDB #{r.tmdbId}
          </Typography>
        </Tooltip>
      </Box>
      {r.note && (
        <Typography variant="caption" sx={{ color: T.textFaint, fontStyle: 'italic', display: 'block', mt: 0.25 }}>
          “{r.note}”
        </Typography>
      )}
      {r.status === 'DISMISSED' && r.dismissReason && (
        <Typography variant="caption" sx={{ color: T.textFaint, fontStyle: 'italic', display: 'block', mt: 0.25 }}>
          Dismissed: “{r.dismissReason}”
        </Typography>
      )}
    </Box>
  );

  const renderMobileList = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {isLoading && (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {!isLoading && requests.length === 0 && (
        <Box sx={{ py: 6, textAlign: 'center', color: T.textFaint, fontSize: 13 }}>
          No {statusFilter.toLowerCase()} catalog requests.
        </Box>
      )}
      {!isLoading && requests.map((r) => {
        const isMovie = r.mediaType === 'MOVIE';
        const poster = tmdbImg(r.posterPath, 'w92');
        return (
          <Box key={r.id} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${S.border}`, bgcolor: S.card }}>
            {/* Title row: poster · title/TMDB/note · status */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
              {renderPoster(r, poster, { w: 40, h: 60 })}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {renderTitleBlock(r)}
              </Box>
              <StatusChip status={r.status} />
            </Box>

            {/* Meta row: type · voters */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
              <TypeChip isMovie={isMovie} T={T} S={S} />
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <VotersPopover voters={r.voters} voteCount={r.voteCount} />
              </Box>
            </Box>

            {/* Footer row: created · actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1 }}>
              <Tooltip title={r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}>
                <Typography variant="caption" sx={{ color: T.textMuted }}>
                  {formatRelative(r.createdAt)}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {renderActions(r)}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Box>
      <Typography variant="body2" sx={{ color: T.textMuted, mb: 2 }}>
        Titles users want added to the catalog. Ingest pulls TMDB metadata and creates the record; voters get notified with a link to the new record.
      </Typography>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={statusFilter}
        onChange={(_, v) => v && setStatusFilter(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="PENDING">Pending{headerCount != null ? ` · ${headerCount}` : ''}</ToggleButton>
        <ToggleButton value="INGESTED">Ingested</ToggleButton>
        <ToggleButton value="DISMISSED">Dismissed</ToggleButton>
      </ToggleButtonGroup>

      {isMobile ? (
        renderMobileList()
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 2, boxShadow: 'none' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textMuted, bgcolor: S.inset, borderBottom: `1px solid ${S.border}` } }}>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="center">Voters</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 150 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: T.textFaint }}>
                    No {statusFilter.toLowerCase()} catalog requests.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && requests.map((r) => {
                const isMovie = r.mediaType === 'MOVIE';
                const poster = tmdbImg(r.posterPath, 'w92');
                return (
                  <TableRow key={r.id} hover sx={{ '& td': { borderBottom: `1px solid ${S.divider}` } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {renderPoster(r, poster, { w: 40, h: 60 })}
                        {renderTitleBlock(r)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <TypeChip isMovie={isMovie} T={T} S={S} />
                    </TableCell>
                    <TableCell align="center">
                      <VotersPopover voters={r.voters} voteCount={r.voteCount} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}>
                        <Typography variant="caption" sx={{ color: T.textMuted }}>
                          {formatRelative(r.createdAt)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell><StatusChip status={r.status} /></TableCell>
                    <TableCell align="right">
                      {renderActions(r)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dismiss dialog */}
      <Dialog
        open={Boolean(dismissTarget)}
        onClose={() => { if (!dismissMut.isPending) setDismissTarget(null); }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Dismiss catalog request</DialogTitle>
        <DialogContent dividers>
          {dismissTarget && (
            <>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{dismissTarget.title}</strong>{dismissTarget.releaseYear ? ` (${dismissTarget.releaseYear})` : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                {dismissTarget.voteCount} voter{dismissTarget.voteCount === 1 ? '' : 's'} will be notified.
              </Typography>
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={3}
                label="Reason (optional)"
                placeholder="e.g. Not available on TMDB in this region, or licensing won't allow"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value.slice(0, 500))}
                helperText={`${dismissReason.length}/500`}
                FormHelperTextProps={{ sx: { textAlign: 'right' } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDismissTarget(null)} disabled={dismissMut.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={dismissMut.isPending || !dismissTarget}
            onClick={() => dismissMut.mutate({ id: dismissTarget.id, reason: dismissReason })}
            disableElevation
          >
            Dismiss & notify
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
