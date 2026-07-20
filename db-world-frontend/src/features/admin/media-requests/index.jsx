import { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import {
  CheckCircle, Cancel, Movie, LiveTv,
  HourglassEmpty, DoneAll, Block, OpenInNew, Restore,
  HighQuality, MobileFriendly, AddCircleOutline,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import {
  fetchAdminMediaRequests, fulfillMediaRequest, dismissMediaRequest, reopenMediaRequest,
} from '@features/cinema/api/cinemaApi';
import VotersPopover from '@features/admin/requests/components/VotersPopover';

const STATUS_META = {
  PENDING:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <HourglassEmpty sx={{ fontSize: 13 }} />, label: 'Pending' },
  FULFILLED: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <DoneAll sx={{ fontSize: 13 }} />,        label: 'Fulfilled' },
  DISMISSED: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <Block sx={{ fontSize: 13 }} />,         label: 'Dismissed' },
};

const KIND_META = {
  NEW_FILES:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: <AddCircleOutline sx={{ fontSize: 13 }} />, label: 'Needs files' },
  HIGHER_QUALITY: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  icon: <HighQuality sx={{ fontSize: 13 }} />,      label: 'Higher quality' },
  LOWER_QUALITY:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  icon: <MobileFriendly sx={{ fontSize: 13 }} />,   label: 'Lower quality' },
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

  return (
    <Box>
      <Typography variant="body2" sx={{ color: T.textMuted, mb: 2 }}>
        Users vote on titles they want added. Mark as fulfilled once media files are uploaded — voters get notified automatically.
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

      <TableContainer component={Paper} sx={{ bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2, boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textMuted, borderBottom: `1px solid ${T.glassBorder}` } }}>
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
                <TableRow key={r.id} hover sx={{ '& td': { borderBottom: `1px solid ${T.glassBorder}` } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Tooltip title="Open record">
                        <IconButton size="small" onClick={() => openRecord(r)} sx={{ color: T.teal }}>
                          <OpenInNew sx={{ fontSize: 16 }} />
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
                    <Chip
                      size="small"
                      icon={isMovie ? <Movie sx={{ fontSize: 13 }} /> : <LiveTv sx={{ fontSize: 13 }} />}
                      label={isMovie ? 'Movie' : 'TV'}
                      sx={{ height: 22, fontWeight: 600, bgcolor: 'transparent', border: `1px solid ${T.glassBorder}`, color: T.textMuted }}
                    />
                  </TableCell>
                  <TableCell>
                    <KindChip kind={r.kind} />
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
                    {r.status === 'PENDING' && (
                      <>
                        <Tooltip title="Mark fulfilled & notify voters">
                          <span>
                            <IconButton size="small" disabled={fulfillMut.isPending} onClick={() => fulfillMut.mutate(r.id)} sx={{ color: '#10b981' }}>
                              <CheckCircle sx={{ fontSize: 20 }} />
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
                    {r.status === 'FULFILLED' && (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                        {r.fulfilledByUsername && (
                          <Typography variant="caption" sx={{ color: T.textFaint }}>
                            by {r.fulfilledByUsername}
                          </Typography>
                        )}
                        <Tooltip title="Reopen (undo fulfill)">
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
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Dismiss request</DialogTitle>
        <DialogContent dividers>
          {dismissTarget && (
            <>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{dismissTarget.recordTitle}</strong>
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
