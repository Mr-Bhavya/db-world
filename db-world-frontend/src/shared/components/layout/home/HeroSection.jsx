import React, { memo } from 'react';

import {
    Typography,
  Box,
  Button,
  Container,

} from '@mui/material';

import { motion, useReducedMotion } from 'framer-motion';
import { MovieFilter as CinemaIcon } from '@mui/icons-material';

import BokehBackground from '@shared/components/ui/BokehBackground';

import ScrollIndicator from './ScrollIndicator';
import { cardFocusSx, clampTextSx } from './homeStyles';

const HeroSection = memo(function HeroSection({
  T,
  firstName,
  visibleApps,
  scrolled,
  onNavigate,
  openCinema,
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <BokehBackground
      height={{
        xs: 'auto',
        sm: '100svh',
        md: '100svh',
      }}
      vignette
    >
      <Box
        component="section"
        sx={{
          position: 'relative',
          minHeight: {
            // Phones: shrink to content so the apps grid sits just below the
            // fold instead of behind a full-screen wall of text.
            xs: 'auto',
            sm: '100svh',
          },
          pt: {
            xs: '84px',
            sm: '84px',
            md: '96px',
            xl: '112px',
          },
          pb: {
            xs: '36px',
            sm: '80px',
            md: '110px',
            xl: '140px',
          },
          px: {
            xs: 2,
            sm: 3,
            md: 5,
            xl: 8,
          },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            width: '100%',
            maxWidth: {
              xs: '100%',
              sm: 760,
              md: 1040,
              lg: 1180,
              xl: 1440,
            },
            '@media (min-width:1920px)': {
              maxWidth: 1720,
            },
            px: 0,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)',
              },
              alignItems: 'center',
              gap: {
                xs: 4,
                md: 6,
                xl: 9,
              },
              minWidth: 0,
            }}
          >
            {/* Left hero text */}
            <Box
              sx={{
                textAlign: {
                  xs: 'center',
                  lg: 'left',
                },
                minWidth: 0,
                mx: {
                  xs: 'auto',
                  lg: 0,
                },
                maxWidth: {
                  xs: 720,
                  lg: 760,
                  xl: 900,
                },
              }}
            >
              <motion.div
                initial={{
                  opacity: 0,
                  y: prefersReducedMotion ? 0 : 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.05,
                  type: 'spring',
                  stiffness: 100,
                  damping: 16,
                }}
              >
                <Typography
                  sx={{
                    color: T.textMuted,
                    fontSize: {
                      xs: '0.68rem',
                      sm: '0.74rem',
                      md: '0.78rem',
                      xl: '0.9rem',
                    },
                    '@media (min-width:1920px)': {
                      fontSize: '1rem',
                    },
                    fontWeight: 900,
                    letterSpacing: {
                      xs: '0.14em',
                      sm: '0.18em',
                    },
                    textTransform: 'uppercase',
                    mb: {
                      xs: 1.4,
                      md: 1.8,
                    },
                    lineHeight: 1.4,
                  }}
                >
                  Your Personal Universe
                </Typography>
              </motion.div>

              <motion.div
                initial={{
                  opacity: 0,
                  y: prefersReducedMotion ? 0 : 18,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.15,
                  type: 'spring',
                  stiffness: 100,
                  damping: 16,
                }}
              >
                <Typography
                  component="h1"
                  sx={{
                    color: T.textPrimary,
                    fontWeight: 950,
                    letterSpacing: {
                      xs: '-0.035em',
                      md: '-0.045em',
                    },
                    lineHeight: {
                      xs: 1.08,
                      sm: 1.04,
                      md: 1.02,
                    },
                    fontSize: {
                      xs: 'clamp(2.15rem, 12vw, 3.5rem)',
                      sm: 'clamp(3rem, 8vw, 5rem)',
                      md: 'clamp(4rem, 6vw, 6.4rem)',
                      xl: 'clamp(5.4rem, 5vw, 7.4rem)',
                    },
                    '@media (min-width:1920px)': {
                      fontSize: 'clamp(6.6rem, 4.8vw, 9rem)',
                    },
                    mb: {
                      xs: 1.5,
                      sm: 2.4,
                      md: 3,
                    },
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
                </Typography>
              </motion.div>

              <motion.div
                initial={{
                  opacity: 0,
                  y: prefersReducedMotion ? 0 : 16,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.25,
                  type: 'spring',
                  stiffness: 100,
                  damping: 16,
                }}
              >
                <Typography
                  sx={{
                    color: T.textMuted,
                    fontSize: {
                      xs: '0.98rem',
                      sm: '1.08rem',
                      md: '1.15rem',
                      xl: '1.28rem',
                    },
                    '@media (min-width:1920px)': {
                      fontSize: '1.45rem',
                    },
                    lineHeight: 1.65,
                    maxWidth: {
                      xs: 620,
                      lg: 680,
                      xl: 820,
                    },
                    mx: {
                      xs: 'auto',
                      lg: 0,
                    },
                    mb: {
                      xs: 2.5,
                      sm: 3.4,
                      md: 4,
                    },
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  Your personal media universe — stream, play, check weather,
                  and manage your secure vault from one responsive dashboard.
                </Typography>
              </motion.div>

              <motion.div
                initial={{
                  opacity: 0,
                  y: prefersReducedMotion ? 0 : 14,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.34,
                  type: 'spring',
                  stiffness: 100,
                  damping: 16,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: {
                      xs: 'center',
                      lg: 'flex-start',
                    },
                  }}
                >
                  <Button
                    variant="contained"
                    onClick={openCinema}
                    startIcon={<CinemaIcon sx={{ fontSize: { xs: '1.15rem', xl: '1.3rem' } }} />}
                    sx={{
                      // Content-width (not full-width) so it stays well-proportioned
                      // on any phone size or font scale; centred on mobile, left on lg.
                      bgcolor: T.teal,
                      color: '#fff',
                      borderRadius: 2.2,
                      px: {
                        xs: 3.4,
                        sm: 3.6,
                        xl: 4.4,
                      },
                      py: {
                        xs: 1.2,
                        xl: 1.45,
                      },
                      minHeight: {
                        xs: 48,
                        xl: 56,
                      },
                      fontSize: {
                        xs: '0.96rem',
                        xl: '1.08rem',
                      },
                      fontWeight: 900,
                      textTransform: 'none',
                      boxShadow: `0 0 22px ${T.tealGlow}`,
                      '&:hover': {
                        bgcolor: T.tealHover,
                        boxShadow: `0 0 28px ${T.tealGlow}`,
                      },
                    }}
                  >
                    Browse Cinema
                  </Button>
                </Box>
              </motion.div>
            </Box>

            {/* Right quick launch panel */}
            <Box
              sx={{
                display: {
                  xs: 'none',
                  lg: 'block',
                },
                minWidth: 0,
              }}
            >
              <motion.div
                initial={{
                  opacity: 0,
                  scale: prefersReducedMotion ? 1 : 0.96,
                  y: prefersReducedMotion ? 0 : 18,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.28,
                  type: 'spring',
                  stiffness: 90,
                  damping: 18,
                }}
              >
                <Box
                  sx={{
                    p: {
                      lg: 2.2,
                      xl: 2.8,
                    },
                    '@media (min-width:1920px)': {
                      p: 3.4,
                    },
                    borderRadius: {
                      lg: 4,
                      xl: 5,
                    },
                    border: `1px solid ${T.glassBorder}`,
                    bgcolor: 'rgba(255,255,255,0.035)',
                    backdropFilter: 'blur(18px)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
                    minWidth: 0,
                  }}
                >
                  <Typography
                    sx={{
                      color: T.textMuted,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      fontSize: {
                        lg: '0.75rem',
                        xl: '0.86rem',
                      },
                      mb: 2,
                    }}
                  >
                    Quick Launch
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: {
                        lg: 1.4,
                        xl: 1.8,
                      },
                      minWidth: 0,
                    }}
                  >
                    {visibleApps.slice(0, 4).map((app) => {
                      const Icon = app.Icon;

                      return (
                        <Box
                          key={app.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onNavigate(app)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onNavigate(app);
                            }
                          }}
                          aria-label={`Open ${app.label}`}
                          sx={{
                            minWidth: 0,
                            p: {
                              lg: 1.5,
                              xl: 1.9,
                            },
                            '@media (min-width:1920px)': {
                              p: 2.3,
                            },
                            borderRadius: 3,
                            border: `1px solid ${T.glassBorder}`,
                            bgcolor: 'rgba(0,0,0,0.14)',
                            cursor: 'pointer',
                            transition:
                              'transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
                            ...cardFocusSx(app.accent),
                            '&:hover': {
                              transform: prefersReducedMotion
                                ? 'none'
                                : 'translateY(-3px)',
                              borderColor: `${app.accent}99`,
                              bgcolor: `${app.accent}18`,
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: {
                                lg: 42,
                                xl: 50,
                              },
                              height: {
                                lg: 42,
                                xl: 50,
                              },
                              '@media (min-width:1920px)': {
                                width: 62,
                                height: 62,
                              },
                              borderRadius: 2.2,
                              background: app.gradient,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mb: 1.2,
                            }}
                          >
                            <Icon
                              sx={{
                                color: '#fff',
                                fontSize: {
                                  lg: 23,
                                  xl: 28,
                                },
                                '@media (min-width:1920px)': {
                                  fontSize: 34,
                                },
                              }}
                            />
                          </Box>

                          <Typography
                            sx={{
                              color: T.textPrimary,
                              fontWeight: 900,
                              fontSize: {
                                lg: '0.9rem',
                                xl: '1.04rem',
                              },
                              '@media (min-width:1920px)': {
                                fontSize: '1.18rem',
                              },
                              lineHeight: 1.2,
                              mb: 0.4,
                              ...clampTextSx(1),
                            }}
                          >
                            {app.label}
                          </Typography>

                          <Typography
                            sx={{
                              color: T.textMuted,
                              fontSize: {
                                lg: '0.74rem',
                                xl: '0.84rem',
                              },
                              '@media (min-width:1920px)': {
                                fontSize: '0.96rem',
                              },
                              lineHeight: 1.4,
                              ...clampTextSx(2),
                            }}
                          >
                            {app.description}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </motion.div>
            </Box>
          </Box>
        </Container>

        <ScrollIndicator scrolled={scrolled} T={T} />
      </Box>
    </BokehBackground>
  );
});

HeroSection.displayName = 'HeroSection';

export default HeroSection;