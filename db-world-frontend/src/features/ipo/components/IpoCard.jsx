import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import {
  formatShortDate, formatPriceBand, formatPct, formatCurrency, formatExchange,
  statusMeta, ipoTypeMeta, daysLeftLabel, subscriptionMeta, isClosingToday,
} from '../utils/format';
import { saveListScrollForBack } from '../utils/listScrollRestore';
import CompanyLogo from './CompanyLogo';

/**
 * Subscription multiple for an at-a-glance read: one decimal and a true multiplication sign,
 * `1.5×`. Deliberately NOT the shared `formatMultiplier`, which renders `1.51x` — two
 * decimals and a Latin "x" are right for the detail page's precise day-wise tables and too
 * noisy on a card you are meant to scan.
 */
const subMultiple = (n) => (n == null ? null : `${Number(n).toFixed(1)}×`);

/** Direction of a signed number as a {colour, icon} pair, so every signed figure reads alike. */
function trendOf(value, T) {
  const positive = value != null && value > 0;
  const negative = value != null && value < 0;
  return {
    color: positive ? T.success : negative ? T.error : T.textMuted,
    Icon: positive ? TrendingUpRoundedIcon : negative ? TrendingDownRoundedIcon : TrendingFlatRoundedIcon,
  };
}

/** Lifecycle badge. */
function StatusBadge({ status }) {
  const T = useT();
  const meta = statusMeta(status, T);
  return (
    <Box sx={{
      flexShrink: 0, px: 1.1, py: 0.35, borderRadius: 999,
      bgcolor: meta.bg, border: `1px solid ${meta.color}44`,
    }}>
      <Typography sx={{
        fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: 0.2, lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}>
        {meta.label}
      </Typography>
    </Box>
  );
}

/**
 * A labelled secondary stat. Every one is left-aligned: right-aligning the second column looked
 * tidy until a full-width row (the subscription bar) joined them, at which point the card read
 * left / right / left and the interior went ragged. One alignment, one edge to scan down.
 *
 * Labels sit at `textMuted`, not `textFaint` — at 10.5px on AMOLED black the fainter token was the
 * single biggest readability problem, and 0.68 alpha clears 4.5:1 against the card where 0.46 does
 * not.
 */
function Stat({ label, children }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{
        fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
        letterSpacing: 0.6, fontWeight: 700, lineHeight: 1.4,
      }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.35 }}>{children}</Box>
    </Box>
  );
}

/** Secondary value — 14px, so it reads as data rather than as a caption. */
function Value({ children, color, mono = false }) {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: 14, fontWeight: 700, color: color ?? T.textPrimary, lineHeight: 1.3,
      fontVariantNumeric: mono ? 'tabular-nums' : undefined,
    }} noWrap>
      {children}
    </Typography>
  );
}

/**
 * Investorgain's 1–5 GMP rating as flames. Rendered on the hero's LABEL row, not beside the figure
 * (which truncated it) and not on a row of its own (which cost every card a line of height for one
 * glyph). Hidden when they haven't rated the issue.
 */
function GmpRating({ rating }) {
  const T = useT();
  if (rating == null || rating <= 0) return null;
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.15, flexShrink: 0 }}
      aria-label={`Investorgain GMP rating ${rating} out of 5`}
    >
      {Array.from({ length: Math.min(rating, 5) }).map((_, i) => (
        <LocalFireDepartmentRoundedIcon key={i} sx={{ fontSize: 13, color: T.warning }} />
      ))}
    </Box>
  );
}

/**
 * The card's single largest number — whichever one this IPO's stage is actually about. At 26px it's
 * what the eye lands on first, which a flat grid of equal-weight 13px values never gave you.
 */
