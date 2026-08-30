import React from 'react';
import { Box } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import { useT } from '@shared/theme';

/**
 * The unlock affordance on the launch gate.
 *
 * Deliberately NOT {@link FingerprintPulse}, which the vault gate and the enrol prompt share.
 * Those screens are destinations you arrive at occasionally, so a large animated emblem earns
 * its space. This one is the first thing seen on every single app open, where the same emblem
 * becomes noise — so it is a third of the size, sits in the thumb zone, and holds completely
 * still unless something is actually happening.
 *
 * It is a real button rather than decoration: the system biometric sheet opens by itself on
 * mount, so the only reason to touch this is to retry after dismissing it, and on Android the
 * sensor glyph is already the understood target for that.
 */
export default function UnlockSensor({ state = 'idle', onPress, disabled = false, size = 72 }) {
  const T = useT();
  const reduce = useReducedMotion();

  const scanning = state === 'scanning';
  const success = state === 'success';
  const error = state === 'error';

  const color = error ? T.error : success ? T.success : T.teal;

  return (
    <Box
      component={motion.button}
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={success ? 'Unlocked' : 'Unlock with fingerprint or face'}
      // The shake is the OS convention for a rejected credential, so it reads as "not
      // recognised" before the words are even parsed. Two cycles, then rest.
      animate={error && !reduce ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      whileTap={disabled || reduce ? undefined : { scale: 0.94 }}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        p: 0,
        border: 'none',
        borderRadius: '50%',
        bgcolor: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 4 },
      }}
    >
      {/*
        A single sweep, only while the sensor is actually reading. The resting state animates
        nothing at all: an ambient loop on a screen opened twenty times a day is just motion
        the user learns to ignore, and it keeps the GPU awake for no reason.
      */}
      {scanning && !reduce && (
        <Box
          component={motion.span}
          aria-hidden
          initial={{ scale: 1, opacity: 0.45 }}
          animate={{ scale: 1.38, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${color}` }}
        />
      )}

      <Box
        component={motion.span}
        aria-hidden
        animate={{ borderColor: color, opacity: disabled && !success ? 0.5 : 1 }}
        transition={{ duration: 0.28 }}
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `1.5px solid ${color}`,
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {success ? (
          <Box
            key="ok"
            component={motion.span}
            initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            sx={{ display: 'flex' }}
          >
            <CheckRoundedIcon sx={{ fontSize: size * 0.4, color }} />
          </Box>
        ) : (
          <Box
            key="fp"
            component={motion.span}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            sx={{ display: 'flex' }}
          >
            <FingerprintRoundedIcon sx={{ fontSize: size * 0.46, color }} />
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
}
