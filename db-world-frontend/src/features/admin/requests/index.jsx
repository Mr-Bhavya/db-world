import { useEffect, useState } from 'react';
import {
  Box, Tab, Tabs, Typography, Chip,
} from '@mui/material';
import { Inbox } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useT } from '@shared/theme';
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
  const [params, setParams] = useSearchParams();
  const initialTab = TABS.find(t => t.key === params.get('tab'))?.key ?? 'media';
  const [tab, setTab] = useState(initialTab);

  // Keep ?tab= in sync so the chosen tab survives a refresh / shared link.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (next.get('tab') !== tab) {
      next.set('tab', tab);
      setParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Inbox sx={{ color: T.teal, fontSize: 26 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: T.text, letterSpacing: '-0.01em' }}>
          Requests
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: T.textMuted, mb: 2 }}>
        Everything users have asked for, in one place. Switch between media-file
        requests (existing catalog) and catalog ingest requests (titles not yet
        in the catalog).
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          borderBottom: `1px solid ${T.glassBorder}`,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 44 },
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

      {tab === 'media' && <MediaRequestsPanel />}
      {tab === 'catalog' && <CatalogRequestsPanel />}
    </Box>
  );
}