function HeroStat({ label, value, sub, color, right, badge }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      {/* Label row carries the badge (the flame rating) on its right. Giving the rating its own
          third row made every card taller for no information, and putting it inline with the
          FIGURE is what truncated the figure. The label is short, so this is the free space. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: 0.6, fontWeight: 700, lineHeight: 1.4,
        }} noWrap>
          {label}
        </Typography>
        {badge}
      </Box>
      {/* Value row carries the companion figure on its right, on the same baseline. */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.25, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.6, minWidth: 0 }}>
          <Typography sx={{
            fontSize: 26, fontWeight: 800, color: color ?? T.textPrimary, lineHeight: 1.2,
            letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums',
          }} noWrap>
            {value}
          </Typography>
          {sub && (
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: color ?? T.textMuted, opacity: 0.85 }} noWrap>
              {sub}
            </Typography>
          )}
        </Box>
        {right && (
          <Typography sx={{
            fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }} noWrap>
            <Box component="span" sx={{ color: T.textFaint, fontWeight: 600 }}>{right.label} </Box>
            {right.value}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** Subscription as a filling bar plus its multiple, tiered by `subscriptionMeta`. */
function SubscriptionBar({ subTotal, reduce }) {
  const T = useT();
  const meta = subscriptionMeta(subTotal, T);
  if (!meta) return <Value color={T.textFaint}>—</Value>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography sx={{
        fontSize: 14, fontWeight: 800, color: meta.color, flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }} noWrap>
        {subMultiple(subTotal)}
      </Typography>
      {/* Fills the rest of its own cell, which is now one of three even columns rather than a
          full-width spanned row — the same bar across ~300px read as a loading bar, not a gauge. */}
      <Box sx={{
        flex: 1, minWidth: 20, maxWidth: 72, height: 6, borderRadius: 999,
        bgcolor: T.glassHover, overflow: 'hidden',
      }}>
        <Box sx={{
          height: '100%', width: `${meta.fillPct}%`, borderRadius: 999, bgcolor: meta.color,
          boxShadow: meta.hot ? `0 0 8px ${meta.color}` : 'none',
          transition: reduce ? 'none' : 'width 0.45s cubic-bezier(0.32,0.72,0,1)',
        }} />
      </Box>
    </Box>
  );
}

/** "25 Aug – 28 Aug 2026", or the listing date once listed. */
function keyDateLabel(ipo) {
  if (ipo.status === 'listed' && ipo.listingDate) return `Listed ${formatShortDate(ipo.listingDate)}`;
  if (ipo.openDate && ipo.closeDate) return `${formatShortDate(ipo.openDate)} – ${formatShortDate(ipo.closeDate)}`;
  if (ipo.openDate) return `Opens ${formatShortDate(ipo.openDate)}`;
  if (ipo.closeDate) return `Closes ${formatShortDate(ipo.closeDate)}`;
  return null;
}

/** Countdown pill — a clock while something is still counting down, a calendar-check after. */
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
      display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0,
      px: 0.9, py: 0.3, borderRadius: 999,
      bgcolor: urgent ? T.errorBg : meta.bg,
      border: urgent ? `1px solid ${T.error}55` : 'none',
    }}>
      <Icon sx={{ fontSize: 12, color }} />
      <Typography sx={{ fontSize: 11, fontWeight: 800, color, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );
}

/**
 * The GMP hero: figure, percentage, flame rating, and — in the companion slot — whichever
 * GMP-adjacent number we actually have. Investorgain's own estimated listing price is preferred
 * (it is reported, not computed here); its low/high GMP range for the cycle is the fallback, since
 * report 331 carries that for every live row even when the per-IPO estimate hasn't been fetched yet.
 */
function GmpHero({ ipo }) {
  const T = useT();
  const { color } = trendOf(ipo.gmp ?? ipo.gmpPct, T);

  let right = null;
  if (ipo.estimatedListingPrice != null) {
    right = { label: 'Est. listing', value: formatCurrency(ipo.estimatedListingPrice) };
  } else if (ipo.gmpMin != null && ipo.gmpMax != null) {
    right = { label: 'GMP range', value: `${formatCurrency(ipo.gmpMin)}–${formatCurrency(ipo.gmpMax)}` };
  }

  return (
    <HeroStat
      label="Grey market premium"
      value={formatCurrency(ipo.gmp) ?? formatPct(ipo.gmpPct)}
      sub={ipo.gmp != null && ipo.gmpPct != null ? `(${formatPct(ipo.gmpPct)})` : null}
      color={color}
      right={right}
      badge={<GmpRating rating={ipo.gmpRating} />}
    />
  );
}

