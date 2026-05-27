import { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButton, ToggleButtonGroup, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import {
  CloudUpload, Cancel, Movie, LiveTv, Restore, OpenInNew,
  HourglassEmpty, DoneAll, Block, Inventory,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import {
  fetchAdminCatalogRequests, ingestCatalogRequest,
  dismissCatalogRequest, reopenCatalogRequest, tmdbImg,
} from '@features/cinema/api/cinemaApi';

const STATUS_META = {
  PENDING:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <HourglassEmpty sx={{ fontSize: 13 }} />, label: 'Pending' },
  INGESTED:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <DoneAll sx={{ fontSize: 13 }} />,        label: 'Ingested' },
  DISMISSED: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <Block sx={{ fontSize: 13 }} />,         label: 'Dismissed' },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <Chip label={m.label} size="small" icon={m.icon}
      sx={{ bgcolor: m.bg, color: m.color, fontWeight: 700, fontSize: 10, height: 22,
        '& .MuiChip-icon': { color: m.color, ml: 0.5 } }} />
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
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
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
      enqueueSnackbar('Ingested — voters notified.', { variant: 'success' });
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || 'Could not ingest. Check the logs.';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  const dismissMut = useMutation({
    mutationFn: ({ id, reason }) => dismissCatalogRequest(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-catalog-requests'] });
      enqueueSnackbar('Dismissed — voters notified.', { variant: 'info' });
      setDismissTarget(null);
      setDismissReason('');
    },
    onError: () => enqueueSnackbar('Could not dismiss request.', { variant: 'error' }),
  });

  const reopenMut = useMutation({
    mutationFn: reopenCatalogRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-catalog-requests'] });
      enqueueSnackbar('Request reopened — back to pending.', { variant: 'info' });
    },
    onError: () => enqueueSnackbar('Could not reopen request.', { variant: 'error' }),
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Inventory sx={{ color: T.teal, fontSize: 26 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: T.text, letterSpacing: '-0.01em' }}>
          Catalog Requests
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: T.textMuted, mb: 3 }}>
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

      <TableContainer component={Paper} sx={{ bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2, boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textMuted, borderBottom: `1px solid ${T.glassBorder}` } }}>
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
                <TableRow key={r.id} hover sx={{ '& td': { borderBottom: `1px solid ${T.glassBorder}` } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 40, height: 60, borderRadius: 0.75, overflow: 'hidden',
                        bgcolor: `${T.text}11`, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {poster
                          ? <Box component="img" src={poster} alt={r.title} loading="lazy"
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Typography variant="caption" sx={{ color: T.textFaint }}>—</Typography>
                        }
                      </Box>
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
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      icon={isMovie ? <Movie sx={{ fontSize: 13 }} /> : <LiveTv sx={{ fontSize: 13 }} />}
                      label={isMovie ? 'Movie' : 'TV'}
                      sx={{ height: 22, fontWeight: 600, bgcolor: 'transparent', border: `1px solid ${T.glassBorder}`, color: T.textMuted }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Avatar sx={{
                      width: 28, height: 28, mx: 'auto',
                      bgcolor: r.voteCount >= 5 ? '#10b98122' : r.voteCount >= 2 ? '#f59e0b22' : `${T.text}11`,
                      color: r.voteCount >= 5 ? '#10b981' : r.voteCount >= 2 ? '#f59e0b' : T.textMuted,
                      fontSize: 12, fontWeight: 800,
                    }}>
                      {r.voteCount}
                    </Avatar>
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
                    {r.status === 'PENDING' && (
                      <>
                        <Tooltip title="Ingest TMDB metadata & notify voters">
                          <span>
                            <IconButton size="small" disabled={ingestMut.isPending} onClick={() => ingestMut.mutate(r.id)} sx={{ color: '#10b981' }}>
                              <CloudUpload sx={{ fontSize: 20 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Dismiss (with optional message to voters)">
                          <span>
                            <IconButton size="small" disabled={dismissMut.isPending} onClick={() => { setDismissTarget(r); setDismissReason(''); }} sx={{ color: T.textMuted }}>
                              <Cancel sx={{ fontSize: 20 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                    {r.status === 'INGESTED' && (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        {r.createdRecordId && (
                          <Tooltip title="Open new record">
                            <IconButton size="small" onClick={() => openNewRecord(r)} sx={{ color: T.teal }}>
                              <OpenInNew sx={{ fontSize: 18 }} />
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
                              <Restore sx={{ fontSize: 18 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    )}
                    {r.status === 'DISMISSED' && (
                      <Tooltip title="Reopen (undo dismiss)">
                        <span>
                          <IconButton size="small" disabled={reopenMut.isPending} onClick={() => reopenMut.mutate(r.id)} sx={{ color: T.textMuted }}>
                            <Restore sx={{ fontSize: 18 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

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
