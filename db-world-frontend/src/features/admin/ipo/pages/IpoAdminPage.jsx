import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useSourceHealth, useIpoChanges, useRepoll } from '../hooks/useIpoAdmin';

const SOURCE_LABEL = {
  ipoguru: 'IPO Guru',
  nse: 'NSE',
  chittorgarh: 'Chittorgarh',
};

const fmtIst = (iso) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(iso));
  } catch { return '—'; }
};

/** Health tier for a source row: never polled (unknown) / healthy / warning (a few failures) / failing. */
function healthTier(row, T) {
  if (!row.lastPolledAt) {
    return { label: 'Never polled', color: T.textFaint, bg: T.glassHover, Icon: HelpOutlineIcon };
  }
  if (row.consecutiveFailures === 0 && row.lastStatus === 'OK') {
    return { label: 'Healthy', color: T.success, bg: T.successBg, Icon: CheckCircleIcon };
  }
  if (row.consecutiveFailures <= 2) {
    return { label: 'Warning', color: T.warning, bg: T.warningBg, Icon: ErrorIcon };
  }
  return { label: 'Failing', color: T.error, bg: T.errorBg, Icon: ErrorIcon };
}

function SourceHealthCard({ T, row }) {
  const tier = healthTier(row, T);
  const label = SOURCE_LABEL[row.source] ?? row.source;
  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2,
      flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{label}</Typography>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.25, borderRadius: 5,
          bgcolor: tier.bg, color: tier.color,
        }}>
          <tier.Icon sx={{ fontSize: 13 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{tier.label}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
        <Row label="Last polled" value={fmtIst(row.lastPolledAt)} T={T} />
        <Row label="Last success" value={fmtIst(row.lastSuccessAt)} T={T} />
        <Row label="Last status" value={row.lastStatus ?? '—'} T={T} />
        <Row label="Consecutive failures" value={String(row.consecutiveFailures ?? 0)} T={T} />
      </Box>
    </Box>
  );
}

function Row({ label, value, T }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

export default function IpoAdminPage() {
  const T = useT();
  const navigate = useNavigate();
  const { data: sources = [], isLoading: sourcesLoading } = useSourceHealth();
  const { data: changes = [], isLoading: changesLoading } = useIpoChanges();
  const repollMutation = useRepoll();

  const columns = [
    {
      field: 'createdAt', headerName: 'Time (IST)', width: 190, sortable: true,
      renderCell: (p) => fmtIst(p.value),
    },
    { field: 'eventType', headerName: 'Event', width: 160 },
    { field: 'ipoId', headerName: 'IPO', width: 220 },
    {
      field: 'change', headerName: 'Change', flex: 1, minWidth: 220, sortable: false,
      renderCell: (p) => `${p.row.oldValue ?? '—'} → ${p.row.newValue ?? '—'}`,
    },
  ];

  const rows = changes.map((c, i) => ({ id: `${c.ipoId}-${c.eventType}-${c.createdAt}-${i}`, ...c }));

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, color: T.textPrimary }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800 }}>IPO Tracker</Typography>
        <Button
          variant="contained"
          startIcon={repollMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
          disabled={repollMutation.isPending}
          onClick={() => repollMutation.mutate()}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
        >
          {repollMutation.isPending ? 'Re-polling…' : 'Re-poll now'}
        </Button>
      </Box>

      <Typography
        onClick={() => navigate(Constants.DB_ADMIN_SCHEDULER_ROUTE)}
        sx={{ fontSize: 12, color: T.textFaint, mb: 2, cursor: 'pointer', width: 'fit-content', '&:hover': { color: T.teal } }}
      >
        Adjust the poll schedule on the Scheduler page →
      </Typography>

      <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        Source health
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        {sourcesLoading && sources.length === 0 ? (
          <Typography sx={{ color: T.textMuted, fontSize: 13 }}>Loading…</Typography>
        ) : sources.length === 0 ? (
          <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No sources polled yet.</Typography>
        ) : (
          sources.map((row) => <SourceHealthCard key={row.source} T={T} row={row} />)
        )}
      </Box>

      <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        Recent changes
      </Typography>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Box sx={{ height: 480, minWidth: 640 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={changesLoading}
            disableRowSelectionOnClick
            density="compact"
            initialState={{
              sorting: { sortModel: [{ field: 'createdAt', sort: 'desc' }] },
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[25, 50, 100]}
          />
        </Box>
      </Box>
    </Box>
  );
}
