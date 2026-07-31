import React from 'react';
import { Box, Button, Dialog, IconButton, LinearProgress, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useT } from '@shared/theme';

/**
 * AppPromoDialog — the single "premium glass" popup used for every app-distribution
 * prompt: the in-app update gate, the download/install-progress state, and the
 * mobile-web "install the app" invite. It is purely presentational — the parent
 * gate owns all behaviour (when to show, what the buttons do) and feeds it props,
 * so update / download / install all share one visual language.
 *
 * Props:
 *   open, dismissible, onClose
 *   icon           React node for the header tile (an MUI icon)
 *   title, subtitle
 *   chip           small pill under the title (e.g. "v3.0.2" or "APK · 24 MB")
 *   benefits       [{ icon, label }]  bulleted value props (install mode)
 *   body           freeform node (e.g. changelog) shown in a scrollable card
 *   note           { tone: 'warning' | 'error', text }  inline status line
 *   progress       number 0..100 | null — when set, shows the download bar
 *   busy           disables the primary button / drives the indeterminate bar
 *   primaryLabel, onPrimary
 *   secondaryLabel, onSecondary   (secondary hidden when label omitted)
 */
export default function AppPromoDialog({
  open,
  dismissible = true,
  onClose,
  icon,
  title,
  subtitle,
  chip,
  benefits,
  body,
  note,
  progress = null,
  busy = false,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  const T = useT();
  const dark = T.bg === '#000000';
  const showProgress = progress != null;

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown={!dismissible}
      onClose={(_e, reason) => {
        if (!dismissible) return;
        if (reason === 'backdropClick') return; // require an explicit choice
        onClose?.();
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: dark ? 'rgba(0,0,0,0.62)' : 'rgba(15,23,42,0.32)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          },
        },
      }}
      PaperProps={{
        sx: {
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          maxWidth: 420,
          m: 2,
          borderRadius: 4,
          bgcolor: T.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${T.glassBorder}`,
          color: T.text,
          boxShadow: dark ? '0 30px 90px rgba(0,0,0,0.6)' : '0 26px 70px rgba(15,23,42,0.18)',
        },
      }}
    >
      {/* Soft top light source, echoing the app-wide Aurora surface. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(120% 60% at 50% -10%, ${T.tealGlow} 0%, transparent 60%)`,
        }}
      />

      {dismissible && (
        <IconButton
          onClick={() => onClose?.()}
          aria-label="Dismiss"
          size="small"
          sx={{ position: 'absolute', top: 10, right: 10, color: T.textFaint, '&:hover': { color: T.textPrimary } }}
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      )}

      <Box sx={{ position: 'relative', p: { xs: 2.75, sm: 3.25 }, textAlign: 'center' }}>
        {/* Floating, glowing app-icon tile. */}
        <Box
          component={motion.div}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          sx={{
            width: 68,
            height: 68,
            mx: 'auto',
            mb: 1.75,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(140deg, ${T.tealBgHover}, ${T.tealBg})`,
            border: `1px solid ${T.glassBorder}`,
            boxShadow: `0 12px 34px ${T.tealGlow}`,
            '& .MuiSvgIcon-root': { fontSize: 34, color: T.teal },
          }}
        >
          {icon}
        </Box>

        <Typography sx={{ fontWeight: 800, fontSize: '1.22rem', lineHeight: 1.25 }}>{title}</Typography>

        {chip && (
          <Box
            sx={{
              display: 'inline-block',
              mt: 1,
              px: 1.25,
              py: 0.35,
              borderRadius: 999,
              bgcolor: T.tealBg,
              border: `1px solid ${T.glassBorder}`,
              color: T.teal,
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '.02em',
            }}
          >
            {chip}
          </Box>
        )}

        {subtitle && (
          <Typography sx={{ color: T.textMuted, mt: 1, fontSize: '0.9rem', lineHeight: 1.5 }}>
            {subtitle}
          </Typography>
        )}

        {/* Value props (install mode). */}
        {Array.isArray(benefits) && benefits.length > 0 && (
          <Box sx={{ mt: 2.25, display: 'flex', flexDirection: 'column', gap: 1.1, textAlign: 'left' }}>
            {benefits.map((b, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: 2,
                    bgcolor: T.tealBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& .MuiSvgIcon-root': { fontSize: 18, color: T.teal },
                  }}
                >
                  {b.icon ?? <CheckRoundedIcon />}
                </Box>
                <Typography sx={{ color: T.text, fontSize: '0.86rem', lineHeight: 1.35 }}>{b.label}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Freeform body — used for the update changelog. */}
        {body && (
          <Box
            sx={{
              mt: 2.25,
              p: 1.5,
              maxHeight: 168,
              overflowY: 'auto',
              textAlign: 'left',
              borderRadius: 2.5,
              bgcolor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
              border: `1px solid ${T.glassBorder}`,
              color: T.textMuted,
              fontSize: '0.83rem',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {body}
          </Box>
        )}

        {note && (
          <Typography
            sx={{
              display: 'block',
              mt: 2,
              fontSize: '0.78rem',
              fontWeight: 600,
              lineHeight: 1.45,
              color: note.tone === 'error' ? T.error : T.warning,
            }}
          >
            {note.text}
          </Typography>
        )}

        {/* Download progress. Determinate once we have a %, indeterminate while busy. */}
        {(showProgress || busy) && (
          <Box sx={{ mt: 2.5 }}>
            <LinearProgress
              variant={showProgress ? 'determinate' : 'indeterminate'}
              value={showProgress ? progress : undefined}
              sx={{
                height: 7,
                borderRadius: 999,
                bgcolor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
                '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: T.teal },
              }}
            />
            {showProgress && (
              <Typography sx={{ color: T.textFaint, mt: 0.75, fontSize: '0.74rem' }}>
                Downloading… {Math.round(progress)}%
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 3 }}>
          {secondaryLabel && !busy && (
            <Button
              onClick={() => onSecondary?.()}
              sx={{ color: T.textMuted, textTransform: 'none', fontWeight: 600, px: 2, '&:hover': { color: T.text, bgcolor: T.hoverBg } }}
            >
              {secondaryLabel}
            </Button>
          )}
          <Button
            onClick={() => onPrimary?.()}
            disabled={busy}
            variant="contained"
            disableElevation
            sx={{
              px: 3.25,
              py: 0.9,
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.92rem',
              color: '#fff',
              background: `linear-gradient(135deg, ${T.teal}, ${T.tealHover})`,
              boxShadow: `0 10px 26px ${T.tealGlow}`,
              '&:hover': { background: `linear-gradient(135deg, ${T.tealHover}, ${T.tealHover})` },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.75)', background: T.tealHover, opacity: 0.85 },
            }}
          >
            {primaryLabel}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
