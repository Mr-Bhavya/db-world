import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Typography, Container, Grid } from '@mui/material';
import {
  VpnKey as KeyIcon,
  Visibility as ViewIcon,
  AddCircle as AddIcon,
  Shield as ShieldIcon,
  Security as SecurityIcon,
  Lock as LockIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT, getGlowProps } from '@shared/theme';

const FEATURES = [
  {
    id: 'generate',
    title: 'Generate Password',
    description: 'Create cryptographically secure passwords with custom length, symbols, numbers and mixed case.',
    icon: KeyIcon,
    route: Constants.DB_GENERATE_PASSWORD_ROUTE,
    cta: 'Generate Password',
  },
  {
    id: 'save',
    title: 'Save Credential',
    description: 'Store credentials in AES-256 encrypted vault. Zero-knowledge architecture — only you can decrypt.',
    icon: AddIcon,
    route: Constants.DB_ADD_PASSWORD_ROUTE,
    cta: 'Save Credential',
  },
  {
    id: 'view',
    title: 'View Vault',
    description: 'Browse, search, edit and delete your stored credentials. Grouped by host with quick copy.',
    icon: ViewIcon,
    route: Constants.DB_VIEW_PASSWORD_ROUTE,
    cta: 'Open Vault',
  },
];

const BADGES = [
  { icon: ShieldIcon,   label: 'AES-256 Encrypted' },
  { icon: SecurityIcon, label: 'Zero-Knowledge' },
  { icon: LockIcon,     label: 'End-to-End Secure' },
];

const FeatureCard = ({ feature, index }) => {
  const T = useT();
  const navigate = useNavigate();
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      style={{ height: '100%' }}
    >
      <Box
        onClick={() => navigate(feature.route)}
        sx={{
          height: '100%',
          minHeight: 220,
          p: 3.5,
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            bgcolor: T.glassHover,
            borderColor: T.glassBorderHover,
            boxShadow: `0 0 32px ${T.tealGlow}`,
          },
        }}
      >
        <Box sx={{
          width: 48, height: 48, borderRadius: 2,
          bgcolor: T.tealBg,
          border: `1px solid ${T.tealBg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon sx={{ fontSize: 24, color: T.teal }} />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: T.textPrimary, mb: 0.75 }}>
            {feature.title}
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: T.textMuted, lineHeight: 1.6 }}>
            {feature.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: T.teal }}>
            {feature.cta}
          </Typography>
          <ArrowIcon sx={{ fontSize: 15, color: T.teal }} />
        </Box>
      </Box>
    </motion.div>
  );
};

const PasswordManagement = () => {
  usePageMeta('Vault', { description: 'Your AES-256 encrypted password vault on DB World.' });

  const T    = useT();
  const GLOW = getGlowProps(T);

  return (
    <Box sx={{
      bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary,
      pt: { xs: '56px', md: '64px' },
    }}>
      <motion.div {...GLOW} />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 5, md: 8 } }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: 2.5, mb: 2.5,
              bgcolor: T.tealBg, border: `1px solid ${T.tealBg}`,
            }}>
              <LockIcon sx={{ fontSize: 28, color: T.teal }} />
            </Box>

            <Typography sx={{
              fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15,
              fontSize: { xs: '2rem', md: '2.75rem' }, color: T.textPrimary,
            }}>
              Password Vault
            </Typography>
            <Typography sx={{ mt: 1.5, fontSize: '1rem', color: T.textMuted, maxWidth: 480, mx: 'auto' }}>
              Military-grade encrypted password management — only you hold the key.
            </Typography>

            {/* Security badges */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
              {BADGES.map(({ icon: Icon, label }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                >
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    px: 1.5, py: 0.6,
                    bgcolor: T.tealBg,
                    border: `1px solid ${T.tealBg}`,
                    borderRadius: 5,
                  }}>
                    <Icon sx={{ fontSize: 14, color: T.teal }} />
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: T.teal }}>
                      {label}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </Box>
        </motion.div>

        {/* Feature cards */}
        <Grid container spacing={2.5}>
          {FEATURES.map((feature, i) => (
            <Grid key={feature.id} item xs={12} sm={4}>
              <FeatureCard feature={feature} index={i} />
            </Grid>
          ))}
        </Grid>

        {/* Footer note */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <Box sx={{
            mt: 6, p: 2, textAlign: 'center',
            bgcolor: T.glass, border: `1px solid ${T.glassBorder}`,
            borderRadius: 2,
          }}>
            <Typography sx={{ fontSize: '0.8rem', color: T.textFaint }}>
              Your data is encrypted end-to-end and never stored in plain text.
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default PasswordManagement;
