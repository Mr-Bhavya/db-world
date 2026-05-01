import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';

export default function SectionHeading({ label }) {
  const T = useT();

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 3,
            height: 20,
            borderRadius: 4,
            bgcolor: T.teal,
            flexShrink: 0,
          }}
        />
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: T.teal,
            flexShrink: 0,
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            flex: 1,
            height: '1px',
            bgcolor: T.border,
          }}
        />
      </Box>
    </motion.div>
  );
}
