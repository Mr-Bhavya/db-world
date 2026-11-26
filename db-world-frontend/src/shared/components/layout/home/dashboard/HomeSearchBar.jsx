import React from 'react';
import { Box, Typography } from '@mui/material';
import { SearchRounded as SearchIcon } from '@mui/icons-material';

import { useT } from '@shared/theme';
import { openSearch } from '@shared/components/layout/header/searchLauncher';

const isApplePlatform = () =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? '');

/**
 * The hub's search entry point: a full-width, thumb-reachable bar under the greeting.
 *
 * It is a button that opens the global palette rather than an input of its own, so there is one
 * search implementation (results, keyboard handling, recents) wherever it is opened from — the
 * header icon, ⌘K / Ctrl K, or here.
 */
export default function HomeSearchBar() {
  const T = useT();
  const shortcut = isApplePlatform() ? '⌘ K' : 'Ctrl K';

  return (
    <Box
      component="button"
      type="button"
      onClick={openSearch}
      aria-label="Search apps, movies, series and IPOs"
      aria-haspopup="dialog"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        width: '100%',
        maxWidth: { sm: 720 },
        height: { xs: 50, sm: 54 },
        px: { xs: 1.75, sm: 2 },
        cursor: 'text',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: T.textMuted,
        bgcolor: T.glass,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 3,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
        '&:hover': {
          borderColor: T.teal,
          boxShadow: `0 10px 30px ${T.teal}26`,
        },
        '&:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: T.tealBg,
          color: T.teal,
          flexShrink: 0,
        }}
      >
        <SearchIcon sx={{ fontSize: 20 }} />
      </Box>

      <Typography
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          color: T.textMuted,
          fontSize: { xs: '0.92rem', sm: '0.98rem' },
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        Search apps, movies, series, IPOs…
      </Typography>

      <Box
        component="kbd"
        aria-hidden
        sx={{
          display: { xs: 'none', md: 'inline-flex' },
          alignItems: 'center',
          px: 0.9,
          py: 0.3,
          borderRadius: 1,
          border: `1px solid ${T.border}`,
          color: T.textFaint,
          fontFamily: 'inherit',
          fontSize: '0.72rem',
          fontWeight: 800,
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}
      >
        {shortcut}
      </Box>
    </Box>
  );
}
