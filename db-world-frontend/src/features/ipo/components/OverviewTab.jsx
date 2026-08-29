import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
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
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { useT } from '@shared/theme';
import {
  formatPriceBand, formatCurrency, formatPct, formatMultiplier, formatExchange, websiteDomain,
  formatAmount, computeLotBreakdown, minInvestment, detailFigures,
} from '../utils/format';
import IpoTimeline from './IpoTimeline';
import SectionCard, { SectionStack } from './SectionCard';
import { FactGrid } from './FactTile';
import FinancialsTable from './FinancialsTable';
import StrengthsRisks from './StrengthsRisks';

/** Up/down/flat treatment for a signed figure (GMP, listing gain) — the same colour + arrow
 * convention the list card and the detail hero use, so a premium reads alike everywhere. */
function signedMeta(signal, T) {
  const positive = signal > 0;
  const negative = signal < 0;
  return {
    color: positive ? T.success : negative ? T.error : T.textMuted,
    Icon: positive ? TrendingUpIcon : negative ? TrendingDownIcon : TrendingFlatIcon,
  };
}

/** The About section's Website fact renders as an external link rather than plain text —
 * `target="_blank" rel="noopener noreferrer"` (new tab, no opener leak/referrer), showing
 * just the bare domain via `websiteDomain()`. A source can report a website with no scheme
 * at all (e.g. "paytm.com") — used as-is, that reads as a RELATIVE href and navigates
 * within the app instead of out to the company site, so an "https://" prefix is added
 * for the href specifically whenever one isn't already there; the displayed text stays the
 * bare domain either way. Null-safe — renders nothing for a blank/missing website. */
function WebsiteLink({ website }) {
  const T = useT();
  if (!website) return null;
  const href = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{ color: T.teal, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
    >
      {websiteDomain(website) ?? website}
    </Box>
  );
}

/**
 * Builds the "Key facts" grid for one IPO.
 *
 * Three rules, all borrowed from the list redesign:
 *   1. A fact is only built when its value exists, so the grid can never render a hole. The old
 *      version rendered a fixed set of tiles and printed "—" for whatever the stage didn't have,
 *      which on an upcoming IPO meant an empty Subscription, an empty GMP and an empty Exchange.
 *   2. Anything the hero already leads with is dropped here rather than repeated 200px lower —
 *      `heroKeys` comes straight from `detailFigures`, so the two can't disagree about what has
 *      already been said.
 *   3. A fact that merely restates another is dropped too: a fresh issue equal to the issue size
 *      (an issue with no offer-for-sale component, which is common) was printing the same crore
 *      figure into two adjacent tiles.
 */
