import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { useT } from '@shared/theme';
import { formatCurrency, formatPct, expectedListingPrice } from '../utils/format';
import SectionCard from './SectionCard';
import { FactGrid } from './FactTile';

/**
 * True when there is anything at all to say about the grey market beyond the premium itself.
 * Every field is independently optional, so the section only appears once at least one exists.
 */
export const hasGreyMarketRead = (ipo, points = []) => !!ipo && (
  ipo.gmpRating != null || ipo.gmpMin != null || ipo.gmpMax != null || ipo.peRatio != null
  || ipo.anchorInvestor != null || ipo.estimatedListingPrice != null
  || ipo.subjectToSauda != null || ipo.estProfit != null
  || (ipo.priceMax != null && (ipo.gmp != null || points.length > 0))
);

/**
 * The grey market, in one place.
 *
 * This used to be two sections on two different tabs: "Expected listing price" on the GMP tab and
 * "Live market read" on the Overview. Between them — and the hero's own "Est. listing ₹749"
 * footnote — the same estimated listing price was printed three times on one page, and
 * investorgain's P/E landed on the Overview immediately under the prospectus's own P/E from a
 * different source, reading as a contradiction rather than as two sources. Everything
 * grey-market now lives on the GMP tab, once, attributed once.
 *
 * Every value is shown EXACTLY as investorgain publishes it — they compute the estimated listing
 * price (cap + GMP), the percentage and the per-lot profit themselves, so nothing here is our
 * arithmetic. `expectedListingPrice` remains as the fallback for an IPO whose per-IPO estimate
 * fetch hasn't landed yet, and says so.
 */
export default function GreyMarketRead({ ipo, points = [] }) {
  const T = useT();

  // Prefer investorgain's own reported estimate; fall back to cap + latest GMP, computed here and
  // labelled as such so a derived number never passes itself off as a reported one.
  const latestGmp = ipo.gmp ?? (points.length ? points[points.length - 1].gmp : null);
  const reported = ipo.estimatedListingPrice != null && ipo.gmpPct != null
    ? { price: ipo.estimatedListingPrice, gainPct: ipo.gmpPct, reported: true }
    : null;
  const estimate = reported ?? expectedListingPrice(ipo.priceMax, latestGmp);

  const facts = [];
  if (estimate) {
    const gainColor = estimate.gainPct > 0 ? T.success : estimate.gainPct < 0 ? T.error : T.textMuted;
    facts.push({
      key: 'est',
      icon: TrendingUpOutlinedIcon,
      label: 'Est. listing price',
      value: `${formatCurrency(estimate.price)} (${formatPct(estimate.gainPct)})`,
      valueColor: gainColor,
    });
  }
  if (ipo.gmpRating != null) {
    facts.push({ key: 'rating', icon: LocalFireDepartmentOutlinedIcon, label: 'GMP rating', value: `${ipo.gmpRating}/5` });
  }
  if (ipo.gmpMin != null && ipo.gmpMax != null) {
    facts.push({
      key: 'range',
      icon: SwapVertOutlinedIcon,
      label: 'GMP range',
      value: `${formatCurrency(ipo.gmpMin)} – ${formatCurrency(ipo.gmpMax)}`,
    });
  }
  if (ipo.estProfit != null) {
    facts.push({ key: 'profit', icon: SavingsOutlinedIcon, label: 'Est. profit / lot', value: formatCurrency(ipo.estProfit) });
  }
  if (ipo.subjectToSauda != null) {
    facts.push({ key: 'sauda', icon: HandshakeOutlinedIcon, label: 'Subject to sauda', value: formatCurrency(ipo.subjectToSauda) });
  }
  if (ipo.peRatio != null) {
    facts.push({ key: 'pe', icon: QueryStatsOutlinedIcon, label: 'P/E ratio', value: String(ipo.peRatio) });
  }
  if (ipo.anchorInvestor != null) {
    facts.push({
      key: 'anchor',
      icon: AccountBalanceWalletOutlinedIcon,
      label: 'Anchor investors',
      value: ipo.anchorInvestor ? 'Yes' : 'No',
    });
  }
  if (facts.length === 0) return null;

  // Investorgain's own "as of" wording, carried through verbatim, so a stale number reads as stale
  // instead of looking live.
  const asOf = [
    ipo.gmpUpdatedLabel && `GMP as of ${ipo.gmpUpdatedLabel}`,
    ipo.subscriptionUpdatedLabel && `subscription as of ${ipo.subscriptionUpdatedLabel}`,
  ].filter(Boolean).join(' · ');

  const attribution = estimate && !estimate.reported
    ? `Estimated listing price is the upper band ${formatCurrency(ipo.priceMax)} plus the latest GMP; the rest is reported by Investorgain`
    : 'Reported by Investorgain';

  return (
    <SectionCard
      title="Grey market read"
      subtitle={asOf ? `${attribution} — ${asOf}.` : `${attribution}.`}
      icon={<LocalFireDepartmentOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
    >
      <FactGrid facts={facts} />
    </SectionCard>
  );
}
