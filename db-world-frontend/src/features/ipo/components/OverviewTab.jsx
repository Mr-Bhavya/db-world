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
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { useT } from '@shared/theme';
import {
  formatPriceBand, formatCurrency, formatPct, formatMultiplier, formatExchange, websiteDomain,
  computeLotBreakdown,
} from '../utils/format';
import IpoTimeline from './IpoTimeline';
import SectionCard from './SectionCard';
import FinancialsTable from './FinancialsTable';
import StrengthsRisks from './StrengthsRisks';

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
 * The expanded "About" company facts — Founded/MD-CEO/Parent company/Sector/Headquarters/
 * Website — laid out as the same compact icon+label+value tile grid as "Key facts", right
 * alongside the free-text `about` blurb. Every field is independently optional (a real
 * source may report some and not others), so each tile is only rendered when its own value
 * is present rather than the whole grid gating on one field.
 */
function AboutFacts({ ipo }) {
  const T = useT();
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)' },
      gap: 2,
      color: T.textPrimary,
    }}>
      {ipo.foundedYear != null && (
        <FactTile icon={CalendarMonthOutlinedIcon} label="Founded" value={String(ipo.foundedYear)} />
      )}
      {ipo.managingDirector && (
        <FactTile icon={BadgeOutlinedIcon} label="MD / CEO" value={ipo.managingDirector} />
      )}
      {ipo.parentCompany && (
        <FactTile icon={AccountTreeOutlinedIcon} label="Parent company" value={ipo.parentCompany} />
      )}
      {ipo.sector && (
        <FactTile icon={CategoryOutlinedIcon} label="Sector" value={ipo.sector} />
      )}
      {ipo.headquarters && (
        <FactTile icon={LocationOnOutlinedIcon} label="Headquarters" value={ipo.headquarters} />
      )}
      {ipo.website && (
        <FactTile icon={LanguageOutlinedIcon} label="Website" value={<WebsiteLink website={ipo.website} />} />
      )}
    </Box>
  );
}

const hasAboutFacts = (ipo) =>
  ipo.foundedYear != null || !!ipo.managingDirector || !!ipo.parentCompany
  || !!ipo.sector || !!ipo.headquarters || !!ipo.website;

/**
 * Key metrics (KPI) grid — label/value pairs (ROE, P/E, EPS, Market Cap, …) as reported by the
 * source, values kept verbatim (%, ₹, ratios). Icon-less compact cells since the metrics are
 * heterogeneous; same faint-uppercase-label / bold-value type scale as `FactTile`.
 */
