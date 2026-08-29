import { Box, Typography } from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import { useT } from '@shared/theme';
import {
  formatShortDate, formatPriceBand, formatPct, formatCurrency, formatAmount, formatExchange,
  formatMultiplier, statusMeta, ipoTypeMeta, daysLeftLabel, subscriptionMeta, isClosingToday,
  detailFigures, minInvestment, biddingProgressPct, daysUntil,
} from '../utils/format';
import CompanyLogo from './CompanyLogo';

/** Direction of a signed number as a {colour, icon} pair — the same convention as the list card,
 * so a premium reads the same green on both surfaces. */
function trendOf(value, T) {
  const positive = value != null && value > 0;
  const negative = value != null && value < 0;
  return {
    color: positive ? T.success : negative ? T.error : T.textMuted,
    Icon: positive ? TrendingUpRoundedIcon : negative ? TrendingDownRoundedIcon : TrendingFlatRoundedIcon,
  };
}

/** Investorgain's 1–5 GMP rating as flames, on the lead figure's label row (same placement as the
 * card's, for the same reason: the label is short, the figure is not). */
function GmpRating({ rating }) {
  const T = useT();
  if (rating == null || rating <= 0) return null;
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.15, flexShrink: 0 }}
      aria-label={`Investorgain GMP rating ${rating} out of 5`}
    >
      {Array.from({ length: Math.min(rating, 5) }).map((_, i) => (
        <LocalFireDepartmentRoundedIcon key={i} sx={{ fontSize: 14, color: T.warning }} />
      ))}
    </Box>
  );
}

/**
 * Micro-label above a figure. `textMuted`, never `textFaint` — at 10.5px the fainter token clears
 * 4.5:1 on neither theme, which is the readability fix the list redesign made and this page never
 * got.
 */
function FigureLabel({ children, badge }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
      <Typography sx={{
        fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
        letterSpacing: 0.6, fontWeight: 700, lineHeight: 1.4,
      }} noWrap>
        {children}
      </Typography>
      {badge}
    </Box>
  );
}

/**
 * The one figure this IPO's stage is actually about, at 30–34px — grey market before bidding,
 * subscription once bidding is done, listing gain once it is over. A companion value (estimated
 * listing price, what it listed at, the current GMP) rides underneath when we have one.
 */
function LeadFigure({ label, value, sub, color, badge, footnote }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <FigureLabel badge={badge}>{label}</FigureLabel>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0, mt: 0.35 }}>
        <Typography sx={{
          fontSize: { xs: 30, sm: 34 }, fontWeight: 800, color: color ?? T.textPrimary,
          lineHeight: 1.15, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums',
        }} noWrap>
          {value}
        </Typography>
        {sub && (
          <Typography sx={{
            fontSize: { xs: 14, sm: 15 }, fontWeight: 700, color: color ?? T.textMuted, opacity: 0.85,
          }} noWrap>
            {sub}
          </Typography>
        )}
      </Box>
      {footnote && (
        <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.35, fontVariantNumeric: 'tabular-nums' }} noWrap>
          <Box component="span" sx={{ color: T.textFaint, fontWeight: 600 }}>{footnote.label} </Box>
          <Box component="span" sx={{ fontWeight: 700 }}>{footnote.value}</Box>
        </Typography>
      )}
    </Box>
  );
}

/**
 * A supporting figure — 19px, so it steps clearly below the lead but still reads as data.
 *
 * Any qualifier (`sub`) sits on its OWN line rather than inline. Measured on an SME issue with a
 * 1200-share lot at ₹100, "₹1,20,000 / 1200 sh" wanted ~160px in a ~155px track, and what got
 * clipped was the primary number — "₹1,20,0…". A qualifier must never be able to eat the figure
 * it qualifies.
 */
function SubFigure({ label, value, color, sub }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <FigureLabel>{label}</FigureLabel>
      <Typography sx={{
        fontSize: 19, fontWeight: 800, color: color ?? T.textPrimary, lineHeight: 1.25, mt: 0.25,
        letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums',
      }} noWrap>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, lineHeight: 1.4 }} noWrap>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

/** Countdown pill — a clock while something is still counting down, a calendar-check after.
 * Matches the list card's pill exactly, including the alert treatment on a same-day deadline. */
