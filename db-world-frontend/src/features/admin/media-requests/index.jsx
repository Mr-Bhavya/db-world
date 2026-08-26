import { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButton, ToggleButtonGroup, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CheckCircleRounded, CancelRounded, MovieRounded, LiveTvRounded,
  HourglassEmptyRounded, DoneAllRounded, BlockRounded, OpenInNewRounded, RestoreRounded,
  HighQualityRounded, MobileFriendlyRounded, AddCircleOutlineRounded,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import Constants from '@shared/constants';
import {
  fetchAdminMediaRequests, fulfillMediaRequest, dismissMediaRequest, reopenMediaRequest,
} from '@features/cinema/api/cinemaApi';
import VotersPopover from '@features/admin/requests/components/VotersPopover';

const STATUS_META = {
  PENDING:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <HourglassEmptyRounded sx={{ fontSize: 13 }} />, label: 'Pending' },
  FULFILLED: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <DoneAllRounded sx={{ fontSize: 13 }} />,        label: 'Fulfilled' },
  DISMISSED: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <BlockRounded sx={{ fontSize: 13 }} />,         label: 'Dismissed' },
};

const KIND_META = {
  NEW_FILES:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: <AddCircleOutlineRounded sx={{ fontSize: 13 }} />, label: 'Needs files' },
  HIGHER_QUALITY: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  icon: <HighQualityRounded sx={{ fontSize: 13 }} />,      label: 'Higher quality' },
  LOWER_QUALITY:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  icon: <MobileFriendlyRounded sx={{ fontSize: 13 }} />,   label: 'Lower quality' },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <Chip label={m.label} size="small" icon={m.icon}
      sx={{ bgcolor: m.bg, color: m.color, fontWeight: 700, fontSize: 10, height: 22,
        '& .MuiChip-icon': { color: m.color, ml: 0.5 } }} />
  );
}

function KindChip({ kind }) {
  const m = KIND_META[kind] ?? KIND_META.NEW_FILES;
  return (
    <Chip label={m.label} size="small" icon={m.icon}
      sx={{ bgcolor: m.bg, color: m.color, fontWeight: 700, fontSize: 10, height: 22,
        '& .MuiChip-icon': { color: m.color, ml: 0.5 } }} />
  );
}

/**
 * WHICH PART of the title was asked for. A series request is scoped: the whole show, one
 * season, or a single episode -- and "needs files for Breaking Bad" is unactionable when
 * seasons 1-3 are already in the library. Movies only ever have one shape, so they show
 * nothing here rather than a chip that always reads the same.
 */
