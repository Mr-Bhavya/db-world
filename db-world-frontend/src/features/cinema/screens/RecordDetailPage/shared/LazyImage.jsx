import React, { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useT } from '@shared/theme/ThemeContext';

export default function LazyImage({ src, alt, onClick, sx }) {
  const T = useT();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        '&:focus-visible': onClick ? {
          outline: `3px solid ${T.teal}`,
          outlineOffset: 2,
        } : undefined,
        ...sx,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={onClick ? `Open ${alt || 'image'}` : undefined}
    >
      {!loaded && !error && (
        <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, bgcolor: alpha(T.text, 0.08) }} />
      )}
      {!error && (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          // Hands the decode to a background thread. Without it the browser decodes
          // on the main thread as each image arrives, which is felt as scroll stutter
          // on exactly the phones that can least afford it.
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s',
            display: 'block',
          }}
        />
      )}
      {error && (
        <Box sx={{ width: '100%', height: '100%', bgcolor: alpha(T.text, 0.04), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ color: T.textFaint }}>No image</Typography>
        </Box>
      )}
    </Box>
  );
}
