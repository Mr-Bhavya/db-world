import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import {
  AutoAwesomeRounded, InsightsRounded, CloudRounded, VpnKeyRounded,
  AccountBalanceWalletRounded, MovieRounded, TrendingUpRounded,
  NotificationsRounded, CloudUploadRounded, ScheduleRounded, TuneRounded,
  AppsRounded,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';

/** Sentinel for the "everything at once" rail entry. */
export const ALL = '__all__';

/**
 * Category → icon. Purely for scannability: ten near-identical text rows are much
 * harder to hit than ten rows with distinct shapes. Unknown categories (a new one
 * added to SettingsCatalog) fall back rather than breaking the rail.
 */
const ICONS = {
  'Recommendations':     AutoAwesomeRounded,
  'Activity Tracking':   InsightsRounded,
  'Weather':             CloudRounded,
  'CDN Signing':         VpnKeyRounded,
  'Document Wallet':     AccountBalanceWalletRounded,
  'Cinema':              MovieRounded,
  'IPO Tracker':         TrendingUpRounded,
  'Push Notifications':  NotificationsRounded,
  'Media Ingestion':     CloudUploadRounded,
  'Scheduler':           ScheduleRounded,
};
const iconFor = (category) => ICONS[category] ?? TuneRounded;

function RailButton({ icon: Icon, label, count, modified, selected, onClick }) {
  const T = useT();
  const S = adminSurface(T);
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        width: '100%', textAlign: 'left', cursor: 'pointer',
        border: 'none', borderRadius: 2, px: 1.25, py: 0.9,
        bgcolor: selected ? S.inset : 'transparent',
        color: selected ? T.text : T.textMuted,
        fontFamily: 'inherit',
        transition: 'background-color 120ms ease, color 120ms ease',
        '&:hover': { bgcolor: S.cardHover, color: T.text },
        // The selected row carries a teal edge rather than a fill, so the rail reads
        // as navigation and not as ten enabled toggles.
        boxShadow: selected ? `inset 2px 0 0 ${T.teal}` : 'none',
      }}
    >
      <Icon sx={{ fontSize: 17, flexShrink: 0, color: selected ? T.teal : T.textFaint }} />
      <Typography
        component="span"
        noWrap
        sx={{ flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: selected ? 700 : 500 }}
      >
        {label}
      </Typography>
      {modified > 0 && (
        <Tooltip title={`${modified} changed from default`}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: T.teal, flexShrink: 0 }} />
        </Tooltip>
      )}
      <Typography component="span" sx={{ fontSize: '0.7rem', color: T.textFaint, flexShrink: 0 }}>
        {count}
      </Typography>
    </Box>
  );
}

/**
 * Category navigation for the settings page.
 *
 * Desktop: a sticky vertical rail beside the list. Mobile: the same entries as a
 * horizontally scrolling chip strip above it, because a 220px rail alongside a
 * phone-width list is what produced the unreadable columns this page used to have.
 */
export default function CategoryRail({ categories, counts, selected, onSelect, isMobile }) {
  const T = useT();
  const S = adminSurface(T);

  const entries = [
    { id: ALL, label: 'All settings', icon: AppsRounded },
    ...categories.map((c) => ({ id: c, label: c, icon: iconFor(c) })),
  ];

  if (isMobile) {
    return (
      <Box sx={{
        display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5,
        // Hide the scrollbar but keep the scrolling — a visible bar under a chip
        // strip reads as a broken layout on touch.
        scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {entries.map(({ id, label, icon: Icon }) => {
          const c = counts[id] ?? { total: 0, modified: 0 };
          const selectedChip = selected === id;
          return (
            <Box
              key={id}
              component="button"
              type="button"
              onClick={() => onSelect(id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0,
                px: 1.25, py: 0.7, borderRadius: 999, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.76rem',
                fontWeight: selectedChip ? 700 : 500,
                border: `1px solid ${selectedChip ? T.teal : S.border}`,
                bgcolor: selectedChip ? S.inset : 'transparent',
                color: selectedChip ? T.text : T.textMuted,
              }}
            >
              <Icon sx={{ fontSize: 15, color: selectedChip ? T.teal : T.textFaint }} />
              {label}
              <Box component="span" sx={{ color: T.textFaint }}>{c.total}</Box>
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box sx={{
      position: 'sticky', top: 0, alignSelf: 'start',
      display: 'flex', flexDirection: 'column', gap: 0.25,
      bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3, p: 1,
    }}>
      {entries.map(({ id, label, icon }) => {
        const c = counts[id] ?? { total: 0, modified: 0 };
        return (
          <RailButton
            key={id}
            icon={icon}
            label={label}
            count={c.total}
            modified={c.modified}
            selected={selected === id}
            onClick={() => onSelect(id)}
          />
        );
      })}
    </Box>
  );
}
