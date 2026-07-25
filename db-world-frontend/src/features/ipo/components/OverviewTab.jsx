import { Box, Typography } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useT } from '@shared/theme';
import { formatPriceBand, formatPct, formatMultiplier, buildTimelineStages } from '../utils/format';
import IpoTimeline from './IpoTimeline';
import SectionCard from './SectionCard';
import FinancialsTable from './FinancialsTable';

/** One compact stat tile in the "key facts" grid — icon + label + value, null-safe
 * (falls back to an em dash rather than hiding the tile, so the grid never reflows). */
function FactTile({ icon: Icon, label, value, valueColor }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
      <Box sx={{
        width: 30, height: 30, borderRadius: 2, flexShrink: 0, mt: 0.1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: T.tealBg,
      }}>
        <Icon sx={{ fontSize: 16, color: T.teal }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: valueColor ?? T.textPrimary, mt: 0.15 }} noWrap>
          {value ?? '—'}
        </Typography>
      </Box>
    </Box>
  );
}

/** GMP fact tile needs its own up/down/flat treatment (color + arrow), unlike the other
 * plain tiles — mirrors the same convention IpoCard's GmpValue uses on the list page. */
function GmpFactTile({ gmp, gmpPct }) {
  const T = useT();
  if (gmp == null && gmpPct == null) {
    return <FactTile icon={TrendingFlatIcon} label="GMP" value={null} />;
  }
  const positive = (gmp ?? gmpPct) > 0;
  const negative = (gmp ?? gmpPct) < 0;
  const color = positive ? T.success : negative ? T.error : T.textMuted;
  const Icon = positive ? TrendingUpIcon : negative ? TrendingDownIcon : TrendingFlatIcon;
  const value = `${gmp != null ? `₹${gmp}` : '—'}${gmpPct != null ? ` (${formatPct(gmpPct)})` : ''}`;
  return <FactTile icon={Icon} label="GMP" value={value} valueColor={color} />;
}

/**
 * Overview tab — the at-a-glance summary: timeline stepper, a compact "key facts" grid,
 * About (only when present), and a financials snapshot. The full GMP/subscription charts
 * live on their own tabs now — this reads as a summary, not a data dump.
 */
export default function OverviewTab({ ipo, id }) {
  const T = useT();
  const hasTimeline = buildTimelineStages(ipo).length > 0;
  return (
    <Box>
      {hasTimeline && (
        <SectionCard title="Timeline">
          <IpoTimeline ipo={ipo} />
        </SectionCard>
      )}

      <SectionCard title="Key facts" icon={<ListAltOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)' },
          gap: 2,
        }}>
          <FactTile icon={CurrencyRupeeOutlinedIcon} label="Price band" value={formatPriceBand(ipo.priceMin, ipo.priceMax)} />
          <FactTile icon={Inventory2OutlinedIcon} label="Lot size" value={ipo.lotSize != null ? `${ipo.lotSize} shares` : null} />
          <FactTile icon={AccountBalanceWalletOutlinedIcon} label="Issue size" value={ipo.issueSize} />
          <FactTile icon={StorefrontOutlinedIcon} label="Exchange" value={ipo.listingExchange} />
          <GmpFactTile gmp={ipo.gmp} gmpPct={ipo.gmpPct} />
          <FactTile icon={PeopleAltOutlinedIcon} label="Subscription" value={formatMultiplier(ipo.subTotal)} />
          <FactTile icon={DomainOutlinedIcon} label="Registrar" value={ipo.registrar} />
        </Box>
      </SectionCard>

      {ipo.about && (
        <SectionCard title="About" icon={<InfoOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          <Typography sx={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7 }}>
            {ipo.about}
          </Typography>
        </SectionCard>
      )}

      <FinancialsTable id={id} />
    </Box>
  );
}
