import { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButton, ToggleButtonGroup, Avatar,
} from '@mui/material';
import {
  CheckCircle, Cancel, NotificationsActive, Movie, LiveTv,
  HourglassEmpty, DoneAll, Block, OpenInNew, Restore,
  HighQuality, MobileFriendly, AddCircleOutline,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import {
  fetchAdminMediaRequests, fulfillMediaRequest, dismissMediaRequest, reopenMediaRequest,
} from '@features/cinema/api/cinemaApi';

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
  const { enqueueSnackbar } = useSnackbar();
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
      enqueueSnackbar('Request fulfilled — voters notified.', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Could not fulfill request.', { variant: 'error' }),
  });

  const dismissMut = useMutation({
    mutationFn: dismissMediaRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-media-requests'] });
      enqueueSnackbar('Request dismissed.', { variant: 'info' });
    },
    onError: () => enqueueSnackbar('Could not dismiss request.', { variant: 'error' }),
  });

  const reopenMut = useMutation({
    mutationFn: reopenMediaRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-media-requests'] });
      enqueueSnackbar('Request reopened — back to pending.', { variant: 'info' });
    },
    onError: () => enqueueSnackbar('Could not reopen request.', { variant: 'error' }),
  });

  const openRecord = (req) => {
    const isMovie = req.recordType === 'MOVIE';
    const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    const slug = (req.recordTitle ?? '').replace(/\s+/g, '-').toLowerCase();
    navigate(base.replace(':title', `${req.recordId}-${slug}`));
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <NotificationsActive sx={{ color: T.teal, fontSize: 26 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: T.text, letterSpacing: '-0.01em' }}>
          Media Requests
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: T.textMuted, mb: 3 }}>
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
                      <Typography variant="body2" sx={{ fontWeight: 600, color: T.text }}>
                        {r.recordTitle}
                      </Typography>
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
                        <Tooltip title="Mark fulfilled & notify voters">
                          <span>
                            <IconButton size="small" disabled={fulfillMut.isPending} onClick={() => fulfillMut.mutate(r.id)} sx={{ color: '#10b981' }}>
                              <CheckCircle sx={{ fontSize: 20 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Dismiss">
                          <span>
                            <IconButton size="small" disabled={dismissMut.isPending} onClick={() => dismissMut.mutate(r.id)} sx={{ color: T.textMuted }}>
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
    </Box>
  );
}