function keyFacts(ipo, T, heroKeys) {
  const facts = [];
  const add = (key, icon, label, value, valueColor) => {
    if (value == null || value === '' || heroKeys.includes(key)) return;
    facts.push({ key, icon, label, value, valueColor });
  };

  add('priceBand', CurrencyRupeeOutlinedIcon, 'Price band', formatPriceBand(ipo.priceMin, ipo.priceMax));
  add('lotSize', Inventory2OutlinedIcon, 'Lot size', ipo.lotSize != null ? `${ipo.lotSize} shares` : null);
  add('minInvestment', SavingsOutlinedIcon, 'Min. investment', formatAmount(minInvestment(ipo.lotSize, ipo.priceMax)));
  add('issueSize', AccountBalanceWalletOutlinedIcon, 'Issue size', ipo.issueSize);
  // `formatExchange` prints an em dash for a missing exchange, so gate on the raw field instead.
  add('exchange', StorefrontOutlinedIcon, 'Exchange', ipo.listingExchange ? formatExchange(ipo.listingExchange) : null);
  add('faceValue', SellOutlinedIcon, 'Face value', formatCurrency(ipo.faceValue));

  // A fresh issue that IS the whole issue tells you nothing the issue-size tile didn't. Compared
  // on digits only because the two arrive in different shapes from different fields — a formatted
  // string ("₹720.00 Cr") against a bare number (720).
  const digits = (v) => String(v ?? '').replace(/[^\d]/g, '').replace(/0+$/, '');
  const freshIsWholeIssue = ipo.freshIssue != null && ipo.offerForSale == null
    && digits(ipo.issueSize) !== '' && digits(ipo.issueSize) === digits(ipo.freshIssue);
  if (!freshIsWholeIssue) {
    add('freshIssue', AddCircleOutlineIcon, 'Fresh issue', ipo.freshIssue != null ? `${formatCurrency(ipo.freshIssue)} Cr` : null);
  }
  add('offerForSale', SwapHorizOutlinedIcon, 'Offer for sale', ipo.offerForSale != null ? `${formatCurrency(ipo.offerForSale)} Cr` : null);
  add('listingPrice', PriceCheckOutlinedIcon, 'Listing price', formatCurrency(ipo.listingPrice));

  if (ipo.listingGainPct != null) {
    const { color, Icon } = signedMeta(ipo.listingGainPct, T);
    add('listingGain', Icon, 'Listing gain', formatPct(ipo.listingGainPct), color);
  }
  if (ipo.gmp != null || ipo.gmpPct != null) {
    // Direction follows gmpPct when it's present (it's the more meaningful signal — gmp itself
    // can be legitimately 0 while the % is still nonzero), falling back to gmp only when there's
    // no gmpPct at all.
    const { color, Icon } = signedMeta(ipo.gmpPct ?? ipo.gmp, T);
    const value = [formatCurrency(ipo.gmp), ipo.gmpPct != null ? `(${formatPct(ipo.gmpPct)})` : null]
      .filter(Boolean).join(' ');
    // The grey market ends at listing, so a listed IPO's figure is the last one recorded before
    // that — not a live premium. Labelling it plain "GMP" beside a real listing gain invited the
    // reading that both are current. Named honestly it becomes the interesting comparison: what
    // the grey market predicted, against what actually happened.
    add('gmp', Icon, ipo.status === 'listed' ? 'Final GMP' : 'GMP', value, color);
  }

  add('subscription', PeopleAltOutlinedIcon, 'Subscription', formatMultiplier(ipo.subTotal));
  add('registrar', DomainOutlinedIcon, 'Registrar', ipo.registrar);
  return facts;
}

/** The expanded "About" company facts, as the same tile grid as Key facts. Every field is
 * independently optional — a real source reports some and not others — so each is only built
 * when its own value is present. */
function aboutFacts(ipo) {
  const facts = [];
  if (ipo.foundedYear != null) facts.push({ key: 'founded', icon: CalendarMonthOutlinedIcon, label: 'Founded', value: String(ipo.foundedYear) });
  if (ipo.managingDirector) facts.push({ key: 'md', icon: BadgeOutlinedIcon, label: 'MD / CEO', value: ipo.managingDirector });
  if (ipo.parentCompany) facts.push({ key: 'parent', icon: AccountTreeOutlinedIcon, label: 'Parent company', value: ipo.parentCompany });
  if (ipo.sector) facts.push({ key: 'sector', icon: CategoryOutlinedIcon, label: 'Sector', value: ipo.sector });
  if (ipo.headquarters) facts.push({ key: 'hq', icon: LocationOnOutlinedIcon, label: 'Headquarters', value: ipo.headquarters });
  if (ipo.website) facts.push({ key: 'web', icon: LanguageOutlinedIcon, label: 'Website', value: <WebsiteLink website={ipo.website} /> });
  return facts;
}

/**
 * Key metrics (KPI) grid — label/value pairs (ROE, P/E, EPS, Market Cap, …) as reported by the
 * source, values kept verbatim (%, ₹, ratios). Icon-less compact cells since the metrics are
 * heterogeneous; same muted-uppercase-label / bold-value type scale as `FactTile`. Metrics a
 * source reported without a figure are filtered out by the caller rather than shown as em dashes,
 * which also means an all-empty list never renders a "Key metrics" heading over nothing.
 */
