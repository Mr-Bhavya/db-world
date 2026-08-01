import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Box, Typography, Container, Skeleton } from '@mui/material';
import {
  VpnKey as KeyIcon,
  AddCircleOutline as AddIcon,
  GridViewRounded as ViewIcon,
  ShieldMoon as ShieldIcon,
  ArrowForwardRounded as ArrowIcon,
  WarningAmberRounded as WarnIcon,
  ContentCopyRounded as ReuseIcon,
  LanguageRounded as SiteIcon,
  KeyRounded as CredIcon,
} from '@mui/icons-material';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import { getCredential } from '@shared/services/ApiServices';
import { useAuth } from '@features/auth/context/Authentication';
import { analyzeVault } from './passwordUtils';
import { VaultAurora, SecurityRing, GlassPanel, useScrollTop } from './vaultShared';
import { cacheVault } from './offline/vaultCache';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = [
  {
    id: 'view',
    title: 'Open Vault',
    description: 'Browse, search and copy every saved credential.',
    icon: ViewIcon,
    accent: '#0d9488',
    route: Constants.DB_VIEW_PASSWORD_ROUTE,
  },
  {
    id: 'add',
    title: 'Add Credential',
    description: 'Save a new login to your encrypted vault.',
    icon: AddIcon,
    accent: '#7c3aed',
    route: Constants.DB_ADD_PASSWORD_ROUTE,
  },
  {
    id: 'generate',
    title: 'Generate',
    description: 'Create strong passwords & memorable passphrases.',
    icon: KeyIcon,
    accent: '#f59e0b',
    route: Constants.DB_GENERATE_PASSWORD_ROUTE,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────────────────────

const StatTile = ({ icon: Icon, label, value, tone, T }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      px: { xs: 1.5, sm: 1.75 },
      py: { xs: 1.25, sm: 1.5 },
      bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${T.glassBorder}`,
      borderRadius: 3,
      minWidth: 0,
    }}
  >
    <Box
      sx={{
        width: 38,
        height: 38,
        flexShrink: 0,
        borderRadius: 2,
        display: 'grid',
        placeItems: 'center',
        bgcolor: `${tone}1f`,
        color: tone,
      }}
    >
      <Icon sx={{ fontSize: 20 }} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 'clamp(1.1rem, 4vw, 1.35rem)', fontWeight: 900, lineHeight: 1.1, color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </Typography>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Action tile
// ─────────────────────────────────────────────────────────────────────────────

const ActionTile = ({ action, index, T, reduce }) => {
  const navigate = useNavigate();
  const Icon = action.icon;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -5 }}
      whileTap={{ scale: 0.98 }}
      style={{ height: '100%' }}
    >
      <GlassPanel
        hover
        onClick={() => navigate(action.route)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(action.route)}
        aria-label={action.title}
        sx={{
          height: '100%',
          p: { xs: 2.25, sm: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          outline: 'none',
          '&:focus-visible': { boxShadow: `0 0 0 2px ${action.accent}` },
          '&:hover .arrow': { transform: 'translateX(4px)', opacity: 1 },
        }}
      >
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            color: action.accent,
            bgcolor: `${action.accent}1a`,
            border: `1px solid ${action.accent}33`,
            boxShadow: `inset 0 0 20px ${action.accent}12`,
          }}
        >
          <Icon sx={{ fontSize: 26 }} />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: T.textPrimary, mb: 0.5 }}>
            {action.title}
          </Typography>
          <Typography sx={{ fontSize: '0.83rem', color: T.textMuted, lineHeight: 1.55 }}>
            {action.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: action.accent }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 800 }}>Open</Typography>
          <ArrowIcon className="arrow" sx={{ fontSize: 17, opacity: 0.7, transition: 'transform .25s ease, opacity .25s ease' }} />
        </Box>
      </GlassPanel>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const PasswordManagement = () => {
  usePageMeta('Vault', { description: 'Your AES-256 encrypted password vault on DB World.' });
  useScrollTop();

  const T = useT();
  const reduce = useReducedMotion();
  const { auth } = useAuth();

  // Gated on auth: the hub is a public route, but the vault endpoint is
  // protected — firing it while logged out would 401 and trip the refresh flow.
  const userId = auth?.user?.id ?? auth?.user?.userId ?? auth?.user?.username ?? auth?.user?.email ?? null;
  const { data: vault = [], isLoading } = useQuery({
    queryKey: ['pm-vault'],
    queryFn: async () => {
      const data = (await getCredential()).data ?? [];
      cacheVault(userId, data); // keep the offline snapshot fresh (native only, no prompt)
      return data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: auth.isAuthenticated,
  });

  const { health, total, weak, reused, sites } = useMemo(() => {
    const a = analyzeVault(vault);
    return { ...a, sites: vault.length };
  }, [vault]);

  const stats = [
    { icon: SiteIcon,  label: 'Sites',       value: sites,  tone: '#0d9488' },
    { icon: CredIcon,  label: 'Credentials', value: total,  tone: '#38bdf8' },
    { icon: WarnIcon,  label: 'Weak',        value: weak,   tone: weak > 0 ? '#f59e0b' : T.textMuted },
    { icon: ReuseIcon, label: 'Reused',      value: reused, tone: reused > 0 ? '#ef4444' : T.textMuted },
  ];

  return (
    <Box sx={{ position: 'relative', bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' }, overflowX: 'hidden' }}>
      <VaultAurora />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, sm: 5, md: 7 }, px: { xs: 2, sm: 3 } }}>
        {/* Hero header */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: { xs: 3, md: 4 } }}>
            <Box
              sx={{
                width: { xs: 52, sm: 60 },
                height: { xs: 52, sm: 60 },
                flexShrink: 0,
                borderRadius: 3.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: T.tealBg,
                border: `1px solid ${T.teal}44`,
                boxShadow: `0 0 34px ${T.tealGlow}`,
              }}
            >
              <ShieldIcon sx={{ fontSize: { xs: 26, sm: 30 }, color: T.teal }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 'clamp(1.6rem, 6vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, color: T.textPrimary }}>
                Password Vault
              </Typography>
              <Typography sx={{ fontSize: 'clamp(0.85rem, 2.6vw, 1rem)', color: T.textMuted, mt: 0.5 }}>
                Encrypted end-to-end — only you hold the key.
              </Typography>
            </Box>
          </Box>
        </motion.div>

        {/* Security overview */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel sx={{ p: { xs: 2.25, sm: 3 }, mb: { xs: 2.5, md: 3 } }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                <Skeleton variant="circular" width={132} height={132} sx={{ bgcolor: T.glassBorder }} />
                <Box sx={{ flex: 1, minWidth: 220, display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} variant="rounded" height={66} sx={{ bgcolor: T.glassBorder, borderRadius: 3 }} />
                  ))}
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
                  alignItems: 'center',
                  gap: { xs: 2.5, sm: 3, md: 4 },
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, justifySelf: { xs: 'center', sm: 'start' } }}>
                  <SecurityRing value={total === 0 ? 0 : health} />
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: T.textMuted, textAlign: 'center', maxWidth: 150 }}>
                    {total === 0
                      ? 'Add a credential to start'
                      : health >= 80
                      ? 'Your vault looks healthy'
                      : weak + reused > 0
                      ? 'Some logins need attention'
                      : 'Keep it up'}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                    gap: { xs: 1.25, sm: 1.5 },
                  }}
                >
                  {stats.map((s) => (
                    <StatTile key={s.label} {...s} T={T} />
                  ))}
                </Box>
              </Box>
            )}
          </GlassPanel>
        </motion.div>

        {/* Actions */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: { xs: 1.75, sm: 2 },
          }}
        >
          {ACTIONS.map((a, i) => (
            <ActionTile key={a.id} action={a} index={i} T={T} reduce={reduce} />
          ))}
        </Box>

        {/* Reassurance */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: { xs: 3, md: 4 } }}>
            <ShieldIcon sx={{ fontSize: 16, color: T.teal }} />
            <Typography sx={{ fontSize: '0.78rem', color: T.textFaint, textAlign: 'center' }}>
              AES-256 encrypted · zero-knowledge · never stored in plain text
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default PasswordManagement;