function ScopeChip({ scopeLabel, isMovie, T, S }) {
  if (isMovie) return null;
  const wholeShow = !scopeLabel || scopeLabel === 'All';
  return (
    <Chip
      size="small"
      label={wholeShow ? 'Whole show' : scopeLabel}
      sx={{
        height: 22, fontWeight: 800, fontSize: 10,
        fontVariantNumeric: 'tabular-nums',
        bgcolor: wholeShow ? 'transparent' : 'rgba(45,212,191,0.14)',
        color: wholeShow ? T.textMuted : '#2dd4bf',
        border: `1px solid ${wholeShow ? S.border : 'rgba(45,212,191,0.4)'}`,
      }}
    />
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

export default function MediaRequestsAdminPage() {
  const T = useT();
  const S = adminSurface(T);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-media-requests', statusFilter],
    queryFn: () => fetchAdminMediaRequests(statusFilter),
    staleTime: 30_000,
  });

  const counts = useMemo(() => ({
    PENDING:   statusFilter === 'PENDING'   ? requests.length : null,
    FULFILLED: statusFilter === 'FULFILLED' ? requests.length : null,
    DISMISSED: statusFilter === 'DISMISSED' ? requests.length : null,
  }), [requests, statusFilter]);

  const fulfillMut = useMutation({
    mutationFn: fulfillMediaRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-media-requests'] });
      notify.success('Request fulfilled — voters notified.');
    },
    onError: () => notify.error('Could not fulfill request.'),
  });

  const dismissMut = useMutation({
    mutationFn: ({ id, reason }) => dismissMediaRequest(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-media-requests'] });
      notify.info('Request dismissed — voters notified.');
      setDismissTarget(null);
      setDismissReason('');
    },
    onError: () => notify.error('Could not dismiss request.'),
  });

  const [dismissTarget, setDismissTarget] = useState(null); // the request row being dismissed
  const [dismissReason, setDismissReason] = useState('');

  const reopenMut = useMutation({
    mutationFn: reopenMediaRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-media-requests'] });
      notify.info('Request reopened — back to pending.');
    },
    onError: () => notify.error('Could not reopen request.'),
  });

  const openRecord = (req) => {
    const isMovie = req.recordType === 'MOVIE';
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    const slug = (req.recordTitle ?? '').replace(/\s+/g, '-').toLowerCase();
    navigate(base.replace(':title', `${req.recordId}-${slug}`));
  };

  // Action buttons for a row — shared by the desktop table and the mobile cards
  // so the fulfill/dismiss/reopen logic stays in one place.
  const renderActions = (r) => {
    if (r.status === 'PENDING') {
      return (
        <>
          <Tooltip title="Mark fulfilled & notify voters">
            <span>
              <IconButton size="small" disabled={fulfillMut.isPending} onClick={() => fulfillMut.mutate(r.id)} sx={{ color: '#10b981' }}>
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
    if (r.status === 'FULFILLED') {
      return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          {r.fulfilledByUsername && (
            <Typography variant="caption" sx={{ color: T.textFaint }}>
              by {r.fulfilledByUsername}
            </Typography>
          )}
          <Tooltip title="Reopen (undo fulfill)">
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

  const renderMobileList = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {isLoading && (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {!isLoading && requests.length === 0 && (
        <Box sx={{ py: 6, textAlign: 'center', color: T.textFaint, fontSize: 13 }}>
          No {statusFilter.toLowerCase()} requests.
        </Box>
      )}
      {!isLoading && requests.map((r) => {
        const isMovie = r.recordType === 'MOVIE';
        return (
          <Box key={r.id} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${S.border}`, bgcolor: S.card }}>
            {/* Title row: open-record · title · status */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Tooltip title="Open record">
                <IconButton size="small" onClick={() => openRecord(r)} sx={{ color: T.teal, mt: -0.25 }}>
                  <OpenInNewRounded sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: T.text }}>
                  {r.recordTitle}
                </Typography>
                {r.status === 'DISMISSED' && r.dismissReason && (
                  <Typography variant="caption" sx={{ color: T.textFaint, fontStyle: 'italic', display: 'block' }}>
                    “{r.dismissReason}”
                  </Typography>
                )}
              </Box>
              <StatusChip status={r.status} />
            </Box>

            {/* Meta row: type · kind · voters */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 1, pl: 4.5 }}>
              <TypeChip isMovie={isMovie} T={T} S={S} />
              <ScopeChip scopeLabel={r.scopeLabel} isMovie={isMovie} T={T} S={S} />
              <KindChip kind={r.kind} />
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <VotersPopover voters={r.voters} voteCount={r.voteCount} />
              </Box>
            </Box>

            {/* Footer row: created · actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1, pl: 4.5 }}>
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
        Users vote on what they want added — a whole title, a season, or a single episode. A request closes itself once matching files land (shown as fulfilled by <em>auto (file match)</em>); tick one off by hand if you answered it some other way. Voters are notified either way.
      </Typography>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={statusFilter}
        onChange={(_, v) => v && setStatusFilter(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="PENDING">Pending{counts.PENDING != null ? ` · ${counts.PENDING}` : ''}</ToggleButton>
        <ToggleButton value="FULFILLED">Fulfilled</ToggleButton>
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
                <TableCell>Request</TableCell>
                <TableCell align="center">Voters</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: T.textFaint }}>
                    No {statusFilter.toLowerCase()} requests.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && requests.map((r) => {
                const isMovie = r.recordType === 'MOVIE';
                return (
                  <TableRow key={r.id} hover sx={{ '& td': { borderBottom: `1px solid ${S.divider}` } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Tooltip title="Open record">
                          <IconButton size="small" onClick={() => openRecord(r)} sx={{ color: T.teal }}>
                            <OpenInNewRounded sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: T.text }}>
                            {r.recordTitle}
                          </Typography>
                          {r.status === 'DISMISSED' && r.dismissReason && (
                            <Typography variant="caption" sx={{
                              color: T.textFaint, fontStyle: 'italic', display: 'block',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: 320,
                            }}>
                              “{r.dismissReason}”
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <TypeChip isMovie={isMovie} T={T} S={S} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <KindChip kind={r.kind} />
                        <ScopeChip scopeLabel={r.scopeLabel} isMovie={isMovie} T={T} S={S} />
                      </Box>
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
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Dismiss request</DialogTitle>
        <DialogContent dividers>
          {dismissTarget && (
            <>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{dismissTarget.recordTitle}</strong>
                {dismissTarget.scopeLabel && dismissTarget.scopeLabel !== 'All' && (
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {' · '}{dismissTarget.scopeLabel}
                  </Box>
                )}
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
                placeholder="e.g. Not available in higher quality, will retry next month"
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