function KpiGrid({ kpis }) {
  const T = useT();
  const clamp2 = {
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  };
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))',
      gap: 2,
    }}>
      {kpis.map((kpi) => (
        <Box key={kpi.label} sx={{ minWidth: 0 }}>
          {/* Source-supplied labels run long ("Promoter and promoter group", "Market cap at offer
              price") and were being clipped mid-word; they wrap, bounded at two lines. */}
          <Typography sx={{
            fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4,
            fontWeight: 700, lineHeight: 1.4, ...clamp2,
          }}>
            {kpi.label}
          </Typography>
          <Typography sx={{
            fontSize: 14, fontWeight: 800, color: T.textPrimary, mt: 0.15,
            lineHeight: 1.35, wordBreak: 'break-word', ...clamp2,
          }}>
            {kpi.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * "Objects of the Issue" — a numbered list of what the net proceeds fund, with the estimated
 * ₹-crore amount right-aligned per row (omitted for rows with no figure, e.g. "General corporate
 * purposes").
 *
 * Sources append their own "Total" row to this list, and numbering it as object 3 of 3 made the
 * sum read as another use of funds. It is split out and rendered as a footer instead.
 */
function ObjectsList({ objects }) {
  const T = useT();
  const isTotal = (o) => /^\s*total\b/i.test(o.purpose ?? '');
  const items = objects.filter((o) => !isTotal(o));
  const total = objects.find(isTotal);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* The index stays: it drives the "1." numbering and the last-row border. */}
      {items.map((obj, i) => (
        <Box
          key={obj.purpose}
          sx={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5,
            py: 1, borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : 'none',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: T.teal, flexShrink: 0 }}>{i + 1}.</Typography>
            <Typography sx={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>{obj.purpose}</Typography>
          </Box>
          {obj.amount && (
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {obj.amount}
            </Typography>
          )}
        </Box>
      ))}
      {total?.amount && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
          mt: 1, pt: 1, borderTop: `1px solid ${T.border}`,
        }}>
          <Typography sx={{
            fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
            letterSpacing: 0.4, fontWeight: 700,
          }}>
            Total
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.textPrimary, whiteSpace: 'nowrap' }}>
            {total.amount}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * The About narrative — clamped to a few lines with a "Read more / Read less" toggle when it's
 * long (Chittorgarh's company descriptions can run many paragraphs), shown in full when short so
 * the toggle never appears pointlessly. Line-clamped via `-webkit-line-clamp` while collapsed.
 */
function AboutBlurb({ text, mb }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const isLong = text.length > 280;
  return (
    <Box sx={{ mb }}>
      <Typography sx={{
        fontSize: 13, color: T.textMuted, lineHeight: 1.7,
        ...(isLong && !open
          ? { display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
          : {}),
      }}>
        {text}
      </Typography>
      {isLong && (
        <Box
          component="button"
          type="button"
          onClick={() => setOpen((o) => !o)}
          sx={{
            mt: 0.75, p: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 0.25, color: T.teal, fontSize: 12.5, fontWeight: 700,
          }}
        >
          {open ? 'Read less' : 'Read more'}
          {open ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </Box>
      )}
    </Box>
  );
}

/** A prospectus document as a pill-style external link (opens the NSE-hosted file in a new tab). */
function DocLink({ label, url }) {
  const T = useT();
  return (
    <Box
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.25, py: 0.6, borderRadius: 2,
        border: `1px solid ${T.border}`, bgcolor: T.glass, color: T.teal, textDecoration: 'none',
        fontSize: 12.5, fontWeight: 700, '&:hover': { bgcolor: T.tealBg, borderColor: T.teal },
      }}
    >
      <ArticleOutlinedIcon sx={{ fontSize: 15 }} />
      {label}
    </Box>
  );
}

const hasIssueDetails = (d) =>
  !!d && (!!d.issueType || !!d.minOrderQuantity || !!d.sponsorBank || !!d.rhpUrl || !!d.drhpUrl);

/**
 * NSE "Issue details" — issue mechanism / minimum order quantity / sponsor bank as compact fact
 * tiles, plus the prospectus (RHP / DRHP) document links as pill buttons. Each piece is
 * independently optional; the section (see call site) only renders when at least one is present.
 */
function IssueDetails({ details }) {
  const facts = [];
  if (details.issueType) facts.push({ key: 'type', icon: CategoryOutlinedIcon, label: 'Issue type', value: details.issueType });
  if (details.minOrderQuantity) facts.push({ key: 'moq', icon: Inventory2OutlinedIcon, label: 'Min. order qty', value: details.minOrderQuantity });
  if (details.sponsorBank) facts.push({ key: 'bank', icon: AccountBalanceWalletOutlinedIcon, label: 'Sponsor bank', value: details.sponsorBank });
  const docs = [];
  if (details.rhpUrl) docs.push({ label: 'Red Herring Prospectus', url: details.rhpUrl });
  if (details.drhpUrl) docs.push({ label: 'Draft RHP (DRHP)', url: details.drhpUrl });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: facts.length && docs.length ? 2 : 0 }}>
      {facts.length > 0 && <FactGrid facts={facts} />}
      {docs.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {docs.map((d) => <DocLink key={d.label} label={d.label} url={d.url} />)}
        </Box>
      )}
    </Box>
  );
}

