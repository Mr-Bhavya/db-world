import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

/**
 * Animated circular rating gauge (0-10).
 * Stroke fills proportional to rating, color shifts green > orange > red.
 */
export default function RatingRing({ value, size = 56, stroke = 5, label }) {
  if (value == null) return null;
  const v = Math.max(0, Math.min(10, Number(value)));
  const pct = v / 10;
  const color = v >= 7.5 ? '#4caf50' : v >= 6 ? '#ff9800' : '#f44336';
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box component="svg" sx={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="transparent"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="transparent"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Typography sx={{ color, fontWeight: 800, fontSize: size * 0.32, lineHeight: 1 }}>
          {v.toFixed(1)}
        </Typography>
        {label && (
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: size * 0.13, fontWeight: 600, mt: 0.2, letterSpacing: 0.5 }}>
            {label}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
