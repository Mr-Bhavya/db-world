import React, { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';

export default function LazyImage({ src, alt, onClick, sx }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <Box
      sx={{ position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', ...sx }}
      onClick={onClick}
    >
      {!loaded && !error && (
        <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, bgcolor: '#242424' }} />
      )}
      {!error && (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
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
        <Box sx={{ width: '100%', height: '100%', bgcolor: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ color: '#424242' }}>No image</Typography>
        </Box>
      )}
    </Box>
  );
}
