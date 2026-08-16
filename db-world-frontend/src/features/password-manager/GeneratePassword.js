import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { notify } from '@shared/notify';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Box, Button, Container, IconButton, Slider, Tooltip, Typography,
} from '@mui/material';
import {
  ContentCopyRounded, CheckRounded, RefreshRounded, VpnKeyRounded,
  ShuffleRounded, TuneRounded,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import usePageMeta from '@shared/hooks/usePageMeta';
import CommonServices from '@shared/services/CommonServices';
import {
  generatePassword, generatePassphrase, scorePassword,
} from './passwordUtils';
import { VaultAurora, StrengthMeter, BackLink, GlassPanel, useScrollTop } from './vaultShared';

// ─── Character-set toggle pill ────────────────────────────────────────────────
const TogglePill = ({ label, active, onClick, T }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    aria-pressed={active}
    sx={{
      appearance: 'none',
      cursor: 'pointer',
      px: 1.75,
      minHeight: 40,
      borderRadius: 999,
      fontSize: '0.82rem',
      fontWeight: 800,
      letterSpacing: 0.2,
      transition: 'all .2s ease',
      color: active ? '#fff' : T.textMuted,
      bgcolor: active ? T.teal : 'transparent',
      border: `1px solid ${active ? T.teal : T.glassBorder}`,
      boxShadow: active ? `0 0 18px ${T.tealGlow}` : 'none',
      '&:hover': { borderColor: T.teal, color: active ? '#fff' : T.teal },
      '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
    }}
  >
    {label}
  </Box>
);

// ─── Per-character colour coding for the readout ──────────────────────────────
const ColoredValue = ({ value, T }) => {
  const chars = useMemo(() => Array.from(value), [value]);
  return (
    <Box
      component="span"
      sx={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 'clamp(1.05rem, 4.5vw, 1.7rem)',
        fontWeight: 700,
        lineHeight: 1.45,
        letterSpacing: 1,
        wordBreak: 'break-all',
      }}
    >
      {chars.map((ch, i) => {
        const isNum = /[0-9]/.test(ch);
        const isSym = /[^a-zA-Z0-9]/.test(ch);
        const color = isNum ? '#2dd4bf' : isSym ? '#f59e0b' : T.textPrimary;
        return (
          <Box key={i} component="span" sx={{ color }}>
            {ch}
          </Box>
        );
      })}
    </Box>
  );
};

