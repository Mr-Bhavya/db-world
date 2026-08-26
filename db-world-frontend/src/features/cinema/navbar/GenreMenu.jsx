// Genre picker — a grid of tappable tiles. Bottom sheet on mobile, anchored
// popover on desktop.
//
// Every tile is a real <a href> to a genre landing page, so middle-click and
// "open in new tab" behave and the URL is shareable. The parent owns path
// building (only it knows which section the user is browsing) and passes it in
// as `hrefFor` / `allHref`.
//
// Tiles rather than a bare text list: at 48px each they clear the touch-target
// minimum, the active genre can be shown as a filled state instead of a stray
// tick, and the panel stops looking like a context menu. Note this also swaps
// the old CSS multi-column layout (which flowed column-major, A→Z down each
// column) for a grid, so the list now reads left-to-right — the natural order
// for chips.

import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, IconButton, ButtonBase, Popover, Drawer,
  alpha, useTheme, useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon, Check as CheckIcon, DoneAll as AllIcon } from '@mui/icons-material';

const PANEL_BG = '#0b0b0b';

const GenreTile = ({ label, href, active, onPick, wide, icon }) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  return (
    <ButtonBase
      component={RouterLink}
      to={href}
      onClick={onPick}
      aria-current={active ? 'page' : undefined}
      sx={{
        gridColumn: wide ? '1 / -1' : 'auto',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 1,
        minHeight: 48,
        px: 1.5,
        py: 1,
        textAlign: 'left',
        borderRadius: 2,
        border: `1px solid ${active ? alpha(accent, 0.55) : alpha('#fff', 0.09)}`,
        bgcolor: active ? alpha(accent, 0.16) : alpha('#fff', 0.05),
        color: active ? alpha(accent, 0.95) : 'rgba(255,255,255,0.88)',
        fontSize: '0.86rem',
        fontWeight: active ? 700 : 500,
        lineHeight: 1.3,
        transition: 'background 0.16s ease, border-color 0.16s ease, color 0.16s ease',
        '&:hover': {
          bgcolor: active ? alpha(accent, 0.22) : alpha('#fff', 0.1),
          borderColor: active ? alpha(accent, 0.7) : alpha('#fff', 0.18),
        },
        '&.Mui-focusVisible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
      }}
    >
      {icon && <Box sx={{ display: 'flex', flexShrink: 0, '& svg': { fontSize: '1.05rem' } }}>{icon}</Box>}
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </Box>
      {active && <CheckIcon sx={{ fontSize: '1rem', flexShrink: 0 }} />}
    </ButtonBase>
  );
};

/** Header + "All" reset + the tile grid. Shared by both layouts. */
function GenreGrid({ categories, selectedId, allLabel, allHref, hrefFor, onPick, onClose, columns, showClose }) {
  const sorted = useMemo(
    () => [...categories].sort((a, b) => (a?.name ?? '').localeCompare(b?.name ?? '')),
    [categories],
  );

  return (
    <Box component="nav" aria-label="Genres" sx={{ px: 2, pb: 2, pt: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
        <Typography sx={{
          flex: 1,
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: alpha('#fff', 0.45),
        }}>
          Browse by genre
        </Typography>
        {showClose && (
          <IconButton size="small" onClick={onClose} aria-label="Close genres"
            sx={{ color: alpha('#fff', 0.45), '&:hover': { color: '#fff' } }}>
            <CloseIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>
        )}
      </Box>

      {sorted.length === 0 ? (
        <Typography sx={{ py: 2, fontSize: '0.82rem', color: alpha('#fff', 0.45) }}>
          No genres yet.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 1,
            maxHeight: 'min(58vh, 480px)',
            overflowY: 'auto',
            // The scrollbar is a chrome detail inside a dark panel — hide it.
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            // Keep the sticky "All" tile from clipping its focus ring.
            px: '2px',
            mx: '-2px',
          }}
        >
          {/* Reset spans the full width so it reads as a header, not a genre. */}
          <GenreTile
            label={allLabel}
            href={allHref}
            active={!selectedId}
            onPick={() => onPick(null)}
            icon={<AllIcon />}
            wide
          />

          {sorted.map((genre) => (
            <GenreTile
              key={genre.id}
              label={genre.name}
              href={hrefFor(genre)}
              active={genre.id === selectedId}
              onPick={() => onPick(genre)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Props:
 *   anchorEl   — DOM element the desktop popover anchors to (null = closed)
 *   categories — [{ id, name }] for the section currently being browsed
 *   selectedId — id of the active genre, or null on the unfiltered page
 *   allLabel   — label of the reset entry, e.g. "All Movies"
 *   allHref    — path of the unfiltered section page
 *   hrefFor    — (genre) => landing-page path
 *   onPick     — (genre|null) called after the link navigates
 *   onClose    — close the panel
 */
const GenreMenu = ({ anchorEl, categories = [], selectedId = null, allLabel = 'All', allHref, hrefFor, onPick, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const open = Boolean(anchorEl);

  const handlePick = (genre) => {
    onPick?.(genre);
    onClose?.();
  };

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            background: PANEL_BG,
            backgroundImage: 'none',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTop: `1px solid ${alpha('#fff', 0.08)}`,
            maxHeight: '76vh',
            // Clear the floating bottom nav pill + the gesture bar.
            pb: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          },
        }}
      >
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: alpha('#fff', 0.2) }} />
        </Box>
        <GenreGrid
          categories={categories}
          selectedId={selectedId}
          allLabel={allLabel}
          allHref={allHref}
          hrefFor={hrefFor}
          onPick={handlePick}
          onClose={onClose}
          columns={2}
          showClose
        />
      </Drawer>
    );
  }

  // Three columns is the Netflix shape, but a short list looks stranded in
  // three thin columns — collapse to two under nine genres.
  const columns = categories.length > 8 ? 3 : 2;

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{
        sx: {
          width: columns === 3 ? 'min(580px, calc(100vw - 32px))' : 'min(420px, calc(100vw - 32px))',
          background: PANEL_BG,
          backgroundImage: 'none',
          border: `1px solid ${alpha('#fff', 0.14)}`,
          borderRadius: 2,
          boxShadow: `0 16px 48px ${alpha('#000', 0.7)}`,
          mt: 1,
        },
      }}
      disableScrollLock
    >
      <GenreGrid
        categories={categories}
        selectedId={selectedId}
        allLabel={allLabel}
        allHref={allHref}
        hrefFor={hrefFor}
        onPick={handlePick}
        onClose={onClose}
        columns={columns}
      />
    </Popover>
  );
};

export default GenreMenu;