function DaysLeftPill({ ipo }) {
  const T = useT();
  const label = daysLeftLabel(ipo);
  if (!label) return null;
  const counting = ipo.status === 'upcoming' || ipo.status === 'open';
  const Icon = counting ? AccessTimeRoundedIcon : EventAvailableRoundedIcon;
  const meta = statusMeta(ipo.status, T);
  const urgent = isClosingToday(ipo);
  const color = urgent ? T.error : meta.color;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.45, flexShrink: 0,
      px: 1, py: 0.4, borderRadius: 999,
      bgcolor: urgent ? T.errorBg : meta.bg,
      border: `1px solid ${urgent ? `${T.error}55` : 'transparent'}`,
    }}>
      <Icon sx={{ fontSize: 13, color }} />
      <Typography sx={{ fontSize: 11.5, fontWeight: 800, color, whiteSpace: 'nowrap' }}>{label}</Typography>
    </Box>
  );
}

/**
 * The timing strip: what happens next and when, plus — while bidding is live — how much of the
 * window is gone. A bidding window is the one thing on this page with a hard deadline, and the
 * old header showed nothing about it at all; the bar makes "day 3 of 5" legible without doing
 * date arithmetic in your head.
 *
 * It overlaps the Overview tab's timeline stepper on one date, which would be repetition on a
 * list card and isn't here: the hero rides above ALL four tabs, so this line is the only timing
 * information a reader on GMP, Subscription or Allotment ever sees. The stepper still owns the
 * full six-stage journey; this owns "the next thing, and how long you have".
 */
function TimingStrip({ ipo }) {
  const T = useT();
  const urgent = isClosingToday(ipo);
  const meta = statusMeta(ipo.status, T);
  const accent = urgent ? T.error : meta.color;

  const progress = ipo.status === 'open' ? biddingProgressPct(ipo.openDate, ipo.closeDate) : null;
  const fromOpen = daysUntil(ipo.openDate);
  const fromClose = daysUntil(ipo.closeDate);
  const totalDays = fromOpen != null && fromClose != null ? fromClose - fromOpen + 1 : null;
  const dayNumber = totalDays != null ? Math.max(1, Math.min(1 - fromOpen, totalDays)) : null;

  // Each stage names its own next milestone rather than repeating the same date range everywhere,
  // and any part whose date is unknown is dropped instead of printed as "TBA".
  const parts = [];
  if (ipo.status === 'open') {
    if (dayNumber != null) parts.push(`Day ${dayNumber} of ${totalDays}`);
    if (ipo.closeDate) parts.push(`Closes ${formatShortDate(ipo.closeDate)}`);
  } else if (ipo.status === 'upcoming') {
    if (ipo.openDate) parts.push(`Opens ${formatShortDate(ipo.openDate)}`);
    if (ipo.closeDate) parts.push(`Closes ${formatShortDate(ipo.closeDate)}`);
  } else if (ipo.status === 'closed') {
    if (ipo.allotmentDate) parts.push(`Allotment ${formatShortDate(ipo.allotmentDate)}`);
    if (ipo.listingDate) parts.push(`Lists ${formatShortDate(ipo.listingDate)}`);
    if (parts.length === 0 && ipo.closeDate) parts.push(`Closed ${formatShortDate(ipo.closeDate)}`);
  } else if (ipo.listingDate) {
    parts.push(`Listed ${formatShortDate(ipo.listingDate)}`);
  }

  // Tested against the LABEL, not against `<DaysLeftPill/>` — an element is truthy even when the
  // component renders null, which would have left an IPO with no dates at all showing a bare
  // divider with nothing under it.
  if (parts.length === 0 && progress == null && !daysLeftLabel(ipo)) return null;

  return (
    <Box sx={{ mt: 1.75, pt: 1.5, borderTop: `1px solid ${T.border}` }}>
      {progress != null && (
        <Box sx={{ height: 5, borderRadius: 999, bgcolor: T.glassHover, overflow: 'hidden', mb: 1 }}>
          <Box sx={{ height: '100%', width: `${progress}%`, borderRadius: 999, bgcolor: accent }} />
        </Box>
      )}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 1, flexWrap: 'wrap',
      }}>
        <Typography sx={{ fontSize: 12.5, color: T.textMuted, fontWeight: 600, minWidth: 0 }}>
          {parts.join(' · ')}
        </Typography>
        <DaysLeftPill ipo={ipo} />
      </Box>
    </Box>
  );
}

/**
 * Builds the renderable figure for one key from `detailFigures`. Every branch here is reached only
 * when `detailFigures` has already confirmed the value exists, so none of them needs a null
 * fallback — which is exactly why the hero cannot render an em dash the way the old Key-facts grid
 * could.
 *
 * `shown` is every key the hero is rendering this time, and it exists to stop the lead's footnote
 * repeating a figure that is already sitting right next to it: a listed IPO led with "+111.33%
 * / Listed at ₹634" and then printed "LISTED AT ₹634" as the very next figure. A footnote that
 * would duplicate a visible figure is dropped rather than shown twice.
 */
