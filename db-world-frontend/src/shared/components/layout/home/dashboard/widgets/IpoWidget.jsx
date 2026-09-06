import React from 'react';
import { Box, Skeleton, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Schedule as ClockIcon } from '@mui/icons-material';

import { ipoDetailPath } from '@shared/constants';
import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';
import { Stat, StatRow, WidgetChip, WidgetFallback, WidgetNote } from '../widgetParts';

const fmtPct = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`;
};

/** Whole days from today to `date`, or null if there is no usable date. */
const daysUntil = (date) => {
  if (!date) return null;

  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((target - today) / 86_400_000);
};

const inDays = (days, verb) => {
  if (days === null) return null;
  if (days < 0) return verb === 'Closes' ? 'Closed' : 'Opened';
  if (days === 0) return `${verb} today`;
  if (days === 1) return `${verb} tomorrow`;
  return `${verb} in ${days}d`;
};

/** The one date that matters for an issue: when bidding shuts, or when it starts. */
const timingLabel = (ipo) =>
  ipo.status === 'open'
    ? inDays(daysUntil(ipo.closeDate), 'Closes')
    : inDays(daysUntil(ipo.openDate), 'Opens');

/** One row of the large tile's list: name over its timing, with the premium on the right. */
function IpoRow({ ipo, onOpen }) {
  const T = useT();
  const pct = fmtPct(ipo.gmpPct);
  const positive = Number(ipo.gmpPct) >= 0;
  const isOpen = ipo.status === 'open';

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Open ${ipo.companyName}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(ipo);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        onOpen(ipo);
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 0.75,
        py: 0.5,
        borderRadius: 1.4,
        cursor: 'pointer',
        minWidth: 0,
        '&:hover': { bgcolor: T.glassHover },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 1 },
      }}
    >
      {/* Status dot — live issues read at a glance without a second chip. */}
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: isOpen ? T.success : T.textFaint,
          ...(isOpen && { boxShadow: `0 0 8px ${T.success}` }),
        }}
      />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            color: T.textPrimary,
            fontSize: { xs: '0.76rem', sm: '0.82rem' },
            fontWeight: 800,
            lineHeight: 1.25,
            ...clampTextSx(1),
          }}
        >
          {ipo.companyName}
        </Typography>
        <Typography sx={{ color: T.textFaint, fontSize: '0.66rem', fontWeight: 600 }}>
          {timingLabel(ipo)}
        </Typography>
      </Box>

      {pct && <WidgetChip label={pct} color={positive ? T.success : T.error} />}
    </Box>
  );
}

/**
 * IPO Radar's tile: how many issues are live, plus the ones an investor actually has to decide
 * about. The large tile lists them — open issues by soonest close, then upcoming — because a
 * dashboard tile that only says "6 open" makes you open the app to learn anything.
 *
 * Public data, so this is identical signed in or out.
 */
export default function IpoWidget({ widget, summary, isLoading, onNavigate, ...shell }) {
  const T = useT();
  const theme = useTheme();
  const ipo = summary?.ipo;
  const isLarge = widget.size === 'lg';

  // A large tile is two grid rows, and those rows are shorter on a phone (128px vs 164px). Four
  // list rows fit the desktop tile and overflow the phone one, where the card clips rather than
  // scrolls — so the phone shows three.
  const listRows = useMediaQuery(theme.breakpoints.down('sm')) ? 3 : 4;

  if (!ipo && !isLoading) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const closing = ipo?.closingSoon;
  const closingDays = daysUntil(closing?.closeDate);
  const topGmpPct = fmtPct(ipo?.topGmp?.gmpPct);
  const gmpPositive = Number(ipo?.topGmp?.gmpPct) >= 0;
  const actionable = ipo?.actionable ?? [];

  return (
    <WidgetShell widget={widget} {...shell}>
      <StatRow>
        <Stat
          loading={isLoading}
          value={ipo?.open ?? 0}
          label="Open now"
          color={widget.accent}
          compact={!isLarge}
        />
        <Stat loading={isLoading} value={ipo?.upcoming ?? 0} label="Upcoming" compact={!isLarge} />
        <Stat
          loading={isLoading}
          value={topGmpPct ?? '—'}
          label="Top GMP"
          color={topGmpPct ? (gmpPositive ? T.success : T.error) : T.textMuted}
          compact={!isLarge}
        />
      </StatRow>

      {/* Small and medium tiles have room for one line, so it goes to the most urgent thing. */}
      {!isLarge && !isLoading && closing && (
        <WidgetNote icon={ClockIcon} color={closingDays !== null && closingDays <= 1 ? T.error : undefined}>
          {inDays(closingDays, 'Closes')} · {closing.companyName}
        </WidgetNote>
      )}

      {/* The large tile's list gets its own placeholder rows; without them the tile loaded as a
          stat row over empty space and then jumped to twice the content. */}
      {isLarge && isLoading && (
        <Box sx={{ mt: 1.4, pt: 1.2, borderTop: `1px solid ${T.glassBorder}`, minWidth: 0 }}>
          <Skeleton variant="text" width={110} height={14} sx={{ bgcolor: T.glassHover, ml: 0.75, mb: 0.4 }} />

          {Array.from({ length: listRows }, (_, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.75, py: 0.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton variant="text" width="65%" height={16} sx={{ bgcolor: T.glassHover }} />
                <Skeleton variant="text" width="30%" height={12} sx={{ bgcolor: T.glassHover }} />
              </Box>
              <Skeleton variant="rounded" width={52} height={20} sx={{ bgcolor: T.glassHover }} />
            </Box>
          ))}
        </Box>
      )}

      {isLarge && !isLoading && actionable.length > 0 && (
        <Box sx={{ mt: 1.4, pt: 1.2, borderTop: `1px solid ${T.glassBorder}`, minWidth: 0 }}>
          <Typography
            sx={{
              color: T.textMuted,
              fontSize: '0.62rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              px: 0.75,
              mb: 0.4,
            }}
          >
            Still open to you
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, minWidth: 0 }}>
            {actionable.slice(0, listRows).map((row) => (
              <IpoRow
                key={row.id}
                ipo={row}
                onOpen={(target) => onNavigate?.(ipoDetailPath(target.id))}
              />
            ))}
          </Box>
        </Box>
      )}

      {!isLoading && actionable.length === 0 && !closing && (
        <WidgetNote>No issues open right now — check back for upcoming ones.</WidgetNote>
      )}
    </WidgetShell>
  );
}