/** Book-running lead manager(s) as a simple bulleted list. */
function LeadManagers({ managers }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {managers.map((manager) => (
        <Box key={manager} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: T.teal, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13, color: T.textPrimary }}>{manager}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Green for the retail tranche, purple for HNI — mid-tone hexes that read on both themes. */
const LOT_GROUP_COLOR = { retail: '#059669', hni: '#7c3aed' };
const INT_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** A range as one string, collapsing to a single value when both ends are the same (an SME lot can
 * be large enough that retail gets exactly one lot) and reading "from X" when the tranche is
 * open-ended at the top, which B-HNI genuinely is. */
const rangeText = (min, max, fmt) => {
  if (max == null) return `from ${fmt(min)}`;
  if (min === max) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
};

/** The caption line's tighter register: no spaces around the dash, and an open-ended top reads as
 * a "+" suffix rather than a second "from" (the amount above it already says "from", and
 * "from 69 lots · from 2,346 shares" said it twice in one line). */
const compactRange = (min, max, fmt) => {
  if (max == null) return `${fmt(min)}+`;
  if (min === max) return fmt(min);
  return `${fmt(min)}–${fmt(max)}`;
};

const intText = (n) => INT_FMT.format(n);

/** Lots carry the unit once at the end, not on both ends of the range. */
const lotsText = (min, max) =>
  `${compactRange(min, max, intText)} lot${min === 1 && max === 1 ? '' : 's'}`;

/**
 * One investor tranche as a rung on the ladder: who it is on the left, what a bid in it costs on
 * the right, and the lots and shares that buys underneath.
 *
 * Laid out as a wide row rather than a tile because the three tranches ARE a ladder — retail, then
 * small HNI, then big HNI, each starting where the last one stops — and stacking them full-width
 * keeps that ascent visible while a grid of tiles broke it into an arbitrary 2 + 1. The left
 * accent bar carries the tranche colour so retail separates from HNI without a second label.
 */
function TrancheRow({ tranche }) {
  const T = useT();
  const color = LOT_GROUP_COLOR[tranche.group];
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', minWidth: 0,
      py: 1.15, px: 1.5, pl: 1.75, borderRadius: 2,
      border: `1px solid ${color}33`, bgcolor: `${color}0f`,
      '&::before': {
        content: '""', position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, bgcolor: color,
      },
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 1.5, flexWrap: 'wrap',
      }}>
        <Typography sx={{
          fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5,
        }} noWrap>
          {tranche.label}
        </Typography>
        <Typography sx={{
          fontSize: { xs: 15, sm: 16 }, fontWeight: 800, color: T.textPrimary, lineHeight: 1.3,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {rangeText(tranche.minAmount, tranche.maxAmount, formatAmount)}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11.5, color: T.textMuted, mt: 0.2, fontVariantNumeric: 'tabular-nums' }}>
        {lotsText(tranche.minLots, tranche.maxLots)}
        {' · '}
        {compactRange(tranche.minShares, tranche.maxShares, intText)} shares
      </Typography>
    </Box>
  );
}

/**
 * "Application amounts" — what a bid costs in each investor tranche, from `computeLotBreakdown`.
 *
 * This has now been three things. It started as five tile-cards, one per endpoint, each repeating
 * the words "Lots" and "Shares" and costing 470px. A table halved that, but left the Overview
 * reading as three stacked tables in a row — and it still made the reader pair "Retail (Min)" with
 * "Retail (Max)" themselves to get the one number they came for. These are three RANGES, not five
 * rows, and they are a ladder rather than a set, so they are drawn as three stacked rungs.
 *
 * Renders nothing when lot size / price aren't known (see the call site).
 */
function LotSizeSection({ breakdown, ipoType }) {
  const T = useT();
  return (
    <SectionCard
      title="Application amounts"
      subtitle={`One lot is ${breakdown.minBidShares} shares (${formatAmount(breakdown.lotValue)}); bids go up in whole lots.`}
      icon={<LayersOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {breakdown.tranches.map((tranche) => <TrancheRow key={tranche.key} tranche={tranche} />)}
      </Box>
      <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 1.5, lineHeight: 1.5 }}>
        {String(ipoType).toLowerCase() === 'sme'
          ? 'A retail application is capped at ₹2,00,000; anything above that bids as HNI.'
          : 'SEBI caps a retail application at ₹2,00,000 and an S-HNI application at ₹10,00,000.'}
      </Typography>
    </SectionCard>
  );
}

