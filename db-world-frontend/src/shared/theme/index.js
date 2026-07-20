/**
 * DB World — Design Tokens
 * Single source of truth for dark / light glassmorphism themes.
 */

// ─── Dark tokens (AMOLED black + teal) ───────────────────────────────────────
export const darkTokens = {
  bg:               '#000000',
  bgGradient:       '#000000',
  glass:            'rgba(255,255,255,0.04)',
  glassHover:       'rgba(255,255,255,0.07)',
  glassBorder:      'rgba(255,255,255,0.10)',
  glassBorderHover: 'rgba(13,148,136,0.50)',
  inputBg:          'rgba(255,255,255,0.04)',
  teal:             '#0d9488',
  tealHover:        '#0f766e',
  tealBg:           'rgba(13,148,136,0.12)',
  tealBgHover:      'rgba(13,148,136,0.22)',
  tealGlow:         'rgba(13,148,136,0.20)',
  sidebar:          '#000000',
  topbar:           '#000000',
  adminBg:          '#000000',
  main:             '#000000',   // AdminLayout alias
  hoverBg:          'rgba(255,255,255,0.05)', // AdminLayout alias
  text:             '#ffffff',
  textPrimary:      '#ffffff',   // Home / Games alias
  // Bumped for legibility — 0.55/0.32 read as washed-out grey on AMOLED black.
  textMuted:        'rgba(255,255,255,0.68)',
  textFaint:        'rgba(255,255,255,0.46)',
  border:           'rgba(255,255,255,0.08)',
  borderHover:      'rgba(255,255,255,0.16)',
  scrollThumb:      'rgba(255,255,255,0.12)',
  error:            '#f87171',
  errorBg:          'rgba(248,113,113,0.12)',
  success:          '#10b981',
  successBg:        'rgba(16,185,129,0.12)',
  warning:          '#fbbf24',
  warningBg:        'rgba(251,191,36,0.12)',
};

// ─── Light tokens (pure white + teal) ────────────────────────────────────────
export const lightTokens = {
  bg:               '#ffffff',
  bgGradient:       '#ffffff',
  glass:            'rgba(255,255,255,0.85)',
  glassHover:       '#ffffff',
  glassBorder:      'rgba(0,0,0,0.10)',
  glassBorderHover: 'rgba(13,148,136,0.50)',
  inputBg:          '#ffffff',
  teal:             '#0d9488',
  tealHover:        '#0f766e',
  tealBg:           'rgba(13,148,136,0.08)',
  tealBgHover:      'rgba(13,148,136,0.15)',
  tealGlow:         'rgba(13,148,136,0.12)',
  sidebar:          '#ffffff',
  topbar:           '#ffffff',
  adminBg:          '#f8fafc',
  main:             '#f8fafc',
  hoverBg:          'rgba(0,0,0,0.04)',
  text:             '#000000',
  textPrimary:      '#000000',
  textMuted:        'rgba(0,0,0,0.55)',
  textFaint:        'rgba(0,0,0,0.38)',
  border:           'rgba(0,0,0,0.09)',
  borderHover:      'rgba(0,0,0,0.18)',
  scrollThumb:      'rgba(0,0,0,0.14)',
  error:            '#ef4444',
  errorBg:          'rgba(239,68,68,0.08)',
  success:          '#059669',
  successBg:        'rgba(5,150,105,0.08)',
  warning:          '#d97706',
  warningBg:        'rgba(217,119,6,0.08)',
};

/** Returns the correct token set for a given mode. */
export const getTokens = (mode) => mode === 'light' ? lightTokens : darkTokens;

// ─── Backward-compat static exports (dark) ───────────────────────────────────
export const T = darkTokens;

// ─── MUI TextField sx — call with current T ───────────────────────────────────
export const getFieldSx = (T) => ({
  '& .MuiOutlinedInput-root': {
    color: T.text,
    borderRadius: 1.5,
    backgroundColor: T.inputBg,
    '& fieldset':             { borderColor: T.glassBorder },
    '&:hover fieldset':       { borderColor: T.borderHover },
    '&.Mui-focused fieldset': { borderColor: T.teal },
  },
  '& .MuiInputLabel-root':               { color: T.textMuted },
  '& .MuiInputLabel-root.Mui-focused':   { color: T.teal },
  '& .MuiFormHelperText-root':           { color: T.textMuted },
  '& .MuiFormHelperText-root.Mui-error': { color: T.error },
  '& .MuiSvgIcon-root':                  { color: T.textMuted },
  '& input':                             { color: T.text },
  colorScheme: 'auto',
});

/** Backward compat */
export const DARK_FIELD = getFieldSx(darkTokens);

// ─── MUI Select MenuProps — call with current T ───────────────────────────────
export const getSelectMenuProps = (T) => ({
  PaperProps: {
    sx: {
      bgcolor: T.sidebar,
      border: `1px solid ${T.glassBorder}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
      '& .MuiMenuItem-root': {
        color: T.text,
        '&:hover':              { bgcolor: T.tealBg },
        '&.Mui-selected':       { bgcolor: T.tealBg, color: T.teal },
        '&.Mui-selected:hover': { bgcolor: T.tealBgHover },
      },
    },
  },
});

/** Backward compat */
export const DARK_SELECT_MENU = getSelectMenuProps(darkTokens);

// ─── Framer Motion radial glow — call with current T ─────────────────────────
export const getGlowProps = (T) => ({
  animate: { opacity: [0.06, 0.14, 0.06] },
  transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  style: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
    background: `radial-gradient(ellipse 55% 45% at 50% 30%, ${T.tealGlow} 0%, transparent 70%)`,
  },
});

/** Backward compat */
export const GLOW_PROPS = getGlowProps(darkTokens);

// ─── Convenience teal outlined button sx ─────────────────────────────────────
export const getTealOutlinedBtn = (T) => ({
  borderColor: T.teal,
  color: T.teal,
  '&:hover': { borderColor: T.tealHover, bgcolor: T.tealBg },
});

export const TEAL_OUTLINED_BTN = getTealOutlinedBtn(darkTokens);

// ─── Re-export context hooks so components import from one place ──────────────
export { ThemeTokensProvider, AdminThemeProvider, useThemeMode, useT, getActiveThemeMode } from './ThemeContext';