function figureFor(key, ipo, T, lead, shown = []) {
  const Component = lead ? LeadFigure : SubFigure;
  const footnoteUnless = (dupKey, footnote) => (shown.includes(dupKey) ? null : footnote);
  switch (key) {
    case 'gmp': {
      // Direction follows gmpPct first: the premium itself can legitimately be 0 while the
      // percentage isn't, and `gmp ?? gmpPct` would keep that 0 and read flat. Matches how the
      // Key-facts GMP tile just below decides its own colour, so the two can't disagree.
      const { color } = trendOf(ipo.gmpPct ?? ipo.gmp, T);
      // Prefer investorgain's own reported estimate over their low/high range: it is the more
      // specific number, and it is reported rather than derived here.
      const footnote = ipo.estimatedListingPrice != null
        ? { label: 'Est. listing', value: formatCurrency(ipo.estimatedListingPrice) }
        : ipo.gmpMin != null && ipo.gmpMax != null
          ? { label: 'Range', value: `${formatCurrency(ipo.gmpMin)}–${formatCurrency(ipo.gmpMax)}` }
          : null;
      return (
        <Component
          label="Grey market premium"
          value={formatCurrency(ipo.gmp) ?? formatPct(ipo.gmpPct)}
          sub={ipo.gmp != null && ipo.gmpPct != null ? `(${formatPct(ipo.gmpPct)})` : null}
          color={color}
          badge={<GmpRating rating={ipo.gmpRating} />}
          footnote={footnote}
        />
      );
    }
    case 'subscription':
      return (
        <Component
          label={ipo.status === 'open' ? 'Subscription' : 'Final subscription'}
          value={formatMultiplier(ipo.subTotal)}
          color={subscriptionMeta(ipo.subTotal, T)?.color}
          footnote={ipo.gmp != null ? footnoteUnless('gmp', { label: 'GMP', value: formatCurrency(ipo.gmp) }) : null}
        />
      );
    case 'listingGain':
      return (
        <Component
          label="Listing gain"
          value={formatPct(ipo.listingGainPct)}
          color={trendOf(ipo.listingGainPct, T).color}
          footnote={ipo.listingPrice != null
            ? footnoteUnless('listingPrice', { label: 'Listed at', value: formatCurrency(ipo.listingPrice) })
            : null}
        />
      );
    case 'listingPrice':
      return (
        <Component
          label="Listed at"
          value={formatCurrency(ipo.listingPrice)}
          footnote={ipo.priceMax != null
            ? footnoteUnless('priceBand', { label: 'Issue price', value: formatCurrency(ipo.priceMax) })
            : null}
        />
      );
    case 'priceBand':
      return (
        <Component
          label="Price band"
          value={formatPriceBand(ipo.priceMin, ipo.priceMax)}
          footnote={ipo.faceValue != null
            ? { label: 'Face value', value: formatCurrency(ipo.faceValue) }
            : null}
        />
      );
    case 'minInvestment':
      // The lot rides in the footnote when this leads and inline when it doesn't — a lead figure
      // renders both slots, so putting it in each would print the lot size twice.
      return (
        <Component
          label="Min. investment"
          value={formatAmount(minInvestment(ipo.lotSize, ipo.priceMax))}
          sub={!lead && ipo.lotSize != null ? `/ ${ipo.lotSize} sh` : null}
          footnote={ipo.lotSize != null ? { label: 'Lot', value: `${ipo.lotSize} shares` } : null}
        />
      );
    case 'issueSize':
      return <Component label="Issue size" value={ipo.issueSize} />;
    default:
      return null;
  }
}

/**
 * Detail-page hero.
 *
 * Same thesis as the list redesign: the surface is driven by the IPO's lifecycle STAGE rather than
 * showing one fixed set of cells at every stage, and a figure is only ever offered when its value
 * exists. The page previously opened on a thin identity row — logo, name, two chips — followed
 * straight into a twelve-cell grid where the price band, the GMP, the subscription and the
 * registrar all sat at the same 14px weight, and where anything the stage didn't have printed an
 * em dash. Nothing led, and roughly a third of an upcoming IPO's grid was holes.
 *
 * Now the reader lands on: who this is, the one number their stage is about, what an application
 * actually costs, and how long they have. Everything else is still a tab away.
 *
 * The back control is deliberately NOT in here. A card is a piece of content, and a navigation
 * button boxed inside one reads as if going back were part of this IPO rather than a way out of
 * it — see `IpoDetailPage`, which renders it above the card as a breadcrumb.
 */