const GeneratePassword = () => {
  usePageMeta('Password Generator');
  useScrollTop();

  const T = useT();
  const reduce = useReducedMotion();

  const [mode, setMode]       = useState('password'); // 'password' | 'passphrase'
  const [length, setLength]   = useState(18);
  const [words, setWords]     = useState(4);
  const [opts, setOpts]       = useState({ upper: true, lower: true, numbers: true, symbols: true, excludeSimilar: false });
  const [value, setValue]     = useState('');
  const [copied, setCopied]   = useState(false);
  const [spin, setSpin]       = useState(0);
  const [history, setHistory] = useState([]);

  const noPools = mode === 'password' && !opts.upper && !opts.lower && !opts.numbers && !opts.symbols;

  const regen = useCallback((pushHistory = false) => {
    const next = mode === 'passphrase'
      ? generatePassphrase({ words })
      : generatePassword({ length, ...opts });
    if (!next) return;
    setValue((prev) => {
      if (pushHistory && prev) setHistory((h) => [prev, ...h].slice(0, 4));
      return next;
    });
    setSpin((s) => s + 1);
  }, [mode, words, length, opts]);

  // Live regenerate as controls change (modern generator UX).
  useEffect(() => {
    if (noPools) return;
    regen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, length, words, opts.upper, opts.lower, opts.numbers, opts.symbols, opts.excludeSimilar]);

  const score = useMemo(() => scorePassword(value), [value]);

  const toggle = (key) =>
    setOpts((o) => {
      const next = { ...o, [key]: !o[key] };
      // Never allow every pool off.
      if (!next.upper && !next.lower && !next.numbers && !next.symbols) return o;
      return next;
    });

  const copy = async () => {
    if (!value) return;
    const res = await CommonServices.handleCopy(value);
    if (res.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      notify.error('Copy failed — try manually');
    }
  };

  return (
    <Box sx={{ position: 'relative', bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' }, overflowX: 'hidden' }}>
      <VaultAurora />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ mb: 2 }}><BackLink /></Box>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel sx={{ p: { xs: 2.25, sm: 3.25 } }}>
            {/* Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box sx={{ width: 46, height: 46, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: T.tealBg, border: `1px solid ${T.teal}44` }}>
                <VpnKeyRounded sx={{ fontSize: 23, color: T.teal }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 'clamp(1.15rem, 4.5vw, 1.4rem)', fontWeight: 900, color: T.textPrimary, lineHeight: 1.1 }}>
                  Generator
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                  Cryptographically secure · unbiased
                </Typography>
              </Box>
            </Box>

            {/* Mode switch */}
            <Box
              sx={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                p: 0.5,
                mb: 2.5,
                borderRadius: 999,
                bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <motion.div
                aria-hidden
                animate={{ x: mode === 'password' ? '0%' : '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                  position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)',
                  borderRadius: 999, background: T.teal,
                }}
              />
              {['password', 'passphrase'].map((m) => (
                <Box
                  key={m}
                  component="button"
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  sx={{
                    position: 'relative', zIndex: 1, appearance: 'none', cursor: 'pointer',
                    background: 'transparent', border: 'none', minHeight: 40, borderRadius: 999,
                    fontSize: '0.85rem', fontWeight: 800, textTransform: 'capitalize',
                    color: mode === m ? '#fff' : T.textMuted, transition: 'color .2s ease',
                    '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
                  }}
                >
                  {m}
                </Box>
              ))}
            </Box>

            {/* Readout */}
            <Box
              sx={{
                position: 'relative',
                p: { xs: 1.75, sm: 2 },
                minHeight: 96,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 3,
                bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${T.glassBorder}`,
                overflow: 'hidden',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${value}-${spin}`}
                  initial={reduce ? false : { opacity: 0, filter: 'blur(6px)', y: 6 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, filter: 'blur(6px)', y: -6 }}
                  transition={{ duration: 0.28 }}
                  style={{ width: '100%' }}
                >
                  <ColoredValue value={value} T={T} />
                </motion.div>
              </AnimatePresence>
            </Box>

            {/* Strength + actions row */}
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <StrengthMeter score={score} />
              </Box>
              <Tooltip title="Regenerate">
                <IconButton
                  onClick={() => regen(true)}
                  disabled={noPools}
                  aria-label="Regenerate"
                  sx={{ width: 44, height: 44, color: T.teal, border: `1px solid ${T.glassBorder}`, '&:hover': { bgcolor: T.tealBg, borderColor: T.teal } }}
                >
                  <motion.div key={spin} animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 0.5, ease: 'easeInOut' }} style={{ display: 'grid', placeItems: 'center' }}>
                    <RefreshRounded />
                  </motion.div>
                </IconButton>
              </Tooltip>
              <Button
                onClick={copy}
                disabled={!value}
                startIcon={copied ? <CheckRounded /> : <ContentCopyRounded sx={{ fontSize: 18 }} />}
                sx={{
                  minHeight: 44, px: 2, borderRadius: 2, fontWeight: 800, whiteSpace: 'nowrap',
                  color: '#fff', // white in both states; only the background changes
                  bgcolor: copied ? '#22c55e' : T.teal,
                  transition: 'background .25s ease',
                  '&:hover': { bgcolor: copied ? '#16a34a' : '#0f766e' },
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </Box>

            {/* Controls */}
            <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${T.glassBorder}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: T.textMuted }}>
                <TuneRounded sx={{ fontSize: 18 }} />
                <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Options
                </Typography>
              </Box>

              {mode === 'password' ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.85rem', color: T.textMuted }}>Length</Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: T.teal, fontVariantNumeric: 'tabular-nums' }}>{length}</Typography>
                  </Box>
                  <Slider
                    value={length}
                    min={6}
                    max={40}
                    onChange={(_, v) => setLength(v)}
                    aria-label="Password length"
                    sx={{ color: T.teal, '& .MuiSlider-rail': { bgcolor: T.glassBorder, opacity: 1 }, '& .MuiSlider-thumb': { '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 8px ${T.tealGlow}` } } }}
                  />

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                    <TogglePill label="A-Z"   active={opts.upper}   onClick={() => toggle('upper')}   T={T} />
                    <TogglePill label="a-z"   active={opts.lower}   onClick={() => toggle('lower')}   T={T} />
                    <TogglePill label="0-9"   active={opts.numbers} onClick={() => toggle('numbers')} T={T} />
                    <TogglePill label="!@#$"  active={opts.symbols} onClick={() => toggle('symbols')} T={T} />
                    <TogglePill label="No look-alikes" active={opts.excludeSimilar} onClick={() => setOpts((o) => ({ ...o, excludeSimilar: !o.excludeSimilar }))} T={T} />
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.85rem', color: T.textMuted }}>Words</Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: T.teal, fontVariantNumeric: 'tabular-nums' }}>{words}</Typography>
                  </Box>
                  <Slider
                    value={words}
                    min={3}
                    max={8}
                    onChange={(_, v) => setWords(v)}
                    aria-label="Word count"
                    sx={{ color: T.teal, '& .MuiSlider-rail': { bgcolor: T.glassBorder, opacity: 1 }, '& .MuiSlider-thumb': { '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 8px ${T.tealGlow}` } } }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, color: T.textFaint }}>
                    <ShuffleRounded sx={{ fontSize: 16 }} />
                    <Typography sx={{ fontSize: '0.78rem' }}>Memorable, capitalised words + a number.</Typography>
                  </Box>
                </>
              )}
            </Box>

            {/* Session history */}
            <AnimatePresence>
              {history.length > 0 && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${T.glassBorder}` }}>
                    <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: T.textMuted, mb: 1 }}>
                      Recent
                    </Typography>
                    {history.map((h, i) => (
                      <Box key={`${h}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6 }}>
                        <Typography sx={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h}
                        </Typography>
                        <Tooltip title="Copy">
                          <IconButton size="small" onClick={() => CommonServices.handleCopy(h)} sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}>
                            <ContentCopyRounded sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassPanel>
        </motion.div>
      </Container>
    </Box>
  );
};

export default GeneratePassword;
