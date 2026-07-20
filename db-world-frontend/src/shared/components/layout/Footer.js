import React, { memo, useCallback, useState } from 'react';

import {
  Box,
  Container,
  Dialog,
  DialogContent,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { motion, useReducedMotion } from 'framer-motion';

import {
  Close as CloseIcon,
  InfoOutlined,
} from '@mui/icons-material';

import { useT } from '@shared/theme';
import DbWorldLogo from '@assets/images/db-circle-icon.webp';

const APP_VERSION = '3.0.0';



// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const clampTextSx = (lines = 1) => ({
  minWidth: 0,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
});

const focusSx = (color) => ({
  '&:focus-visible': {
    outline: `3px solid ${color}`,
    outlineOffset: 3,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// About Dialog
// ─────────────────────────────────────────────────────────────────────────────

const AboutDialog = memo(function AboutDialog({ open, onClose }) {
  const T = useT();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: motion.div,
        initial: prefersReducedMotion
          ? false
          : {
              opacity: 0,
              scale: 0.96,
              y: 14,
            },
        animate: {
          opacity: 1,
          scale: 1,
          y: 0,
        },
        exit: prefersReducedMotion
          ? undefined
          : {
              opacity: 0,
              scale: 0.96,
              y: 10,
            },
        transition: {
          type: 'spring',
          stiffness: 220,
          damping: 24,
        },
        sx: {
          bgcolor: T.bg,
          backgroundImage: 'none',
          border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
          borderRadius: fullScreen ? 0 : { sm: 4, md: 5 },
          overflow: 'hidden',
          boxShadow: '0 24px 90px rgba(0,0,0,0.45)',
        },
      }}
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(8px)',
        },
      }}
    >
      <DialogContent
        sx={{
          position: 'relative',
          p: {
            xs: 2.5,
            sm: 4,
            md: 5,
            xl: 6,
          },
          '@media (min-width:1920px)': {
            p: 7,
          },
          maxHeight: fullScreen ? '100dvh' : 'min(78dvh, 760px)',
          overflowY: 'auto',
        }}
      >
        <IconButton
          onClick={onClose}
          aria-label="Close about panel"
          sx={{
            position: 'absolute',
            top: {
              xs: 12,
              sm: 16,
            },
            right: {
              xs: 12,
              sm: 16,
            },
            color: T.textMuted,
            width: 38,
            height: 38,
            ...focusSx(T.teal),
            '&:hover': {
              color: T.textPrimary,
              bgcolor: 'rgba(255,255,255,0.06)',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* Logo + title */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: {
              xs: 1.5,
              sm: 2,
            },
            pr: 5,
            mb: {
              xs: 2.5,
              md: 3,
            },
            minWidth: 0,
          }}
        >
          <Box
            component="img"
            src={DbWorldLogo}
            alt="DB World"
            sx={{
              width: {
                xs: 44,
                sm: 52,
                xl: 62,
              },
              height: {
                xs: 44,
                sm: 52,
                xl: 62,
              },
              borderRadius: 2,
              flexShrink: 0,
            }}
          />

          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h2"
              sx={{
                color: T.textPrimary,
                fontWeight: 900,
                fontSize: {
                  xs: '1.25rem',
                  sm: '1.45rem',
                  xl: '1.75rem',
                },
                lineHeight: 1.15,
                ...clampTextSx(1),
              }}
            >
              DB World
            </Typography>

            <Typography
              sx={{
                color: T.textMuted,
                fontSize: {
                  xs: '0.82rem',
                  xl: '0.98rem',
                },
                mt: 0.4,
              }}
            >
              Version {APP_VERSION}
            </Typography>
          </Box>
        </Box>

        <Typography
          sx={{
            color: T.textPrimary,
            fontSize: {
              xs: '0.92rem',
              sm: '0.98rem',
              xl: '1.12rem',
            },
            lineHeight: 1.65,
            mb: 2.5,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          Your personal media universe — everything in one place. DB World brings
          together entertainment, productivity, and management tools in a seamless,
          unified experience.
        </Typography>

        <Typography
          component="h3"
          sx={{
            color: T.textPrimary,
            fontWeight: 850,
            fontSize: {
              xs: '1rem',
              sm: '1.08rem',
              xl: '1.25rem',
            },
            mb: 1.25,
            mt: 3,
          }}
        >
          Features
        </Typography>

        <Box
          component="ul"
          sx={{
            color: T.textMuted,
            pl: {
              xs: 2.2,
              sm: 2.5,
            },
            pr: 0,
            mb: 2,
            fontSize: {
              xs: '0.88rem',
              sm: '0.94rem',
              xl: '1.05rem',
            },
            lineHeight: 1.7,
            '& li': {
              mb: 0.45,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            },
          }}
        >
          <li>Stream movies and TV shows with DB Cinema</li>
          <li>Check real-time weather with DB Weather</li>
          <li>Play browser games with DB Games</li>
          <li>Secure password management</li>
          <li>Admin console for system management</li>
        </Box>

        <Box
          sx={{
            mt: 3,
            pt: 2,
            borderTop: `1px solid ${T.glassBorder}`,
          }}
        >
          <Typography
            sx={{
              color: T.textFaint,
              fontSize: {
                xs: '0.76rem',
                xl: '0.9rem',
              },
              lineHeight: 1.5,
            }}
          >
            © 2026 DB World. All rights reserved.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
});

AboutDialog.displayName = 'AboutDialog';

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

export default function Footer() {
  const T = useT();
  const prefersReducedMotion = useReducedMotion();
  const [showAbout, setShowAbout] = useState(false);

  const openAbout = useCallback(() => {
    setShowAbout(true);
  }, []);

  const closeAbout = useCallback(() => {
    setShowAbout(false);
  }, []);

  return (
    <>
      <Box
        component="footer"
        sx={{
          bgcolor: T.bg,
          color: T.textFaint,
          minWidth: 0,
        }}
      >
        {/* Gradient line */}
        <motion.div
          initial={prefersReducedMotion ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.55,
            ease: 'easeOut',
          }}
          style={{
            height: 1,
            background: `linear-gradient(to right, ${T.teal}, transparent)`,
            transformOrigin: 'left',
          }}
        />

        <Container
          maxWidth={false}
          sx={{
            width: '100%',
            maxWidth: {
              xs: '100%',
              lg: 1320,
              xl: 1680,
            },
            '@media (min-width:1920px)': {
              maxWidth: 1880,
            },
            px: {
              xs: 1.5,
              sm: 2.5,
              md: 3,
              xl: 4,
            },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr) auto',
                sm: 'minmax(0, 1fr) auto',
              },
              alignItems: 'center',
              gap: {
                xs: 1,
                sm: 2,
              },
              py: {
                xs: 1.6,
                sm: 1.8,
                md: 2,
                xl: 2.4,
              },
              minWidth: 0,
            }}
          >
            {/* Left content */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: {
                  xs: 0.8,
                  sm: 1.2,
                },
                minWidth: 0,
              }}
            >
              <Typography
                sx={{
                  color: T.textFaint,
                  fontSize: {
                    xs: '0.72rem',
                    sm: '0.76rem',
                    xl: '0.9rem',
                  },
                  lineHeight: 1.4,
                  ...clampTextSx(1),
                }}
                title="© 2026 DB World"
              >
                © 2026 DB World
              </Typography>

              <Box
                sx={{
                  border: `1px solid ${T.glassBorder}`,
                  borderRadius: 999,
                  px: {
                    xs: 1,
                    sm: 1.35,
                    xl: 1.6,
                  },
                  py: {
                    xs: 0.2,
                    xl: 0.3,
                  },
                  flexShrink: 0,
                  bgcolor: 'rgba(255,255,255,0.018)',
                }}
              >
                <Typography
                  sx={{
                    color: T.textFaint,
                    fontSize: {
                      xs: '0.66rem',
                      sm: '0.7rem',
                      xl: '0.82rem',
                    },
                    lineHeight: 1.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  v{APP_VERSION}
                </Typography>
              </Box>
            </Box>

            {/* Right action */}
            <Tooltip title="About DB World">
              <IconButton
                size="small"
                onClick={openAbout}
                aria-label="About DB World"
                sx={{
                  color: T.textFaint,
                  width: {
                    xs: 34,
                    sm: 36,
                    xl: 42,
                  },
                  height: {
                    xs: 34,
                    sm: 36,
                    xl: 42,
                  },
                  flexShrink: 0,
                  ...focusSx(T.teal),
                  '&:hover': {
                    color: T.teal,
                    bgcolor: T.tealBg,
                  },
                }}
              >
                <InfoOutlined
                  sx={{
                    fontSize: {
                      xs: 18,
                      xl: 22,
                    },
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Container>
      </Box>

      <AboutDialog open={showAbout} onClose={closeAbout} />
    </>
  );
};