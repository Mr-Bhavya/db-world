import { useEffect, useState } from 'react';
import { Box, Tab, Tabs, Chip } from '@mui/material';
import { MoveToInboxRounded } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useT } from '@shared/theme';
import { AdminPage, SectionCard, useSwipeNav } from '@features/admin/adminUi';
import {
  fetchAdminMediaRequests,
  fetchAdminCatalogRequests,
} from '@features/cinema/api/cinemaApi';
import MediaRequestsPanel from '@features/admin/media-requests';
import CatalogRequestsPanel from '@features/admin/catalog-requests';

const TABS = [
  { key: 'media',   label: 'Media Files' },
  { key: 'catalog', label: 'New Titles' },
];

// Query key prefixes shared with the child panels + the pending badges — a
// refresh invalidates all of them so the visible panel and badges refetch.
const REQUEST_QUERY_KEYS = [
  'admin-media-requests', 'admin-catalog-requests', 'admin-requests-pending-count',
];

// Pending count badge rendered next to each tab label. Shares TanStack Query
// cache keys with the child panels so we don't double-fetch when the matching
// tab is also visible.
function PendingBadge({ count }) {
  const T = useT();
  if (count == null || count === 0) return null;
  return (
    <Chip
      label={count}
      size="small"
      sx={{
        ml: 1, height: 18, fontSize: 10, fontWeight: 700,
        bgcolor: `${T.teal}22`, color: T.teal,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

export default function RequestsAdminPage() {
  const T = useT();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const initialTab = TABS.find(t => t.key === params.get('tab'))?.key ?? 'media';
  const [tab, setTab] = useState(initialTab);
  const [refreshing, setRefreshing] = useState(false);

  // Keep ?tab= in sync so the chosen tab survives a refresh / shared link.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (next.get('tab') !== tab) {
      next.set('tab', tab);
      setParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabIdx = TABS.findIndex((t) => t.key === tab);
  const swipe = useSwipeNav({
    onPrev: () => setTab(TABS[Math.max(0, tabIdx - 1)].key),
    onNext: () => setTab(TABS[Math.min(TABS.length - 1, tabIdx + 1)].key),
  });

  const handleRefresh = () => {
    qc.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && REQUEST_QUERY_KEYS.includes(k);
      },
    });
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  // Pending counts — keys match what each panel uses for its own list query,
  // so React Query dedupes when the active panel is the same status.
  const { data: mediaPending = [] } = useQuery({
    queryKey: ['admin-media-requests', 'PENDING'],
    queryFn: () => fetchAdminMediaRequests('PENDING'),
    staleTime: 30_000,
  });
  const { data: catalogPending = [] } = useQuery({
    queryKey: ['admin-catalog-requests', 'PENDING'],
    queryFn: () => fetchAdminCatalogRequests('PENDING'),
    staleTime: 30_000,
  });

  return (
    <AdminPage
      title="Requests"
      subtitle="Media-file requests (existing catalog) and catalog ingest requests (titles not yet in the catalog), in one place."
      icon={MoveToInboxRounded}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      <SectionCard padding={false} sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: { xs: 44, sm: 48 },
            px: { xs: 0.5, sm: 1 },
            '& .MuiTab-root': {
              minHeight: { xs: 44, sm: 48 },
              textTransform: 'none',
              fontWeight: 700,
              color: T.textMuted,
            },
            '& .Mui-selected': { color: `${T.teal} !important` },
            '& .MuiTabs-indicator': { bgcolor: T.teal, height: 2 },
          }}
        >
          <Tab
            value="media"
            label={
              <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                Media Files
                <PendingBadge count={mediaPending.length} />
              </Box>
            }
          />
          <Tab
            value="catalog"
            label={
              <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                New Titles
                <PendingBadge count={catalogPending.length} />
              </Box>
            }
          />
        </Tabs>
      </SectionCard>

      <Box {...swipe}>
        {tab === 'media' && <MediaRequestsPanel />}
        {tab === 'catalog' && <CatalogRequestsPanel />}
      </Box>
    </AdminPage>
  );
}
