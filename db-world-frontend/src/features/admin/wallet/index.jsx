import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { WalletRounded } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { AdminPage, SectionCard, useSwipeNav } from '@features/admin/adminUi';
import DocumentTypesTab from './DocumentTypesTab';
import MonitorTab from './MonitorTab';

const TABS = [
  { label: 'Document Types' },
  { label: 'Monitor' },
];

export default function WalletAdminPage() {
  const T = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const swipe = useSwipeNav({
    onPrev: () => setTab((t) => Math.max(0, t - 1)),
    onNext: () => setTab((t) => Math.min(TABS.length - 1, t + 1)),
  });

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['wallet-admin'] });
    qc.invalidateQueries({ queryKey: ['app-config'] });
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <AdminPage
      title="Document Wallet"
      subtitle="Manage the document types users can store, and monitor wallet storage usage."
      icon={WalletRounded}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      <SectionCard padding={false} sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
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
          {TABS.map((t) => <Tab key={t.label} label={t.label} />)}
        </Tabs>
      </SectionCard>

      <Box {...swipe}>
        {tab === 0 ? <DocumentTypesTab /> : <MonitorTab />}
      </Box>
    </AdminPage>
  );
}
