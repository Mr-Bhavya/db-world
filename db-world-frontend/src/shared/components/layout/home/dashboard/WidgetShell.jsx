import React, { memo, useCallback } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Close as HideIcon,
  DragIndicator as DragIcon,
  PhotoSizeSelectSmall as ResizeIcon,
} from '@mui/icons-material';
import { useReducedMotion } from 'framer-motion';

import { useT } from '@shared/theme';
import { SIZE_LABELS } from './useDashboardLayout';
import { clampTextSx } from '../homeStyles';

/**
 * The frame every dashboard widget renders inside: glass card, per-app accent, a header with the
 * app's icon and name, and the widget's own live content below.
 *
 * Two modes. Normally the whole card is one button that opens the app. In edit mode it stops being
 * a link and grows a drag handle, a size cycler and a hide button — which is what keeps drag and
 * tap from ever being confused for one another.
 *
 * The drag handle also takes arrow keys, so the layout is reorderable without a pointer.
 */
const WidgetShell = memo(function WidgetShell({
  widget,
  editing,
  index,
  total,
  onOpen,
  onMove,
  onCycleSize,
  onHide,
  dragControls,
  children,
  footer,
}) {
  const T = useT();
  const prefersReducedMotion = useReducedMotion();

  const { accent, gradient, label, Icon } = widget;

  const handleOpen = useCallback(() => {
    if (editing) return;
    onOpen?.(widget);
  }, [editing, onOpen, widget]);

  const handleHandleKeyDown = useCallback(
    (event) => {
      const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (!delta) return;

      event.preventDefault();
      const target = index + delta;
      if (target >= 0 && target < total) onMove?.(index, target);
    },
    [index, total, onMove]
  );

  const stop = (handler) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler?.();
  };

  const interactive = !editing && Boolean(onOpen);

  return (
    <Box
      {...(interactive
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `Open ${label}`,
            onClick: handleOpen,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleOpen();
              }
            },
          }
        : {})}
      sx={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: editing ? 'grab' : interactive ? 'pointer' : 'default',
        borderRadius: { xs: 2.5, sm: 3, md: 3.25 },
        border: `1px solid ${editing ? `${accent}66` : T.glassBorder}`,
        bgcolor: T.glass,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
        transform: 'translateZ(0)',
        transition: prefersReducedMotion
          ? 'border-color 0.2s ease, background-color 0.2s ease'
          : 'border-color 0.24s ease, box-shadow 0.24s ease, background-color 0.24s ease',
        '&:focus-visible': { outline: `3px solid ${accent}`, outlineOffset: 3 },
        ...(interactive && {
          '&:hover': {
            borderColor: `${accent}AA`,
            boxShadow: `0 18px 46px ${accent}40`,
            bgcolor: T.glassHover,
            '& .widget-open': { opacity: 1, transform: 'translateX(0)' },
          },
        }),
      }}
    >
      {/* Accent wash from the icon corner — brands the tile without a hard colour block. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(140deg, ${accent}1f 0%, ${accent}0a 38%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 1.25 },
          px: { xs: 1.25, sm: 1.75 },
          pt: { xs: 1.25, sm: 1.6 },
          pb: 0.75,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: { xs: 30, sm: 36 },
            height: { xs: 30, sm: 36 },
            borderRadius: 2,
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 8px 18px ${accent}55`,
          }}
        >
          {Icon && <Icon sx={{ color: '#fff', fontSize: { xs: 17, sm: 20 } }} />}
        </Box>

        <Typography
          sx={{
            flex: 1,
            color: T.textPrimary,
            fontWeight: 900,
            fontSize: { xs: '0.85rem', sm: '0.95rem', xl: '1.05rem' },
            letterSpacing: '-0.01em',
            ...clampTextSx(1),
          }}
        >
          {label}
        </Typography>

        {/* Open affordance.
            A real button, not a decorative chevron: on a touch screen there is no hover to reveal
            it, and on tiles whose body is a list of its own tap targets (the IPO rows, the game
            list, the app dock) it was not obvious the card itself opened the app. Revealed on
            hover where a pointer exists, always visible where one does not. */}
        {!editing && interactive && (
          <Box
            component="button"
            type="button"
            className="widget-open"
            aria-label={`Open ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              handleOpen();
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: 28,
              height: 28,
              p: 0,
              borderRadius: '50%',
              cursor: 'pointer',
              color: accent,
              bgcolor: `${accent}1f`,
              border: `1px solid ${accent}3d`,
              opacity: 0,
              transform: prefersReducedMotion ? 'none' : 'translateX(-6px)',
              transition: 'opacity 0.24s ease, transform 0.24s ease, background-color 0.2s ease',
              '@media (hover: none)': { opacity: 1, transform: 'none' },
              ...(prefersReducedMotion && { opacity: 1, transform: 'none' }),
              '&:hover': { bgcolor: `${accent}33` },
              '&:focus-visible': { opacity: 1, transform: 'none', outline: `2px solid ${accent}`, outlineOffset: 2 },
            }}
          >
            <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Box>
        )}
      </Box>

      {/* Body */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          px: { xs: 1.25, sm: 1.75 },
          pb: editing ? { xs: 4.5, sm: 5 } : { xs: 1.25, sm: 1.6 },
          display: 'flex',
          flexDirection: 'column',
          // A large tile is two rows tall; centring left its content floating with dead space above
          // and below. Large tiles stack from the top and pin their closing block with `mt: auto`,
          // which keeps the related lines together instead of spreading every child evenly.
          justifyContent: widget.size === 'lg' ? 'flex-start' : 'center',
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>


      {/* Edit controls.
          A floating strip anchored to the tile, not a header row: three buttons beside the title
          in a 222px-wide `sm` tile squeezed it down to "Arc…". Bottom-right keeps the full title
          legible at every size and puts the controls under the thumb on a phone. */}
      {editing && (
        <Box
          sx={{
            position: 'absolute',
            right: { xs: 4, sm: 6 },
            bottom: { xs: 4, sm: 6 },
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 0.25,
            borderRadius: 2,
            bgcolor: T.glassHover,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${T.glassBorder}`,
          }}
        >
          <Tooltip title={`Size: ${SIZE_LABELS[widget.size] ?? widget.size}`}>
            <IconButton
              size="small"
              onClick={stop(() => onCycleSize?.(widget.id))}
              aria-label={`Change size of ${label} (currently ${SIZE_LABELS[widget.size] ?? widget.size})`}
              sx={{ color: T.textMuted, '&:hover': { color: accent } }}
            >
              <ResizeIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Remove from dashboard">
            <IconButton
              size="small"
              onClick={stop(() => onHide?.(widget.id))}
              aria-label={`Remove ${label} from the dashboard`}
              sx={{ color: T.textMuted, '&:hover': { color: T.error } }}
            >
              <HideIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Drag to reorder, or use the arrow keys">
            <IconButton
              size="small"
              onKeyDown={handleHandleKeyDown}
              // The only thing that starts a drag. The tile itself no longer listens, so on a
              // phone a swipe anywhere else on it scrolls the page instead of dragging the
              // widget out from under your thumb.
              onPointerDown={(event) => dragControls?.start(event)}
              aria-label={`Reorder ${label}. Position ${index + 1} of ${total}. Use the arrow keys to move it.`}
              sx={{
                color: T.textMuted,
                cursor: 'grab',
                position: 'relative',
                // Only this control opts out of the browser's own gestures — the rest of the
                // tile keeps `touch-action: auto` and can still be scrolled through.
                touchAction: 'none',
                // A 30px icon button is well under a thumb's width, and this is now the only way
                // to reorder by touch. Grows the hit area without changing what is drawn.
                '&::after': { content: '""', position: 'absolute', inset: -7 },
                '&:hover': { color: accent },
              }}
            >
              <DragIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {footer}
    </Box>
  );
});

WidgetShell.displayName = 'WidgetShell';

export default WidgetShell;
