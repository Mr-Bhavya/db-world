import { Box, Typography } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import PriceCheckOutlinedIcon from '@mui/icons-material/PriceCheckOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useT } from '@shared/theme';
import { formatPriceBand, formatCurrency, formatPct, formatMultiplier, formatExchange } from '../utils/format';
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
  // Direction follows gmpPct when it's present (it's the more meaningful signal — gmp
  // itself can be legitimately 0 while the % is still nonzero), falling back to gmp
  // only when there's no gmpPct at all. Prevents `(gmp ?? gmpPct)` from silently
  // keeping a 0 gmp and reading "flat" when gmpPct clearly isn't.
  const signal = gmpPct ?? gmp;
  const positive = signal > 0;
  const negative = signal < 0;
  const color = positive ? T.success : negative ? T.error : T.textMuted;
  const Icon = positive ? TrendingUpIcon : negative ? TrendingDownIcon : TrendingFlatIcon;
  const value = `${gmp != null ? `₹${gmp}` : '—'}${gmpPct != null ? ` (${formatPct(gmpPct)})` : ''}`;
  return <FactTile icon={Icon} label="GMP" value={value} valueColor={color} />;
}

/** Listing gain fact tile — same up/down/flat color treatment as `GmpFactTile`, for the
 * post-listing gain % vs. the issue price. Only ever rendered when `gainPct` is non-null
 * (see call site), so no null-guard needed here. */
function ListingGainFactTile({ gainPct }) {
  const T = useT();
  const positive = gainPct > 0;
  const negative = gainPct < 0;
  const color = positive ? T.success : negative ? T.error : T.textMuted;
  const Icon = positive ? TrendingUpIcon : negative ? TrendingDownIcon : TrendingFlatIcon;
  return <FactTile icon={Icon} label="Listing gain" value={formatPct(gainPct)} valueColor={color} />;
}

/**
 * Overview tab — the at-a-glance summary: timeline stepper, a compact "key facts" grid,
 * About (only when present), and a financials snapshot. The full GMP/subscription charts
 * live on their own tabs now — this reads as a summary, not a data dump.
 */
export default function OverviewTab({ ipo, id }) {
  const T = useT();
  return (
    <Box>
      <SectionCard title="Timeline">
        <IpoTimeline ipo={ipo} />
      </SectionCard>

      <SectionCard title="Key facts" icon={<ListAltOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)' },
          gap: 2,
        }}>
          <FactTile icon={CurrencyRupeeOutlinedIcon} label="Price band" value={formatPriceBand(ipo.priceMin, ipo.priceMax)} />
          <FactTile icon={Inventory2OutlinedIcon} label="Lot size" value={ipo.lotSize != null ? `${ipo.lotSize} shares` : null} />
          <FactTile icon={AccountBalanceWalletOutlinedIcon} label="Issue size" value={ipo.issueSize} />
          <FactTile icon={StorefrontOutlinedIcon} label="Exchange" value={formatExchange(ipo.listingExchange)} />
          {ipo.faceValue != null && (
            <FactTile icon={SellOutlinedIcon} label="Face value" value={formatCurrency(ipo.faceValue)} />
          )}
          {ipo.freshIssue != null && (
            <FactTile icon={AddCircleOutlineIcon} label="Fresh issue" value={`${formatCurrency(ipo.freshIssue)} Cr`} />
          )}
          {ipo.offerForSale != null && (
            <FactTile icon={SwapHorizOutlinedIcon} label="Offer for sale" value={`${formatCurrency(ipo.offerForSale)} Cr`} />
          )}
          {ipo.listingPrice != null && (
            <FactTile icon={PriceCheckOutlinedIcon} label="Listing price" value={formatCurrency(ipo.listingPrice)} />
          )}
          {ipo.listingGainPct != null && <ListingGainFactTile gainPct={ipo.listingGainPct} />}
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
