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
  formatShortDate, formatPriceBand, formatPct, formatCurrency,
  statusMeta, ipoTypeMeta, daysLeftLabel, subscriptionMeta,
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
 * A labelled secondary stat. Labels sit at `textMuted`, not `textFaint`, on purpose — at 10.5px on
 * AMOLED black the fainter token was the single biggest readability problem, and 0.68 alpha clears
 * 4.5:1 against the card where 0.46 does not.
 */
function Stat({ label, children, align = 'left' }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0, textAlign: align }}>
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
 * Investorgain's 1–5 GMP rating as flames, on its OWN row beneath the figure — never inline beside
 * it. Sharing a line is exactly what truncated the value ("₹330 (+76.92…") once the grid narrowed.
 * Hidden when they haven't rated the issue.
 */
function GmpRating({ rating }) {
  const T = useT();
  if (rating == null || rating <= 0) return null;
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.2, mt: 0.4 }}
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
function HeroStat({ label, value, sub, color, children }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{
        fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
        letterSpacing: 0.6, fontWeight: 700, lineHeight: 1.4,
      }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.6, minWidth: 0, mt: 0.15 }}>
        <Typography sx={{
          fontSize: 26, fontWeight: 800, color: color ?? T.textPrimary, lineHeight: 1.15,
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
      {children}
    </Box>
  );
}

/** Subscription as a filling bar plus its multiple, tiered by `subscriptionMeta`. */
function SubscriptionBar({ subTotal, reduce }) {
  const T = useT();
  const meta = subscriptionMeta(subTotal, T);
  if (!meta) return <Value color={T.textFaint}>—</Value>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Box sx={{
        flex: 1, minWidth: 24, maxWidth: 68, height: 6, borderRadius: 999,
        bgcolor: T.glassHover, overflow: 'hidden',
      }}>
        <Box sx={{
          height: '100%', width: `${meta.fillPct}%`, borderRadius: 999, bgcolor: meta.color,
          boxShadow: meta.hot ? `0 0 8px ${meta.color}` : 'none',
          transition: reduce ? 'none' : 'width 0.45s cubic-bezier(0.32,0.72,0,1)',
        }} />
      </Box>
      <Typography sx={{
        fontSize: 14, fontWeight: 800, color: meta.color, flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }} noWrap>
        {subMultiple(subTotal)}
      </Typography>
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
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0,
      px: 0.9, py: 0.3, borderRadius: 999, bgcolor: meta.bg,
    }}>
      <Icon sx={{ fontSize: 12, color: meta.color }} />
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: meta.color, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );
}

/** GMP figure + percentage + rating. Used as the hero (upcoming/open) or as a secondary stat. */
function GmpBlock({ ipo, hero }) {
  const T = useT();
  const { color, Icon } = trendOf(ipo.gmp ?? ipo.gmpPct, T);
  if (ipo.gmp == null && ipo.gmpPct == null) {
    return hero
      ? <HeroStat label="Grey market premium" value="—" color={T.textFaint} />
      : <Stat label="GMP"><Value color={T.textFaint}>—</Value></Stat>;
  }
  const figure = ipo.gmp != null ? formatCurrency(ipo.gmp) : '—';
  const pct = ipo.gmpPct != null ? `(${formatPct(ipo.gmpPct)})` : null;

  if (hero) {
    return (
      <HeroStat label="Grey market premium" value={figure} sub={pct} color={color}>
        <GmpRating rating={ipo.gmpRating} />
      </HeroStat>
    );
  }
  return (
    <Stat label="GMP">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minWidth: 0 }}>
        <Icon sx={{ fontSize: 15, color, flexShrink: 0 }} />
        <Value color={color} mono>{figure}{pct ? ` ${pct}` : ''}</Value>
      </Box>
    </Stat>
  );
}