function KpiGrid({ kpis }) {
  const T = useT();
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)' },
      gap: 2,
    }}>
      {kpis.map((kpi) => (
        <Box key={kpi.label} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }} noWrap>
            {kpi.label}
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.textPrimary, mt: 0.15 }} noWrap>
            {kpi.value ?? '—'}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * "Objects of the Issue" — a numbered list of what the net proceeds fund, with the estimated
 * ₹-crore amount right-aligned per row (omitted for rows with no figure, e.g. "General corporate
 * purposes"). Divider between rows, none after the last.
 */
function ObjectsList({ objects }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* The index stays: it drives the "1." numbering and the last-row border. */}
      {objects.map((obj, i) => (
        <Box
          key={obj.purpose}
          sx={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5,
            py: 1, borderBottom: i < objects.length - 1 ? `1px solid ${T.border}` : 'none',
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
  if (details.issueType) facts.push({ icon: CategoryOutlinedIcon, label: 'Issue type', value: details.issueType });
  if (details.minOrderQuantity) facts.push({ icon: Inventory2OutlinedIcon, label: 'Min. order qty', value: details.minOrderQuantity });
  if (details.sponsorBank) facts.push({ icon: AccountBalanceWalletOutlinedIcon, label: 'Sponsor bank', value: details.sponsorBank });
  const docs = [];
  if (details.rhpUrl) docs.push({ label: 'Red Herring Prospectus', url: details.rhpUrl });
  if (details.drhpUrl) docs.push({ label: 'Draft RHP (DRHP)', url: details.drhpUrl });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: facts.length && docs.length ? 2 : 0 }}>
      {facts.length > 0 && (
        <Box sx={{
          display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)' }, gap: 2,
        }}>
          {facts.map((f) => <FactTile key={f.label} icon={f.icon} label={f.label} value={f.value} />)}
        </Box>
      )}
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
const INR0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** One application-lot-size tier card — amount (colour-coded by category) over a Lots / Shares pair. */
function LotTierCard({ tier }) {
  const T = useT();
  const color = LOT_GROUP_COLOR[tier.group];
  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${color}33`, bgcolor: `${color}12`, minWidth: 0 }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted }} noWrap>{tier.label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 800, color, mt: 0.25 }} noWrap>₹{INR0.format(tier.amount)}</Typography>
      <Box sx={{ display: 'flex', gap: 2.5, mt: 0.85 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Lots</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: T.textPrimary }}>{INR0.format(tier.lots)}</Typography>
        </Box>
        <Box sx={{ minWidth: 0, borderLeft: `1px solid ${T.border}`, pl: 2.5 }}>
          <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Shares</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: T.textPrimary }}>{INR0.format(tier.shares)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * "IPO lot size" — the per-category application ladder (Retail Min/Max, S-HNI Min/Max, B-HNI Min),
 * derived from lot size + the cut-off price via {@code computeLotBreakdown}. Renders nothing when
 * lot size / price aren't known yet (see call site gating on the return being null).
 */
function LotSizeSection({ breakdown }) {
  const T = useT();
  return (
    <SectionCard title="IPO lot size" icon={<LayersOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
      <Typography sx={{ fontSize: 13, color: T.textMuted, mb: 2 }}>
        Minimum bid:{' '}
        <Box component="span" sx={{ fontWeight: 800, color: T.textPrimary }}>{breakdown.minBidShares}</Box>
        {' '}shares and in multiples thereof
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' }, gap: 1.5 }}>
        {breakdown.tiers.map((tier) => <LotTierCard key={tier.label} tier={tier} />)}
      </Box>
    </SectionCard>
  );
}

/**
 * Overview tab — the at-a-glance summary, ordered by decision-usefulness: timeline stepper, the
 * compact "key facts" grid, a brief (collapsible) About so the reader knows what the company is
 * before the numbers, then the financials snapshot + key metrics, and finally the remaining
 * prospectus detail (Strengths, Lead managers, Objects of the issue). The full GMP/subscription
 * charts live on their own tabs.
 */
export default function OverviewTab({ ipo, id }) {
  const T = useT();
  const showAbout = !!ipo.about || hasAboutFacts(ipo);
  const lotBreakdown = computeLotBreakdown(ipo.lotSize, ipo.priceMax, ipo.ipoType);
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

      {showAbout && (
        <SectionCard title="About" icon={<InfoOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          {ipo.about && <AboutBlurb text={ipo.about} mb={hasAboutFacts(ipo) ? 2 : 0} />}
          {hasAboutFacts(ipo) && <AboutFacts ipo={ipo} />}
        </SectionCard>
      )}

      <FinancialsTable id={id} />

      {ipo.kpis?.length > 0 && (
        <SectionCard title="Key metrics" icon={<QueryStatsOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          <KpiGrid kpis={ipo.kpis} />
        </SectionCard>
      )}

      <StrengthsRisks ipo={ipo} />

      {ipo.leadManagers?.length > 0 && (
        <SectionCard title="Lead manager(s)" icon={<GroupsOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          <LeadManagers managers={ipo.leadManagers} />
        </SectionCard>
      )}

      {lotBreakdown && <LotSizeSection breakdown={lotBreakdown} />}

      {hasIssueDetails(ipo.issueDetails) && (
        <SectionCard title="Issue details" icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          <IssueDetails details={ipo.issueDetails} />
        </SectionCard>
      )}

      {ipo.issueObjects?.length > 0 && (
        <SectionCard title="Objects of the issue" icon={<FlagOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
          <ObjectsList objects={ipo.issueObjects} />
        </SectionCard>
      )}
    </Box>
  );
}
