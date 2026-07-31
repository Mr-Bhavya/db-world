import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { AdminPage, SectionCard, AdminActionButton, adminSurface } from '@features/admin/adminUi';
import { useSourceHealth, useIpoChanges, useRepoll, useSendTestPush, usePushStatus } from '../hooks/useIpoAdmin';

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
function healthTier(row, T, S) {
  if (!row.lastPolledAt) {
    return { label: 'Never polled', color: T.textFaint, bg: S.inset, Icon: HelpOutlineIcon };
  }
  if (row.consecutiveFailures === 0 && row.lastStatus === 'OK') {
    return { label: 'Healthy', color: T.success, bg: T.successBg, Icon: CheckCircleIcon };
  }
  if (row.consecutiveFailures <= 2) {
    return { label: 'Warning', color: T.warning, bg: T.warningBg, Icon: ErrorIcon };
  }
  return { label: 'Failing', color: T.error, bg: T.errorBg, Icon: ErrorIcon };
}

function SourceHealthCard({ T, S, row }) {
  const tier = healthTier(row, T, S);
  const label = SOURCE_LABEL[row.source] ?? row.source;
  return (
    <Box sx={{
      bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3, p: 2,
      display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</Typography>
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
  const S = adminSurface(T);
  const navigate = useNavigate();
  const { data: sources = [], isLoading: sourcesLoading, refetch: refetchSources } = useSourceHealth();
  const { data: changes = [], isLoading: changesLoading, refetch: refetchChanges } = useIpoChanges();
  const repollMutation = useRepoll();
  const testPush = useSendTestPush();
  const { data: pushStatus } = usePushStatus();

  const handleRefresh = () => { refetchSources(); refetchChanges(); };

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
    <AdminPage
      title="IPO Tracker"
      subtitle="Source health, recent change feed and push diagnostics for the IPO pipeline."
      icon={CandlestickChartRoundedIcon}
      onRefresh={handleRefresh}
      refreshing={sourcesLoading || changesLoading}
      actions={
        <>
          <AdminActionButton
            variant="secondary"
            icon={NotificationsActiveIcon}
            onClick={() => testPush.mutate({})}
            loading={testPush.isPending}
          >
            Send test push
          </AdminActionButton>
          <AdminActionButton
            variant="primary"
            icon={RefreshIcon}
            onClick={() => repollMutation.mutate()}
            loading={repollMutation.isPending}
          >
            Re-poll now
          </AdminActionButton>
        </>
      }
    >
      {/* Meta: scheduler hint + push diagnostics */}
      <Typography
        onClick={() => navigate(Constants.DB_ADMIN_SCHEDULER_ROUTE)}
        sx={{ fontSize: 12, color: T.textFaint, mb: 1, cursor: 'pointer', width: 'fit-content', '&:hover': { color: T.teal } }}
      >
        Adjust the poll schedule on the Scheduler page →
      </Typography>

      {pushStatus && (
        <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 3 }}>
          Push: {pushStatus.enabled ? 'enabled' : 'disabled'} · transport{' '}
          {pushStatus.transportReady ? 'ready (FCM)' : 'not ready'} · topic {pushStatus.topic}
          {' '}— reaches only devices that enabled notifications.
        </Typography>
      )}

      <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        Source health
      </Typography>
      <Box sx={{
        display: 'grid', gap: 2, mb: 3,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(240px, 1fr))' },
      }}>
        {sourcesLoading && sources.length === 0 ? (
          <Typography sx={{ color: T.textMuted, fontSize: 13 }}>Loading…</Typography>
        ) : sources.length === 0 ? (
          <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No sources polled yet.</Typography>
        ) : (
          sources.map((row) => <SourceHealthCard key={row.source} T={T} S={S} row={row} />)
        )}
      </Box>

      <SectionCard title="Recent changes" padding={false}>
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
              sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: S.inset } }}
            />
          </Box>
        </Box>
      </SectionCard>
    </AdminPage>
  );
}