/**
 * Overview tab — everything about the issue and the company that isn't the grey market (GMP tab),
 * the bidding (Subscription tab) or the allotment (Allotment tab).
 *
 * Two things changed structurally.
 *
 * ORDER. It now runs in the order the questions actually get asked: when is it, what is it, what
 * does an application cost, who is the company, how do they trade, what are they good at, where
 * does the money go, and finally the paperwork. "IPO lot size" — the answer to "what will this
 * cost me" — used to sit eighth, below the list of lead managers. "Live market read" used to sit
 * here at all, which put investorgain's P/E directly beneath the prospectus's own P/E from a
 * different source and read as a contradiction; it now lives with the rest of the grey market on
 * the GMP tab.
 *
 * WIDTH. Ten full-width cards stacked in one column ran ~2,750px of card on a desktop, with a
 * 100px-tall facts grid spending a whole 1,050px-wide row and the About paragraph running at a
 * line length well past comfortable. From `lg` up the sections split into two columns — the offer
 * on the left, the company and its filings on the right — with the timeline full-width above
 * both, since a six-stage stepper is the one thing here that genuinely wants the whole row.
 */
export default function OverviewTab({ ipo, id }) {
  const T = useT();
  const facts = keyFacts(ipo, T, detailFigures(ipo));
  const about = aboutFacts(ipo);
  const kpis = (ipo.kpis ?? []).filter((kpi) => kpi.value != null && kpi.value !== '');
  const lotBreakdown = computeLotBreakdown(ipo.lotSize, ipo.priceMax, ipo.ipoType);
  const sectionIcon = (Icon) => <Icon sx={{ fontSize: 15, color: T.teal }} />;

  // The offer: what it is, what it costs, who is selling, what the proceeds are for.
  const offerColumn = [
    facts.length > 0 && (
      <SectionCard key="facts" title="Key facts" icon={sectionIcon(ListAltOutlinedIcon)}>
        <FactGrid facts={facts} />
      </SectionCard>
    ),
    lotBreakdown && <LotSizeSection key="lots" breakdown={lotBreakdown} ipoType={ipo.ipoType} />,
    (ipo.about || about.length > 0) && (
      <SectionCard key="about" title="About" icon={sectionIcon(InfoOutlinedIcon)}>
        {ipo.about && <AboutBlurb text={ipo.about} mb={about.length > 0 ? 2 : 0} />}
        {about.length > 0 && <FactGrid facts={about} />}
      </SectionCard>
    ),
    ipo.issueObjects?.length > 0 && (
      <SectionCard key="objects" title="Objects of the issue" icon={sectionIcon(FlagOutlinedIcon)}>
        <ObjectsList objects={ipo.issueObjects} />
      </SectionCard>
    ),
  ].filter(Boolean);

  // The company: how it trades, what it claims, and who arranged the issue.
  const companyColumn = [
    <FinancialsTable key="fin" id={id} />,
    kpis.length > 0 && (
      <SectionCard key="kpi" title="Key metrics" icon={sectionIcon(QueryStatsOutlinedIcon)}>
        <KpiGrid kpis={kpis} />
      </SectionCard>
    ),
    <StrengthsRisks key="sr" ipo={ipo} />,
    hasIssueDetails(ipo.issueDetails) && (
      <SectionCard key="issue" title="Issue details" icon={sectionIcon(ReceiptLongOutlinedIcon)}>
        <IssueDetails details={ipo.issueDetails} />
      </SectionCard>
    ),
    ipo.leadManagers?.length > 0 && (
      <SectionCard key="lm" title="Lead manager(s)" icon={sectionIcon(GroupsOutlinedIcon)}>
        <LeadManagers managers={ipo.leadManagers} />
      </SectionCard>
    ),
  ].filter(Boolean);

  return (
    <SectionStack>
      <SectionCard title="Timeline" icon={sectionIcon(EventOutlinedIcon)}>
        <IpoTimeline ipo={ipo} />
      </SectionCard>

      {/* Below `lg` this collapses to one column and the two arrays simply concatenate, which is
          why the offer column is ordered to read sensibly straight on into the company one. */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
        alignItems: 'start',
      }}>
        <SectionStack>{offerColumn}</SectionStack>
        <SectionStack>{companyColumn}</SectionStack>
      </Box>
    </SectionStack>
  );
}
