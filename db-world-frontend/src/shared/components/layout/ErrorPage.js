// src/shared/components/layout/ErrorPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import BokehBackground from '@shared/components/ui/BokehBackground';

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden:  { y: 20, opacity: 0 },
  visible: { y: 0,  opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 12 } },
};

export default function ErrorPage() {
  const T = useT();
  const navigate = useNavigate();

  return (
    <BokehBackground height="100vh" vignette>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <motion.div
          variants={itemVariants}
          style={{ maxWidth: 480, width: '90%' }}
        >
          <Box
            sx={{
              bgcolor: T.glass,
              backdropFilter: 'blur(16px)',
              border: `1px solid ${T.glassBorder}`,
              borderRadius: '24px',
              p: { xs: '32px 24px', md: '48px 40px' },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 404 digits — each scales in with stagger */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
              {[4, 0, 4].map((num, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1,   opacity: 1 }}
                  transition={{ delay: i * 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: '5rem', md: '6rem' },
                      fontWeight: 800,
                      lineHeight: 1,
                      background: 'linear-gradient(135deg, #0d9488, #4f46e5)', // fixed brand gradient
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {num}
                  </Typography>
                </motion.div>
              ))}
            </Box>

            <motion.div variants={itemVariants}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 700, color: T.textPrimary, mb: 1 }}>
                Lost in the void
              </Typography>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Typography sx={{ color: T.textMuted, mb: 3 }}>
                This page doesn't exist in any dimension.
              </Typography>
            </motion.div>

            <motion.div
              variants={itemVariants}
              style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
            >
              <Box
                component="button"
                onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
                sx={{
                  bgcolor: T.teal,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50px',
                  px: 3,
                  py: 1.25,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'box-shadow 0.2s, background 0.2s',
                  '&:hover': {
                    bgcolor: T.tealHover,
                    boxShadow: `0 0 16px ${T.tealGlow}`,
                  },
                }}
              >
                Go Home
              </Box>

              <Box
                component="button"
                onClick={() => navigate(Constants.LOGIN_ROUTE)}
                sx={{
                  bgcolor: 'transparent',
                  color: T.teal,
                  border: `1px solid ${T.glassBorder}`,
                  borderRadius: '50px',
                  px: 3,
                  py: 1.25,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.2s, border-color 0.2s',
                  '&:hover': {
                    bgcolor: T.tealBg,
                    borderColor: T.teal,
                  },
                }}
              >
                Login
              </Box>
            </motion.div>
          </Box>
        </motion.div>
      </motion.div>
    </BokehBackground>
  );
}
