import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';

import {
  Home as HomeIcon,
  Login as LoginIcon,
} from '@mui/icons-material';

import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import BokehBackground from '@shared/components/ui/BokehBackground';

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
// 404 Digits
// ─────────────────────────────────────────────────────────────────────────────

const ErrorDigits = memo(function ErrorDigits({ T }) {
  const prefersReducedMotion = useReducedMotion();
  const digits = ['4', '0', '4'];

  return (
    <Box
      aria-label="404"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: {
          xs: 0.4,
          sm: 0.75,
          md: 1,
        },
        mb: {
          xs: 2.5,
          sm: 3,
        },
        minWidth: 0,
      }}
    >
      {digits.map((digit, index) => (
        <motion.div
          key={`${digit}-${index}`}
          initial={
            prefersReducedMotion
              ? false
              : {
                  scale: 0.65,
                  opacity: 0,
                  y: 12,
                }
          }
          animate={{
            scale: 1,
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: prefersReducedMotion ? 0 : index * 0.08,
            type: 'spring',
            stiffness: 210,
            damping: 18,
          }}
          style={{
            minWidth: 0,
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: {
                xs: 'clamp(4.2rem, 26vw, 6.4rem)',
                sm: 'clamp(5.5rem, 18vw, 8rem)',
                md: 'clamp(6rem, 13vw, 9rem)',
                xl: 'clamp(7rem, 9vw, 11rem)',
              },
              '@media (min-width:1920px)': {
                fontSize: 'clamp(8rem, 8vw, 13rem)',
              },
              fontWeight: 950,
              lineHeight: 0.9,
              letterSpacing: '-0.08em',
              background: 'linear-gradient(135deg, #0d9488, #4f46e5)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 0 22px ${T.tealGlow})`,
              userSelect: 'none',
            }}
          >
            {digit}
          </Typography>
        </motion.div>
      ))}
    </Box>
  );
});

ErrorDigits.displayName = 'ErrorDigits';

