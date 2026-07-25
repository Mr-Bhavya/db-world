import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, Skeleton, Button, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarTodayOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { useIpo, useGmpHistory, useSubscriptionHistory } from '../hooks/useIpo';
import {
  formatShortDate, formatPriceBand, formatCurrency, formatPct, formatMultiplier,
  IPO_TYPE_LABEL, statusMeta,
} from '../utils/format';
import GmpChart from '../components/GmpChart';
import SubscriptionChart from '../components/SubscriptionChart';
import IpoGuruAttribution from '../components/IpoGuruAttribution';

const FALLBACK_ALLOTMENT_URL = 'https://www.bseindia.com/investors/appli_check.aspx';
const PAGE_SX = { pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 4 };

export default function IpoDetailPage() {
  const T = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const backToList = () => navigate(Constants.DB_IPO_ROUTE);

  const { data: ipo, isLoading, isError } = useIpo(id);
  const { data: gmpPoints = [], isLoading: gmpLoading } = useGmpHistory(id);
  const { data: subPoints = [], isLoading: subLoading } = useSubscriptionHistory(id);

  if (isLoading) {
    return (
      <Box sx={{ ...PAGE_SX, color: T.textPrimary, maxWidth: 1100, mx: 'auto' }}>
        <Skeleton variant="text" width={220} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={90} sx={{ mb: 2, bgcolor: T.glass }} />
        <Skeleton variant="rounded" height={110} sx={{ mb: 2, bgcolor: T.glass }} />
        <Skeleton variant="rounded" height={280} sx={{ mb: 2, bgcolor: T.glass }} />
        <Skeleton variant="rounded" height={280} sx={{ bgcolor: T.glass }} />
      </Box>
    );
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
  const latestSub = subPoints.length ? subPoints[subPoints.length - 1] : null;
  const registrarHref = ipo.registrarUrl || FALLBACK_ALLOTMENT_URL;
  const gainColor = ipo.listingGainPct > 0 ? T.success : ipo.listingGainPct < 0 ? T.error : undefined;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Box sx={{ ...PAGE_SX, color: T.textPrimary, maxWidth: 1100, mx: 'auto' }}>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2.5 }}>
          <IconButton
            onClick={backToList}
            aria-label="Back to IPO Tracker"
            sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, mt: 0.25, flexShrink: 0 }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: { xs: 19, sm: 22 }, fontWeight: 800, wordBreak: 'break-word' }}>
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

        <SectionCard title="Timeline">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <DateChip label="Opens" value={formatShortDate(ipo.openDate)} />
            <DateChip label="Closes" value={formatShortDate(ipo.closeDate)} />
            <DateChip label="Allotment" value={formatShortDate(ipo.allotmentDate)} />
            <DateChip label="Listing" value={formatShortDate(ipo.listingDate)} />
          </Box>
        </SectionCard>

        <SectionCard title="Issue details">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)' }, gap: 1.5 }}>
            <StatBlock label="Price band" value={formatPriceBand(ipo.priceMin, ipo.priceMax)} />
            <StatBlock label="Lot size" value={ipo.lotSize != null ? `${ipo.lotSize} shares` : null} />
            <StatBlock label="Issue size" value={ipo.issueSize ?? null} />
            {ipo.status === 'listed' && (
              <>
                <StatBlock label="Listing price" value={formatCurrency(ipo.listingPrice)} />
                <StatBlock label="Listing gain" value={formatPct(ipo.listingGainPct)} valueColor={gainColor} />
                <StatBlock label="Exchange" value={ipo.listingExchange} />
              </>
            )}
          </Box>
        </SectionCard>

        <SectionCard title="Subscription">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' }, gap: 1.5 }}>
            <StatBlock label="Total" value={formatMultiplier(ipo.subTotal ?? latestSub?.total)} highlight />
            <StatBlock label="QIB" value={formatMultiplier(latestSub?.qib)} />
            <StatBlock label="NII" value={formatMultiplier(latestSub?.nii)} />
            <StatBlock label="Retail" value={formatMultiplier(latestSub?.retail)} />
          </Box>
        </SectionCard>

        <Box sx={{ mb: 2 }}>
          <IpoGuruAttribution />
          <GmpChart points={gmpPoints} loading={gmpLoading} />
        </Box>

        <Box sx={{ mb: 2 }}>
          <SubscriptionChart points={subPoints} loading={subLoading} />
        </Box>

        <SectionCard title="Allotment" icon={<FactCheckOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, color: T.textFaint }}>Status</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, mt: 0.25 }}>
                {ipo.allotmentStatus ?? 'Not available yet'}
              </Typography>
              {ipo.registrar && (
                <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.5 }}>
                  Registrar: {ipo.registrar}
                </Typography>
              )}
            </Box>
            <Button
              variant="contained"
              endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
              component="a"
              href={registrarHref}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Check allotment
            </Button>
          </Box>
        </SectionCard>
      </Box>
    </motion.div>
  );
}

function SectionCard({ title, icon, children }) {
  const T = useT();
  return (
    <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, p: { xs: 1.5, sm: 2 }, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        {icon}
        <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

function DateChip({ label, value }) {
  const T = useT();
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, borderRadius: 2,
      bgcolor: value ? T.glassHover : T.glass, border: `1px solid ${T.border}`, opacity: value ? 1 : 0.55,
    }}>
      <CalendarTodayIcon sx={{ fontSize: 13, color: T.textFaint }} />
      <Box>
        <Typography sx={{ fontSize: 10, color: T.textFaint, lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textPrimary, lineHeight: 1.3 }}>
          {value ?? '—'}
        </Typography>
      </Box>
    </Box>
  );
}

function StatBlock({ label, value, highlight, valueColor }) {
  const T = useT();
  return (
    <Box sx={{
      p: 1.25, borderRadius: 2,
      bgcolor: highlight ? T.tealBg : 'transparent',
      border: highlight ? `1px solid ${T.teal}33` : 'none',
    }}>
      <Typography sx={{ fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: valueColor ?? T.textPrimary, mt: 0.25 }} noWrap>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}
