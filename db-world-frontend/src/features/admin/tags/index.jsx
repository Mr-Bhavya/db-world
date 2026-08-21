import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import LocalOfferIcon        from '@mui/icons-material/SellRounded';
import { useT } from '@shared/theme';
import { AdminPage, adminSurface } from '@features/admin/adminUi';
import TagsTab from './TagsTab';
import RailsTab from './RailsTab';

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TagsAndRailsPage() {
  const T             = useT();
  const S             = adminSurface(T);
  const [tab, setTab] = useState(0);

  return (
    <AdminPage
      title="Tags & Rails"
      subtitle="Smart content tags and homepage rails"
      icon={LocalOfferIcon}
    >
      <Tabs value={tab} onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, minHeight: 44, borderBottom: `1px solid ${S.border}`,
          '& .MuiTab-root': { fontSize: 13, fontWeight: 600, color: T.textMuted, textTransform: 'none', minHeight: 44, px: 2 },
          '& .Mui-selected': { color: `${T.teal} !important` },
          '& .MuiTabs-indicator': { bgcolor: T.teal, height: 2 } }}>
        <Tab label="Tag Management" />
        <Tab label="Rails" />
      </Tabs>

      {tab === 0 && <TagsTab />}
      {tab === 1 && <RailsTab />}
    </AdminPage>
  );
}