export default function IpoDetailHero({ ipo }) {
  const T = useT();
  const meta = statusMeta(ipo.status, T);
  const typeMeta = ipoTypeMeta(ipo.ipoType, T);
  const urgent = isClosingToday(ipo);
  const accent = urgent ? T.error : meta.color;
  const keys = detailFigures(ipo);
  const [leadKey, ...subKeys] = keys;

  return (
    <Box sx={{
      position: 'relative',
      bgcolor: T.glass,
      border: `1px solid ${T.border}`,
      borderRadius: 3.5,
      p: { xs: 1.75, sm: 2.25 },
      mb: 2,
      overflow: 'hidden',
      // Status accent as a top edge, exactly as on the list card — a solid bar rather than a fade
      // when the bidding window closes today, so the page announces its own urgency.
      '&::before': {
        content: '""',
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: urgent ? accent : `linear-gradient(90deg, ${accent}, ${accent}00)`,
      },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1.25, sm: 1.5 }, minWidth: 0 }}>
        {/* One tinted, bordered well — the logo IS the well. It used to be a bordered Box wrapping
            a bordered circular logo, which drew two rings and shrank the mark to fit inside both.
            The tint still matters: several of these are white-on-transparent PNGs that all but
            vanish directly against AMOLED black. */}
        <CompanyLogo
          logoUrl={ipo.logoUrl}
          logoDomain={ipo.logoDomain}
          companyName={ipo.companyName}
          size={{ xs: 46, sm: 54 }}
          radius={2.5}
        />

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{
            fontSize: { xs: 17, sm: 22 }, fontWeight: 800, color: T.textPrimary,
            lineHeight: 1.25, letterSpacing: -0.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', wordBreak: 'break-word',
          }}>
            {ipo.companyName}
          </Typography>
          {/* Status, type and ticker wrap as one group beneath the name rather than competing with
              it for the same row — a long ticker ("BSE, NSE: ADANIENSOL") used to push the name
              into a two-line clamp on a phone. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.6 }}>
            <Box sx={{
              px: 1, py: 0.25, borderRadius: 999,
              bgcolor: meta.bg, border: `1px solid ${meta.color}55`,
            }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: meta.color, whiteSpace: 'nowrap' }}>
                {meta.label}
              </Typography>
            </Box>
            {typeMeta && (
              <Box sx={{ px: 0.9, py: 0.25, borderRadius: 999, bgcolor: typeMeta.bg }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: typeMeta.color, whiteSpace: 'nowrap' }}>
                  {typeMeta.label}
                </Typography>
              </Box>
            )}
            {ipo.tickerSymbol && (
              <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: T.tealBg, border: `1px solid ${T.teal}55` }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: T.teal, whiteSpace: 'nowrap' }}>
                  {formatExchange(ipo.listingExchange)}: {ipo.tickerSymbol}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {leadKey && (
        // Lead figure beside its supporting ones from md up (the page has the width for it there,
        // and pairing them keeps the hero one band tall), stacked below it on narrower screens.
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: subKeys.length ? 'minmax(0, 260px) 1fr' : '1fr' },
          gap: { xs: 1.5, md: 2.5 },
          mt: { xs: 2, sm: 2.25 },
        }}>
          <Box sx={{
            minWidth: 0,
            ...(subKeys.length > 0 && {
              pb: { xs: 1.5, md: 0 },
              borderBottom: { xs: `1px solid ${T.border}`, md: 'none' },
              pr: { md: 2.5 },
              borderRight: { md: `1px solid ${T.border}` },
            }),
          }}>
            {figureFor(leadKey, ipo, T, true, keys)}
          </Box>
          {subKeys.length > 0 && (
            <Box sx={{
              display: 'grid',
              // Tracks follow the available width rather than a guessed breakpoint. The 130px
              // floor is measured, not picked: it is the widest floor that still fits two tracks
              // in a 360px phone's content box, and it reaches three from roughly 500px up — which
              // is where these three figures stop needing a second row. `min(100%, …)` keeps a
              // track from ever exceeding the container, and `auto-fit` collapses the spare tracks
              // so two figures share the row evenly instead of hugging the left edge.
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
              columnGap: 2,
              rowGap: 1.75,
              alignSelf: 'center',
            }}>
              {subKeys.map((key) => (
                <Box key={key} sx={{ minWidth: 0 }}>{figureFor(key, ipo, T, false, keys)}</Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      <TimingStrip ipo={ipo} />
    </Box>
  );
}