/**
 * Chooses the hero figure and the secondary stats for one IPO.
 *
 * ONE RULE, APPLIED TO EVERYTHING: a metric is only ever offered when its value exists. Each stage
 * lists more candidates than it can show, most relevant first, and the first available ones win.
 * There is therefore no combination of missing data that can render an em dash — not in a stat cell,
 * and not (as an earlier version managed for 19 of 34 real cards) as a 26px "—" where the headline
 * number should be, which is the single most conspicuous place to put a hole.
 *
 * The hero's metric is removed from the stat candidates, so nothing is shown twice.
 */
function cardStats(ipo, T, reduce) {
  const priceBand = formatPriceBand(ipo.priceMin, ipo.priceMax);
  const subColor = subscriptionMeta(ipo.subTotal, T)?.color;
  const gmpTrend = trendOf(ipo.gmp ?? ipo.gmpPct, T);

  // Each metric knows whether it has a value, and how to render as either the hero or a stat.
  const metrics = {
    gmp: {
      has: ipo.gmp != null || ipo.gmpPct != null,
      hero: () => <GmpHero ipo={ipo} />,
      stat: () => (
        <Stat key="gmp" label="GMP">
          <Value color={gmpTrend.color} mono>{formatCurrency(ipo.gmp)}</Value>
        </Stat>
      ),
    },
    subscription: {
      has: ipo.subTotal != null,
      hero: () => (
        <HeroStat
          label={ipo.status === 'open' ? 'Subscription' : 'Final subscription'}
          value={subMultiple(ipo.subTotal)}
          color={subColor}
          right={ipo.gmp != null ? { label: 'GMP', value: formatCurrency(ipo.gmp) } : null}
        />
      ),
      stat: () => (
        <Stat key="sub" label={ipo.status === 'open' ? 'Subscription' : 'Final subscription'}>
          {ipo.status === 'open'
            ? <SubscriptionBar subTotal={ipo.subTotal} reduce={reduce} />
            : <Value color={subColor} mono>{subMultiple(ipo.subTotal)}</Value>}
        </Stat>
      ),
    },
    listingGain: {
      has: ipo.listingGainPct != null,
      hero: () => (
        <HeroStat
          label="Listing gain"
          value={formatPct(ipo.listingGainPct)}
          color={trendOf(ipo.listingGainPct, T).color}
          right={ipo.listingPrice != null
            ? { label: 'Listed at', value: formatCurrency(ipo.listingPrice) }
            : null}
        />
      ),
      stat: () => (
        <Stat key="gain" label="Listing gain">
          <Value color={trendOf(ipo.listingGainPct, T).color} mono>{formatPct(ipo.listingGainPct)}</Value>
        </Stat>
      ),
    },
    listingPrice: {
      has: ipo.listingPrice != null,
      hero: () => <HeroStat label="Listed at" value={formatCurrency(ipo.listingPrice)} />,
      stat: () => (
        <Stat key="lp" label="Listed at"><Value mono>{formatCurrency(ipo.listingPrice)}</Value></Stat>
      ),
    },
    priceBand: {
      has: priceBand != null,
      hero: () => <HeroStat label="Price band" value={priceBand} />,
      stat: () => <Stat key="band" label="Price band"><Value mono>{priceBand}</Value></Stat>,
    },
    lotSize: {
      has: ipo.lotSize != null,
      stat: () => <Stat key="lot" label="Lot size"><Value mono>{`${ipo.lotSize} sh`}</Value></Stat>,
    },
    allotment: {
      has: ipo.allotmentDate != null,
      stat: () => (
        <Stat key="allot" label="Allotment"><Value>{formatShortDate(ipo.allotmentDate)}</Value></Stat>
      ),
    },
    listsOn: {
      has: ipo.listingDate != null,
      stat: () => <Stat key="lists" label="Lists on"><Value>{formatShortDate(ipo.listingDate)}</Value></Stat>,
    },
    exchange: {
      has: !!ipo.listingExchange,
      stat: () => (
        <Stat key="exch" label="Exchange"><Value>{formatExchange(ipo.listingExchange)}</Value></Stat>
      ),
    },
  };

  // Hero candidates then stat candidates, per stage — richest first, each falling back gracefully.
  const ORDER = {
    upcoming: { hero: ['gmp', 'priceBand'], stats: ['priceBand', 'lotSize', 'exchange'] },
    open: { hero: ['gmp', 'subscription', 'priceBand'], stats: ['subscription', 'priceBand', 'lotSize'] },
    closed: {
      hero: ['subscription', 'gmp', 'priceBand'],
      stats: ['allotment', 'listsOn', 'lotSize', 'priceBand', 'exchange'],
    },
    listed: {
      hero: ['listingGain', 'listingPrice', 'subscription', 'priceBand'],
      stats: ['subscription', 'lotSize', 'priceBand', 'exchange', 'listingPrice'],
    },
  };
  const order = ORDER[ipo.status] ?? ORDER.upcoming;

  const heroKey = order.hero.find((k) => metrics[k]?.has);
  const hero = heroKey ? metrics[heroKey].hero() : null;
  const stats = order.stats
    .filter((k) => k !== heroKey && metrics[k]?.has)
    .slice(0, 3)
    .map((k) => metrics[k].stat());

  return { hero, stats };
}

