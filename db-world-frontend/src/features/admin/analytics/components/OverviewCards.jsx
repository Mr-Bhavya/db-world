import React from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { Group, CloudDownload, CheckCircle, Cancel } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';

const ACCENTS = {
  teal:   { fg: '#0d9488', bg: 'rgba(13,148,136,0.12)' },
  blue:   { fg: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  green:  { fg: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  red:    { fg: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function Tile({ icon, label, value, suffix, accent, index = 0 }) {
  const T = useT();
  const a = ACCENTS[accent] ?? ACCENTS.teal;
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      sx={{
        flex: '1 1 200px', minWidth: 0,
        bgcolor: T.glass,
        border: `1px solid ${T.border}`,
        borderRadius: 2,
        p: { xs: 1.5, sm: 2 },
        display: 'flex', alignItems: 'center', gap: 1.5,
        transition: 'border-color .15s, transform .15s',
        '&:hover': { borderColor: T.borderHover, transform: 'translateY(-1px)' },
      }}
    >
      <Box sx={{
        width: 42, height: 42, borderRadius: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: a.bg, color: a.fg,
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 22 } })}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{
          fontSize: 10, color: T.textFaint, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700, lineHeight: 1.4,
        }}>
          {label}
        </Typography>
        <Typography sx={{
          fontSize: { xs: '1.1rem', sm: '1.3rem' }, fontWeight: 800,
          lineHeight: 1.2, color: T.text,
        }}>
          {value}
          {suffix && (
            <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, color: T.textFaint, ml: 0.5 }}>
              {suffix}
            </Box>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

export default function OverviewCards({ data, loading }) {
  const T = useT();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i} variant="rounded" height={74}
            sx={{ flex: '1 1 200px', bgcolor: T.glass }}
          />
        ))}
      </Box>
    );
  }
  if (!data) return null;

  return (
    <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap' }}>
      <Tile index={0} accent="teal"  icon={<Group />}         label="Active users (7d)"    value={data.activeUsers7d ?? 0} />
      <Tile index={1} accent="blue"  icon={<CloudDownload />} label="Transferred (7d)"     value={Number(data.gbTransferred7d ?? 0).toFixed(2)} suffix="GB" />
      <Tile index={2} accent="green" icon={<CheckCircle />}   label="Completed (7d)"       value={data.completedTransfers7d ?? 0} />
      <Tile index={3} accent="red"   icon={<Cancel />}        label="Aborted rate (7d)"    value={Number(data.abortedRate7d ?? 0).toFixed(1)} suffix="%" />
    </Box>
  );
}