/**
 * Picks the hero figure and the two secondary stats from the IPO's lifecycle stage.
 *
 * This is the substance of the redesign, not a cosmetic tweak. The old card showed the same four
 * cells (price band / lot size / GMP / subscription) at every stage, which guaranteed dead ones: an
 * upcoming IPO has no subscription yet and a listed one has no grey market, so a quarter to a half
 * of every card was an em dash. Each stage now leads with the figure that stage is about and fills
 * the rest with what's genuinely known; price band and lot size move to the always-present meta
 * line below, still available but no longer competing for the eye.
 */
function cardStats(ipo, T, reduce) {
  switch (ipo.status) {
    case 'open':
      return {
        hero: <GmpBlock ipo={ipo} hero />,
        stats: [
          <Stat key="sub" label="Subscription"><SubscriptionBar subTotal={ipo.subTotal} reduce={reduce} /></Stat>,
          <Stat key="close" label="Closes" align="right"><Value>{formatShortDate(ipo.closeDate) ?? '—'}</Value></Stat>,
        ],
      };
    case 'closed':
      return {
        hero: (
          <HeroStat
            label="Final subscription"
            value={subMultiple(ipo.subTotal) ?? '—'}
            color={subscriptionMeta(ipo.subTotal, T)?.color ?? T.textFaint}
          />
        ),
        stats: [
          <GmpBlock key="gmp" ipo={ipo} />,
          <Stat key="allot" label="Allotment" align="right"><Value>{formatShortDate(ipo.allotmentDate) ?? '—'}</Value></Stat>,
        ],
      };
    case 'listed':
      return {
        hero: (
          <HeroStat
            label="Listing gain"
            value={ipo.listingGainPct != null ? formatPct(ipo.listingGainPct) : '—'}
            color={ipo.listingGainPct != null ? trendOf(ipo.listingGainPct, T).color : T.textFaint}
          />
        ),
        stats: [
          <Stat key="lp" label="Listed at"><Value mono>{formatCurrency(ipo.listingPrice) ?? '—'}</Value></Stat>,
          <Stat key="sub" label="Subscription" align="right">
            <Value color={subscriptionMeta(ipo.subTotal, T)?.color} mono>
              {subMultiple(ipo.subTotal) ?? '—'}
            </Value>
          </Stat>,
        ],
      };
    case 'upcoming':
    default:
      return {
        hero: <GmpBlock ipo={ipo} hero />,
        stats: [
          <Stat key="open" label="Opens"><Value>{formatShortDate(ipo.openDate) ?? '—'}</Value></Stat>,
          <Stat key="close" label="Closes" align="right"><Value>{formatShortDate(ipo.closeDate) ?? '—'}</Value></Stat>,
        ],
      };
  }
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
  const dateLabel = keyDateLabel(ipo);
  const priceBand = formatPriceBand(ipo.priceMin, ipo.priceMax);

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
            borderColor: `${meta.color}66`,
            bgcolor: T.glassHover,
            boxShadow: `0 10px 30px -12px ${meta.color}55`,
          },
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          // Status accent as a top edge rather than a left strip: at the narrow widths the old
          // fixed 4-column grid produced, a left border ate into already-tight horizontal space.
          '&::before': {
            content: '""',
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${meta.color}, ${meta.color}00)`,
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

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}>
          {stats}
        </Box>

        <Box sx={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5,
          mt: 'auto', pt: 1.25, borderTop: `1px solid ${T.border}`,
        }}>
          {priceBand && (
            <Typography component="span" sx={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }} noWrap>
              {priceBand}
            </Typography>
          )}
          {priceBand && ipo.lotSize != null && (
            <Typography component="span" sx={{ fontSize: 12, color: T.textFaint }}>·</Typography>
          )}
          {ipo.lotSize != null && (
            <Typography component="span" sx={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }} noWrap>
              {ipo.lotSize} shares/lot
            </Typography>
          )}
        </Box>

        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 0.75, flexWrap: 'wrap',
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