/**
 * One IPO in the list.
 *
 * Layout is stage-driven (see `cardStats`) rather than a fixed stat grid, and the type scale steps
 * rather than sitting flat: a 26px hero figure, 14px secondary values, 10.5px labels at `textMuted`.
 * The previous card put six pieces of data at near-identical weight in 10–13px `textFaint`, which is
 * why a wide screen full of them was hard to read.
 *
 * Motion is opt-out: every entry offset and hover lift drops under `prefers-reduced-motion`, the
 * same way `adminUi` and the admin dashboard already behave.
 */
export default function IpoCard({ ipo, index = 0 }) {
  const T = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const meta = statusMeta(ipo.status, T);
  const typeMeta = ipoTypeMeta(ipo.ipoType, T);
  const { hero, stats } = cardStats(ipo, T, reduce);
  // A same-day bidding deadline is the one thing on this screen the user can still miss, so it
  // overrides the status accent with the alert colour instead of sharing "open"'s calm green.
  const urgent = isClosingToday(ipo);
  const accent = urgent ? T.error : meta.color;
  const dateLabel = keyDateLabel(ipo);

  // Remember the list's current scroll position before leaving it for this IPO's detail page, so a
  // subsequent in-app "back" (see `IpoDetailPage`'s back action) can restore it — see
  // `listScrollRestore.js` for why this has to be scoped to this exact navigation.
  const goToDetail = () => {
    saveListScrollForBack();
    navigate(Constants.ipoDetailPath(ipo.id));
  };

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Stagger caps at 8 cards: uncapped, a 40-IPO list spends over a second dribbling rows in,
      // which reads as jank rather than polish.
      transition={{
        duration: reduce ? 0.15 : 0.3,
        delay: reduce ? 0 : Math.min(index, 8) * 0.035,
        ease: 'easeOut',
      }}
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={reduce ? undefined : { scale: 0.995 }}
      style={{ height: '100%', width: '100%', minWidth: 0 }}
    >
      <Box
        onClick={goToDetail}
        role="button"
        tabIndex={0}
        aria-label={`View ${ipo.companyName} details`}
        onKeyDown={(e) => {
          // Only react to keydowns landing directly on the card surface — there's no nested
          // interactive element today, but guarding on `e.target === e.currentTarget` keeps this
          // safe if one is ever added.
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goToDetail();
          }
        }}
        sx={{
          position: 'relative',
          bgcolor: T.glass,
          border: `1px solid ${T.border}`,
          borderRadius: 3.5,
          cursor: 'pointer',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          p: { xs: 1.75, sm: 2 },
          overflow: 'hidden',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
          '&:hover': {
            borderColor: `${accent}66`,
            bgcolor: T.glassHover,
            boxShadow: `0 10px 30px -12px ${accent}55`,
          },
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          // Status accent as a top edge rather than a left strip: at the narrow widths the old
          // fixed 4-column grid produced, a left border ate into already-tight horizontal space.
          '&::before': {
            content: '""',
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${accent}, ${accent}00)`,
            // A closing-today card gets a solid edge rather than a fade, so the row reads as "this
            // one is different" before you've read a word of it. Colour and fill only — making it
            // taller as well pushed that card's content a pixel below its neighbours'.
            ...(urgent && { background: accent }),
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
          {/* Bordered, tinted well behind the logo — several of these are white-on-transparent
              PNGs that all but vanished directly against AMOLED black. */}
          <Box sx={{
            width: 42, height: 42, borderRadius: 2, flexShrink: 0, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: T.glassHover, border: `1px solid ${T.border}`,
          }}>
            <CompanyLogo logoUrl={ipo.logoUrl} logoDomain={ipo.logoDomain} companyName={ipo.companyName} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {/* Two lines then ellipsis — a truncated name ("ESDS Software Solution Li…") is worse
                than a slightly taller card. */}
            <Typography sx={{
              fontSize: { xs: 15, sm: 15.5 }, fontWeight: 800, color: T.textPrimary,
              lineHeight: 1.3, letterSpacing: -0.2,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {ipo.companyName}
            </Typography>
            {typeMeta && (
              <Typography sx={{
                display: 'inline-block', mt: 0.5, px: 0.85, py: 0.15, borderRadius: 1,
                fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3,
                color: typeMeta.color, bgcolor: typeMeta.bg,
              }}>
                {typeMeta.label}
              </Typography>
            )}
          </Box>
          <StatusBadge status={ipo.status} />
        </Box>

        {hero}

        {stats.length > 0 && (
          // One row of as many even columns as there are stats. A fixed 2-up grid left the third
          // stat alone on its own row: spanning it produced a ~300px progress bar that dominated
          // the card, and not spanning it left half a row empty. Even columns are neither.
          //
          // First flush left, last flush right, any middle centred. With equal tracks and every
          // cell left-aligned, a wide value in the first column (a price band like ₹546–₹575 nearly
          // fills its track) ended up 10px from the next column's label and the two read as one
          // crowded block. Anchoring the outer columns to the card's own edges puts the free space
          // BETWEEN the values instead of trailing after each one.
          //
          // Safe now in a way it wasn't earlier: every row is a uniform N columns, so there is no
          // full-width spanning cell left to make the alignment look ragged. The subscription bar
          // is a flex row that textAlign can't move, but it is only ever built as the FIRST stat
          // (open IPOs), which stays left-aligned.
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0, 1fr))`,
            columnGap: 1.5,
            '& > *:last-child': { textAlign: stats.length > 1 ? 'right' : 'left' },
            '& > *:not(:first-of-type):not(:last-child)': { textAlign: 'center' },
          }}>
            {stats}
          </Box>
        )}

        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 0.75, flexWrap: 'wrap',
          mt: 'auto', pt: 1.25, borderTop: `1px solid ${T.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <CalendarTodayRoundedIcon sx={{ fontSize: 13, color: T.textFaint, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11.5, color: T.textMuted }} noWrap>
              {dateLabel ?? '—'}
            </Typography>
          </Box>
          <DaysLeftPill ipo={ipo} />
        </Box>
      </Box>
    </motion.div>
  );
}