// ─────────────────────────────────────────────────────────────────────────────
// Error Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ErrorPage() {
  const T = useT();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const goHome = useCallback(() => {
    navigate(Constants.DB_WORLD_HOME_ROUTE);
  }, [navigate]);

  const goLogin = useCallback(() => {
    navigate(Constants.LOGIN_ROUTE);
  }, [navigate]);

  return (
    <BokehBackground
      height={{
        xs: '100dvh',
        sm: '100svh',
      }}
      vignette
    >
      <Box
        component="main"
        sx={{
          minHeight: {
            xs: '100dvh',
            sm: '100svh',
          },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: {
            xs: 1.5,
            sm: 2.5,
            md: 3,
          },
          py: {
            xs: 8,
            sm: 9,
            md: 10,
          },
          overflow: 'hidden auto',
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            width: '100%',
            maxWidth: {
              xs: 520,
              sm: 620,
              md: 720,
              xl: 820,
            },
            '@media (min-width:1920px)': {
              maxWidth: 980,
            },
            px: 0,
          }}
        >
          <motion.div
            initial={
              prefersReducedMotion
                ? false
                : {
                    opacity: 0,
                    y: 22,
                    scale: 0.98,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              type: 'spring',
              stiffness: 110,
              damping: 18,
            }}
            style={{
              width: '100%',
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'center',
                bgcolor: T.glass,
                backdropFilter: 'blur(18px)',
                border: `1px solid ${T.glassBorder}`,
                borderRadius: {
                  xs: 4,
                  sm: 5,
                  md: 6,
                },
                px: {
                  xs: 2.2,
                  sm: 4,
                  md: 5,
                  xl: 6,
                },
                py: {
                  xs: 4,
                  sm: 5,
                  md: 6,
                  xl: 7,
                },
                '@media (min-width:1920px)': {
                  px: 8,
                  py: 8,
                },
                boxShadow: '0 24px 90px rgba(0,0,0,0.35)',
                minWidth: 0,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background:
                    'radial-gradient(circle at 50% 0%, rgba(13,148,136,0.18), transparent 42%)',
                },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  minWidth: 0,
                }}
              >
                <ErrorDigits T={T} />

                <motion.div
                  initial={
                    prefersReducedMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 14,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: prefersReducedMotion ? 0 : 0.18,
                    type: 'spring',
                    stiffness: 120,
                    damping: 16,
                  }}
                >
                  <Typography
                    component="h1"
                    sx={{
                      color: T.textPrimary,
                      fontSize: {
                        xs: '1.45rem',
                        sm: '1.7rem',
                        md: '1.95rem',
                        xl: '2.25rem',
                      },
                      '@media (min-width:1920px)': {
                        fontSize: '2.7rem',
                      },
                      fontWeight: 900,
                      lineHeight: 1.15,
                      mb: {
                        xs: 1.2,
                        sm: 1.4,
                      },
                      ...clampTextSx(2),
                    }}
                  >
                    Lost in the void
                  </Typography>
                </motion.div>

                <motion.div
                  initial={
                    prefersReducedMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 12,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: prefersReducedMotion ? 0 : 0.26,
                    type: 'spring',
                    stiffness: 120,
                    damping: 16,
                  }}
                >
                  <Typography
                    sx={{
                      color: T.textMuted,
                      fontSize: {
                        xs: '0.92rem',
                        sm: '1rem',
                        md: '1.06rem',
                        xl: '1.18rem',
                      },
                      '@media (min-width:1920px)': {
                        fontSize: '1.35rem',
                      },
                      lineHeight: 1.65,
                      maxWidth: {
                        xs: 420,
                        sm: 500,
                        md: 560,
                        xl: 640,
                      },
                      mx: 'auto',
                      mb: {
                        xs: 3,
                        sm: 3.5,
                        md: 4,
                      },
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    This page does not exist in any dimension. Let&apos;s take you
                    back to somewhere useful.
                  </Typography>
                </motion.div>

                <motion.div
                  initial={
                    prefersReducedMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 12,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: prefersReducedMotion ? 0 : 0.34,
                    type: 'spring',
                    stiffness: 120,
                    damping: 16,
                  }}
                >
                  <Stack
                    direction={{
                      xs: 'column',
                      sm: 'row',
                    }}
                    spacing={{
                      xs: 1.2,
                      sm: 1.5,
                    }}
                    justifyContent="center"
                    alignItems={{
                      xs: 'stretch',
                      sm: 'center',
                    }}
                    sx={{
                      maxWidth: {
                        xs: 420,
                        sm: 'none',
                      },
                      mx: 'auto',
                    }}
                  >
                    <Button
                      variant="contained"
                      startIcon={<HomeIcon />}
                      onClick={goHome}
                      sx={{
                        bgcolor: T.teal,
                        color: '#fff',
                        borderRadius: 999,
                        px: {
                          xs: 2.5,
                          sm: 3,
                          xl: 3.6,
                        },
                        py: {
                          xs: 1.05,
                          xl: 1.3,
                        },
                        minHeight: {
                          xs: 44,
                          xl: 52,
                        },
                        fontSize: {
                          xs: '0.9rem',
                          xl: '1.02rem',
                        },
                        fontWeight: 850,
                        textTransform: 'none',
                        boxShadow: `0 0 18px ${T.tealGlow}`,
                        ...focusSx(T.teal),
                        '&:hover': {
                          bgcolor: T.tealHover,
                          boxShadow: `0 0 24px ${T.tealGlow}`,
                        },
                      }}
                    >
                      Go Home
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<LoginIcon />}
                      onClick={goLogin}
                      sx={{
                        color: T.teal,
                        borderColor: T.glassBorder,
                        borderRadius: 999,
                        px: {
                          xs: 2.5,
                          sm: 3,
                          xl: 3.6,
                        },
                        py: {
                          xs: 1.05,
                          xl: 1.3,
                        },
                        minHeight: {
                          xs: 44,
                          xl: 52,
                        },
                        fontSize: {
                          xs: '0.9rem',
                          xl: '1.02rem',
                        },
                        fontWeight: 800,
                        textTransform: 'none',
                        bgcolor: 'rgba(255,255,255,0.025)',
                        ...focusSx(T.teal),
                        '&:hover': {
                          bgcolor: T.tealBg,
                          borderColor: T.teal,
                        },
                      }}
                    >
                      Login
                    </Button>
                  </Stack>
                </motion.div>
              </Box>
            </Box>
          </motion.div>
        </Container>
      </Box>
    </BokehBackground>
  );
}