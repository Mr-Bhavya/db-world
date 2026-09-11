import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { AdminPage, SectionCard, AdminActionButton, adminSurface } from '@features/admin/adminUi';
import {
  useSourceHealth, useIpoChanges, useRepoll, useSendTestPush, usePushStatus,
  useIpoDuplicates, useMergeIpoDuplicates,
} from '../hooks/useIpoAdmin';

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

/**
 * One row inside a duplicate cluster. Shows everything needed to spot a FALSE positive before
 * approving a merge: both spellings, both stored match keys, both open dates, and how much data
 * each side actually holds — because a merge moves real users' "My IPOs" entries.
 */
function DuplicateRow({ T, S, row, survivor }) {
  return (
    <Box sx={{
      p: 1.25, borderRadius: 2, bgcolor: survivor ? T.successBg : S.inset,
      border: `1px solid ${survivor ? T.success : S.border}`,
      display: 'flex', flexDirection: 'column', gap: 0.4,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.text }}>{row.companyName}</Typography>
        <Typography sx={{
          fontSize: 10, fontWeight: 700, px: 0.8, borderRadius: 5,
          bgcolor: survivor ? T.success : S.card, color: survivor ? '#fff' : T.textFaint,
        }}>
          {survivor ? 'KEEPS' : 'MERGES AWAY'}
        </Typography>
      </Box>
      <Row label="match_key" value={row.matchKey ?? '—'} T={T} />
      <Row label="Open date" value={row.openDate ?? '—'} T={T} />
      <Row label="GMP" value={row.gmp != null ? `₹${row.gmp}` : '—'} T={T} />
      <Row label="Investorgain id" value={row.investorgainId != null ? String(row.investorgainId) : '—'} T={T} />
      <Row label="GMP history points" value={String(row.gmpHistoryPoints ?? 0)} T={T} />
      <Row label="User applications" value={String(row.userApplications ?? 0)} T={T} />
    </Box>
  );
}

/**
 * The duplicate review. Rendering the whole proposal before anything is applied is the point:
 * a company's SME issue and its later mainboard issue share a byte-identical name, so an
 * automatic merge could fuse two genuinely different issues and move someone's application onto
 * the wrong one. Every merge stays reversible — losers are tombstoned, never deleted.
 */
function DuplicatesSection({ T, S, clusters, loading, onMerge, merging }) {
  const totalRows = clusters.reduce((n, c) => n + 1 + (c.losers?.length ?? 0), 0);
  const applicationsAtRisk = clusters.reduce(
    (n, c) => n + (c.losers ?? []).reduce((m, l) => m + (l.userApplications ?? 0), 0), 0,
  );

  return (
    <SectionCard
      title={`Duplicate listings${clusters.length ? ` (${clusters.length})` : ''}`}
      action={clusters.length > 0 && (
        <AdminActionButton variant="primary" icon={MergeTypeIcon} onClick={() => onMerge(null)} loading={merging}>
          Merge all
        </AdminActionButton>
      )}
    >
      <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 2 }}>
        One company can become several rows: the stored key bakes in the open date and the feed&apos;s exact
        spelling, so a revised schedule or &quot;Co.&quot; against &quot;Company&quot; mints another row. The extra row shows
        as a second card with no GMP — and a duplicate pair looks ambiguous to the investorgain matcher,
        which then gives GMP to neither half. This is a dry run; nothing changes until you merge.
      </Typography>

      {loading ? (
        <Typography sx={{ color: T.textMuted, fontSize: 13 }}>Loading…</Typography>
      ) : clusters.length === 0 ? (
        <Typography sx={{ color: T.success, fontSize: 13, fontWeight: 600 }}>
          No duplicates — every tracked company resolves to exactly one row.
        </Typography>
      ) : (
        <>
          <Typography sx={{ fontSize: 12, color: T.warning, mb: 2, fontWeight: 600 }}>
            {totalRows} rows across {clusters.length} companies · {applicationsAtRisk} user application(s)
            would be moved onto the surviving row.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {clusters.map((c) => (
              <Box key={c.aliasKey} sx={{
                p: 1.5, borderRadius: 3, bgcolor: S.card, border: `1px solid ${S.border}`,
                display: 'flex', flexDirection: 'column', gap: 1,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontSize: 11, color: T.textFaint, fontFamily: 'monospace' }}>
                    {c.aliasKey}
                  </Typography>
                  <AdminActionButton
                    variant="secondary"
                    icon={MergeTypeIcon}
                    onClick={() => onMerge([c.aliasKey])}
                    loading={merging}
                  >
                    Merge
                  </AdminActionButton>
                </Box>
                <Box sx={{
                  display: 'grid', gap: 1,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(260px, 1fr))' },
                }}>
                  <DuplicateRow T={T} S={S} row={c.survivor} survivor />
                  {(c.losers ?? []).map((l) => <DuplicateRow key={l.id} T={T} S={S} row={l} survivor={false} />)}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </SectionCard>
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
  const { data: duplicates = [], isLoading: duplicatesLoading, refetch: refetchDuplicates } = useIpoDuplicates();
  const mergeDuplicates = useMergeIpoDuplicates();

  const handleRefresh = () => { refetchSources(); refetchChanges(); refetchDuplicates(); };

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

      <Box sx={{ mb: 3 }}>
        <DuplicatesSection
          T={T}
          S={S}
          clusters={duplicates}
          loading={duplicatesLoading}
          merging={mergeDuplicates.isPending}
          onMerge={(aliasKeys) => mergeDuplicates.mutate(aliasKeys)}
        />
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
