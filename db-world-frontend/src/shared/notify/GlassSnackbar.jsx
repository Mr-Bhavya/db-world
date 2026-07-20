import React, { forwardRef } from 'react';
import { SnackbarContent, useSnackbar } from 'notistack';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import { keyframes } from '@mui/system';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { motion } from 'framer-motion';
import { useT, getTokens } from '@shared/theme';

const shrink = keyframes`from { transform: scaleX(1); } to { transform: scaleX(0); }`;

/** Per-variant colour + icon, resolved against the live theme tokens. */
const metaFor = (variant, T) => {
  switch (variant) {
    case 'success': return { color: T.success, Icon: CheckCircleRoundedIcon };
    case 'error':   return { color: T.error,   Icon: ErrorRoundedIcon };
    case 'warning': return { color: T.warning, Icon: WarningRoundedIcon };
    case 'loading': return { color: T.teal,    Icon: null };
    case 'info':
    default:        return { color: T.teal,    Icon: InfoRoundedIcon };
  }
};

/**
 * One glass toast card used for every notistack variant. Styled from the app design
 * tokens (`useT()`), so it tracks AMOLED-dark / white-light automatically: blurred
 * glass surface, semantic left accent bar, icon, optional title + action button, close
 * control, and a thin auto-dismiss progress bar (paused on hover, hidden while
 * persistent/loading). Swipe horizontally to dismiss on touch.
 *
 * Custom props forwarded from `notify`: `title`, `toastAction` ({ label, onClick }),
 * `dbProgress` (ms; 0 = persistent → no bar).
 */
const GlassSnackbar = forwardRef(function GlassSnackbar(props, ref) {
  const { id, message, variant = 'default', title, toastAction, dbProgress = 0, dbMode } = props;
  const { closeSnackbar } = useSnackbar();
  const ctxT = useT();
  // Render with the theme captured when the toast was fired, so it matches whichever surface
  // (global scope or the admin section's independent scope) triggered it.
  const T = dbMode ? getTokens(dbMode) : ctxT;
  const isLight = T.bg !== '#000000';
  const { color, Icon } = metaFor(variant, T);

  const dismiss = () => closeSnackbar(id);
  const hasBar = dbProgress > 0;

  return (
    <SnackbarContent ref={ref} role="alert" style={{ minWidth: 'auto' }}>
      <Box
        component={motion.div}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        dragSnapToOrigin
        onDragEnd={(_e, info) => {
          if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 600) dismiss();
        }}
        sx={{
          display: 'flex',
          alignItems: title ? 'flex-start' : 'center',
          gap: 1.25,
          width: '100%',
          minWidth: 260,
          maxWidth: 'min(92vw, 420px)',
          px: 1.75,
          py: 1.25,
          color: T.text,
          bgcolor: T.glass,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          border: `1px solid ${T.glassBorder}`,
          borderLeft: `3px solid ${color}`,
          borderRadius: 2.5,
          boxShadow: isLight ? '0 8px 28px rgba(0,0,0,0.14)' : '0 12px 34px rgba(0,0,0,0.44)',
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'pan-y',
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          // Pause the countdown while the pointer rests on the toast (desktop).
          '&:hover .db-toast-bar': { animationPlayState: 'paused' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', color, mt: title ? '2px' : 0 }}>
          {variant === 'loading'
            ? <CircularProgress size={20} thickness={5} sx={{ color }} />
            : <Icon sx={{ fontSize: 22 }} />}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {title && (
            <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{title}</Typography>
          )}
          <Typography sx={{ fontSize: 13.5, lineHeight: 1.4, color: title ? T.textMuted : T.text, wordBreak: 'break-word' }}>
            {message}
          </Typography>
          {toastAction?.label && (
            <Typography
              component="button"
              onClick={() => { toastAction.onClick?.(); dismiss(); }}
              sx={{
                mt: 0.75, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer',
                color, fontWeight: 700, fontSize: 13, textTransform: 'none', font: 'inherit',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {toastAction.label}
            </Typography>
          )}
        </Box>

        {variant !== 'loading' && (
          <IconButton size="small" onClick={dismiss} aria-label="Dismiss" sx={{ color: T.textFaint, mt: title ? '-2px' : 0, '&:hover': { color: T.text } }}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}

        {hasBar && (
          <Box
            className="db-toast-bar"
            sx={{
              position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%',
              bgcolor: color, opacity: 0.85, transformOrigin: 'left',
              animation: `${shrink} ${dbProgress}ms linear forwards`,
            }}
          />
        )}
      </Box>
    </SnackbarContent>
  );
});

export default GlassSnackbar;
