import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, Button, IconButton, Tabs, Tab } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useIpo, useGmpHistory, useSubscriptionHistory } from '../hooks/useIpo';
import { IPO_TYPE_LABEL, statusMeta } from '../utils/format';
import CompanyLogo from '../components/CompanyLogo';
import IpoDetailSkeleton from '../components/IpoDetailSkeleton';
import OverviewTab from '../components/OverviewTab';
import GmpTab from '../components/GmpTab';
import SubscriptionTab from '../components/SubscriptionTab';
import AllotmentTab from '../components/AllotmentTab';

const PAGE_SX = { pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 4 };

const TABS = [
  { value: 'overview', label: 'Overview', Icon: DashboardOutlinedIcon },
  { value: 'gmp', label: 'GMP', Icon: ShowChartIcon },
  { value: 'subscription', label: 'Subscription', Icon: PeopleAltOutlinedIcon },
  { value: 'allotment', label: 'Allotment', Icon: FactCheckOutlinedIcon },
];

export default function IpoDetailPage() {
  const T = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const backToList = () => navigate(Constants.DB_IPO_ROUTE);
  const [tab, setTab] = useState('overview');

  const { data: ipo, isLoading, isError } = useIpo(id);
  const { data: gmpPoints = [], isLoading: gmpLoading } = useGmpHistory(id);
  const { data: subPoints = [], isLoading: subLoading } = useSubscriptionHistory(id);

  if (isLoading) {
    return <IpoDetailSkeleton />;
  }

  if (isError || !ipo) {
    return (
      <Box sx={{
        ...PAGE_SX, color: T.textPrimary,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 1.5, minHeight: '50vh',
      }}>
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>IPO not found</Typography>
        <Typography sx={{ fontSize: 13, color: T.textMuted }}>
          It may have been removed, or the link is incorrect.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={backToList}
          sx={{ mt: 1, borderColor: T.teal, color: T.teal, '&:hover': { borderColor: T.tealHover, bgcolor: T.tealBg } }}
        >
          Back to IPO Tracker
        </Button>
      </Box>
    );
  }

  const meta = statusMeta(ipo.status, T);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Box sx={{ ...PAGE_SX, color: T.textPrimary, maxWidth: 1100, mx: 'auto' }}>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2 }}>
          <IconButton
            onClick={backToList}
            aria-label="Back to IPO Tracker"
            sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, mt: 0.25, flexShrink: 0 }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <CompanyLogo logoUrl={ipo.logoUrl} companyName={ipo.companyName} size={44} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: { xs: 18, sm: 21 }, fontWeight: 800, wordBreak: 'break-word' }}>
                {ipo.companyName}
              </Typography>
              <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: meta.bg, border: `1px solid ${meta.color}55`, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: meta.color }}>{meta.label}</Typography>
              </Box>
            </Box>
            <Chip
              label={IPO_TYPE_LABEL[ipo.ipoType] ?? ipo.ipoType ?? 'IPO'}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11, mt: 0.75, borderColor: T.border, color: T.textMuted }}
            />
          </Box>
        </Box>

        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="IPO detail sections"
          sx={{
            mb: 2, minHeight: 40, borderBottom: `1px solid ${T.border}`,
            '& .MuiTab-root': {
              minHeight: 44, fontSize: 12.5, fontWeight: 700, textTransform: 'none',
              color: T.textMuted, minWidth: 0, px: 1.5, gap: 0.5,
            },
            '& .Mui-selected': { color: `${T.teal} !important` },
            '& .MuiTabs-indicator': { bgcolor: T.teal, height: 2.5, borderRadius: 999 },
            '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 },
          }}
        >
          {TABS.map(({ value, label, Icon }) => (
            <Tab key={value} value={value} label={label} icon={<Icon sx={{ fontSize: 17 }} />} iconPosition="start" />
          ))}
        </Tabs>

        {tab === 'overview' && <OverviewTab ipo={ipo} id={id} />}
        {tab === 'gmp' && <GmpTab ipo={ipo} points={gmpPoints} loading={gmpLoading} />}
        {tab === 'subscription' && <SubscriptionTab ipo={ipo} points={subPoints} loading={subLoading} />}
        {tab === 'allotment' && <AllotmentTab ipo={ipo} />}
      </Box>
    </motion.div>
  );
}
