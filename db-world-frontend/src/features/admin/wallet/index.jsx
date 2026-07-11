import { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import DocumentTypesTab from './DocumentTypesTab';
import MonitorTab from './MonitorTab';

export default function WalletAdminPage() {
  const T = useT();
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, color: T.textPrimary }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 1 }}>Document Wallet</Typography>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab label="Document Types" />
        <Tab label="Monitor" />
      </Tabs>
      {tab === 0 ? <DocumentTypesTab /> : <MonitorTab />}
    </Box>
  );
}
