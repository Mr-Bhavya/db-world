/**
 * Admin UI kit — shared primitives (clean & flat).
 * AdminPage · PageHeader · SectionCard · StatCard · StatGrid ·
 * EmptyState · ErrorState · LoadingState · TableSkeleton
 *
 * All solid surfaces, 1px borders, single teal accent + status colours.
 * No glass, no blur, no gradients, no aurora.
 */
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Box, Typography, IconButton, Tooltip, Button, Skeleton, CircularProgress, Chip,
} from '@mui/material';
import {
  RefreshRounded, ErrorOutlineRounded, InboxRounded, ArrowForwardRounded,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import { adminSurface } from './theme';
import { useAdminHeader } from './adminHeader';

// ─────────────────────────────────────────────────────────────────────────────
// PageHeader — title/subtitle/icon + actions + refresh
// ─────────────────────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, icon: Icon, actions, onRefresh, refreshing }) => {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        {Icon && (
          <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: T.tealBg, color: T.teal }}>
            <Icon sx={{ fontSize: 22 }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: T.text }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: '0.82rem', color: T.textMuted, mt: 0.35 }}>{subtitle}</Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'flex-end', sm: 'flex-end' } }}>
        {actions}
        {onRefresh && (
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh} disabled={refreshing} aria-label="Refresh" sx={{ width: 40, height: 40, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 2, '&:hover': { color: T.teal, bgcolor: T.tealBg, borderColor: T.teal } }}>
              <RefreshRounded sx={{ fontSize: 19, animation: refreshing ? 'adminSpin 1s linear infinite' : 'none', '@keyframes adminSpin': { to: { transform: 'rotate(360deg)' } } }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AdminPage — standard page shell (padding + maxWidth). The header (title/icon/
// actions/refresh) is registered into the admin TOP BAR, not rendered inline —
// single-header model, so there's no duplicate title and pages gain vertical space.
// ─────────────────────────────────────────────────────────────────────────────
export const AdminPage = ({ title, subtitle, icon, actions, onRefresh, refreshing, maxWidth = 1680, children }) => {
  const T = useT();
  useAdminHeader({ title, subtitle, icon, actions, onRefresh, refreshing });
  return (
    <Box sx={{ px: { xs: 1.25, sm: 2.5, md: 3 }, py: { xs: 1.75, sm: 2.5, md: 3 }, maxWidth, mx: 'auto', minHeight: '100%', color: T.text }}>
      {children}
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SectionCard — solid card with an optional header + action
// ─────────────────────────────────────────────────────────────────────────────
export const SectionCard = ({ title, icon: Icon, action, actionLabel = 'View all', onAction, children, sx = {}, padding = true, flushMobile = false }) => {
  const T = useT();
  const S = adminSurface(T);
  // flushMobile: drop the card frame on phones so a list of already-carded items
  // (mobile card lists) floats directly instead of nesting card-in-card.
  const frame = flushMobile
    ? { bgcolor: { xs: 'transparent', md: S.card }, border: { xs: 'none', md: `1px solid ${S.border}` }, borderRadius: { xs: 0, md: 3 } }
    : { bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3 };
  return (
    <Box sx={{ ...frame, overflow: 'hidden', ...sx }}>
      {(title || action || onAction) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${S.divider}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {Icon && <Icon sx={{ fontSize: 18, color: T.teal }} />}
            <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Typography>
          </Box>
          {action || (onAction && (
            <Chip
              label={actionLabel}
              size="small"
              onClick={onAction}
              deleteIcon={<ArrowForwardRounded sx={{ fontSize: '13px !important' }} />}
              onDelete={onAction}
              sx={{ bgcolor: T.tealBg, color: T.teal, fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', '&:hover': { bgcolor: T.tealBgHover }, '& .MuiChip-deleteIcon': { color: T.teal } }}
            />
          ))}
        </Box>
      )}
      <Box sx={{ p: padding ? { xs: 2, sm: 2.5 } : 0 }}>{children}</Box>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AdminActionButton — the ONE header/page action button. Use for every module's
// top-bar actions so they look identical (labeled, never icon-only). Variants:
//   'primary'   — filled teal (main action, e.g. Add User / New Key)
//   'secondary' — outlined neutral → teal on hover
//   'danger'    — outlined neutral → red on hover (destructive)
// ─────────────────────────────────────────────────────────────────────────────
export const AdminActionButton = ({ icon: Icon, children, variant = 'primary', onClick, disabled, loading, ...rest }) => {
  const T = useT();
  const S = adminSurface(T);
  const base = { fontWeight: 700, borderRadius: 2, textTransform: 'none', whiteSpace: 'nowrap', minHeight: 36, boxShadow: 'none' };
  const styles = {
    primary:   { ...base, bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: '#0f766e', boxShadow: 'none' } },
    secondary: { ...base, border: `1px solid ${S.border}`, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg } },
    danger:    { ...base, border: `1px solid ${S.border}`, color: T.textMuted, '&:hover': { borderColor: T.error, color: T.error, bgcolor: T.errorBg } },
  };
  return (
    <Button
      variant={variant === 'primary' ? 'contained' : 'outlined'}
      size="small"
      onClick={onClick}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={14} color="inherit" /> : (Icon ? <Icon sx={{ fontSize: 18 }} /> : null)}
      sx={styles[variant] ?? styles.primary}
      {...rest}
    >
      {children}
    </Button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StickyBar — a filters/sort toolbar that pins to the top of the scroll area on
// scroll. IMPORTANT: place as a DIRECT child of AdminPage, NOT inside a
// SectionCard (its overflow:hidden would clip the sticky). Also requires no
// transformed ancestor — the admin page transition is opacity-only for this.
// ─────────────────────────────────────────────────────────────────────────────
export const StickyBar = ({ children, sx = {} }) => {
  const T = useT();
  const S = adminSurface(T);
  return (
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 4,
      bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3,
      p: { xs: 1.25, sm: 1.5 }, mb: 2,
      ...sx,
    }}>
      {children}
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StatCard + StatGrid
// ─────────────────────────────────────────────────────────────────────────────
export const StatCard = ({ icon: Icon, label, value, sub, accent, onClick, loading, badge, index = 0 }) => {
  const T = useT();
  const S = adminSurface(T);
  const reduce = useReducedMotion();
  const color = accent || T.teal;
  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      onClick={onClick}
      sx={{
        position: 'relative', p: { xs: 1.75, sm: 2 }, borderRadius: 3,
        bgcolor: S.card, border: `1px solid ${S.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .18s, background-color .18s, transform .18s',
        ...(onClick && { '&:hover': { borderColor: color, bgcolor: S.cardHover, transform: 'translateY(-2px)' } }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.25 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${color}1f`, color }}>
          {Icon && <Icon sx={{ fontSize: 19 }} />}
        </Box>
        {badge && <Chip label={badge} size="small" sx={{ height: 18, fontSize: '0.58rem', fontWeight: 800, bgcolor: `${color}22`, color }} />}
      </Box>
      {loading ? (
        <Skeleton variant="text" width={64} height={34} sx={{ bgcolor: S.inset }} />
      ) : (
        <Typography sx={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', fontWeight: 800, color: T.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value ?? '—'}
        </Typography>
      )}
      <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mt: 0.5, fontWeight: 600 }}>{label}</Typography>
      {sub && <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, mt: 0.35 }}>{sub}</Typography>}
    </Box>
  );
};

export const StatGrid = ({ children, min = 150, sx = {} }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: `repeat(auto-fit, minmax(${min}px, 1fr))` }, gap: { xs: 1.5, sm: 2 }, ...sx }}>
    {children}
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// States: Empty / Error / Loading / TableSkeleton
// ─────────────────────────────────────────────────────────────────────────────
export const EmptyState = ({ icon: Icon = InboxRounded, title = 'Nothing here yet', message, action }) => {
  const T = useT();
  return (
    <Box sx={{ textAlign: 'center', py: { xs: 5, sm: 7 }, px: 2 }}>
      <Icon sx={{ fontSize: 44, color: T.textFaint, mb: 1.5 }} />
      <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '0.95rem', mb: 0.5 }}>{title}</Typography>
      {message && <Typography sx={{ color: T.textMuted, fontSize: '0.82rem', mb: 2 }}>{message}</Typography>}
      {action}
    </Box>
  );
};

export const ErrorState = ({ message = 'Something went wrong', onRetry }) => {
  const T = useT();
  return (
    <Box sx={{ textAlign: 'center', py: { xs: 5, sm: 7 }, px: 2 }}>
      <ErrorOutlineRounded sx={{ fontSize: 44, color: T.error, mb: 1.5 }} />
      <Typography sx={{ color: T.textMuted, fontSize: '0.9rem', mb: onRetry ? 2 : 0 }}>{message}</Typography>
      {onRetry && (
        <Button onClick={onRetry} sx={{ color: T.teal, fontWeight: 800, minHeight: 40, '&:hover': { bgcolor: T.tealBg } }}>Retry</Button>
      )}
    </Box>
  );
};

export const LoadingState = ({ label = 'Loading…', height = 220 }) => {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, minHeight: height }}>
      <CircularProgress size={34} sx={{ color: T.teal }} />
      <Typography sx={{ fontSize: '0.8rem', color: T.textFaint }}>{label}</Typography>
    </Box>
  );
};

export const TableSkeleton = ({ rows = 6, height = 44 }) => {
  const T = useT();
  const S = adminSurface(T);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={height} sx={{ bgcolor: S.inset, borderRadius: 1.5 }} />
      ))}
    </Box>
  );
};
