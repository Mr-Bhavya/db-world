import React, { useState } from 'react';
import { Box, Container, Typography, IconButton, Tooltip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { InfoOutlined } from '@mui/icons-material';
import { useT } from '@shared/theme';

const APP_VERSION = '2.0.0';

const AboutDialog = React.memo(function AboutSection({ open, onClose }) {
    const T = useT();

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 1300,
                        }}
                    />

                    {/* Centered Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1301,
                        }}
                    >
                        <Box
                            sx={{
                                bgcolor: T.glass,
                                backdropFilter: 'blur(16px)',
                                border: `1px solid ${T.glassBorder}`,
                                borderRadius: '24px',
                                p: { xs: '32px 24px', md: '48px 40px' },
                                position: 'relative',
                            }}
                        >
                            {/* Close button */}
                            <Box
                                component="button"
                                type="button"
                                onClick={onClose}
                                aria-label="Close about panel"
                                sx={{
                                    position: 'absolute',
                                    top: 16,
                                    right: 16,
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: T.textMuted,
                                    fontSize: '1.25rem',
                                    lineHeight: 1,
                                    p: 0.5,
                                    borderRadius: 1,
                                    '&:hover': { color: T.textPrimary },
                                }}
                            >
                                ✕
                            </Box>
                            {/* Logo + title row */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 2,
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.5rem' }}>
                                        D
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="h5" sx={{ fontWeight: 700, color: T.textPrimary }}>
                                        DB World
                                    </Typography>
                                    <Typography sx={{ color: T.textMuted, fontSize: '0.9rem' }}>
                                        Version {APP_VERSION}
                                    </Typography>
                                </Box>
                            </Box>
                            <Typography sx={{ color: T.textPrimary, mb: 2 }}>
                                Your personal media universe — everything in one place. DB World brings together
                                entertainment, productivity, and management tools in a seamless, unified experience.
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: T.textPrimary, mb: 1, mt: 3 }}>
                                Features
                            </Typography>
                            <Box component="ul" sx={{ color: T.textMuted, pl: 2, mb: 2 }}>
                                <li>Stream movies and TV shows with DB Cinema</li>
                                <li>Check real-time weather with DB Weather</li>
                                <li>Play browser games with DB Games</li>
                                <li>Secure password management</li>
                                <li>Admin console for system management</li>
                            </Box>
                            <Typography sx={{ color: T.textFaint, fontSize: '0.8rem', mt: 3 }}>
                                © 2026 DB World. All rights reserved.
                            </Typography>
                        </Box>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
});

export default function Footer() {
    const T = useT();
    const [showAbout, setShowAbout] = useState(false);

    return (
        <>
            <Box component="footer" sx={{ bgcolor: T.bg }}>

                {/* Gradient line */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{
                        height: 1,
                        background: `linear-gradient(to right, ${T.teal}, transparent)`,
                        transformOrigin: 'left',
                    }}
                />

                <Container maxWidth="xl">

                    {/* ✅ SINGLE ROW (mobile + desktop) */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: 2,
                            gap: 2,
                        }}
                    >
                        {/* Left */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography sx={{ fontSize: '0.75rem', color: T.textFaint }}>
                                © 2026 DB World
                            </Typography>

                            <Box
                                sx={{
                                    border: `1px solid ${T.glassBorder}`,
                                    borderRadius: 10,
                                    px: 1.5,
                                    py: 0.25,
                                }}
                            >
                                <Typography sx={{ fontSize: '0.68rem', color: T.textFaint }}>
                                    v{APP_VERSION}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Right */}
                        <Tooltip title="About DB World">
                            <IconButton
                                size="small"
                                onClick={() => setShowAbout(true)}
                                sx={{
                                    color: T.textFaint,
                                    '&:hover': { color: T.teal }
                                }}
                            >
                                <InfoOutlined sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>

                </Container>
            </Box>

            {/* About Modal */}
            <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
        </>
    );
}