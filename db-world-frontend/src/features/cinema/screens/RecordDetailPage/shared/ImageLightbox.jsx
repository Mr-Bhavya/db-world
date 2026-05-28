import React, { useState, useCallback } from 'react';
import { Box, Chip, Dialog, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { tmdbImg } from '../../../api/cinemaApi';

export default function ImageLightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex ?? 0);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const handleKey = useCallback((e) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'Escape') onClose();
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const img = images[idx];
  if (!img) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.97)', borderRadius: 2 } }}
      onKeyDown={handleKey}
    >
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, bgcolor: alpha('#000', 0.6), color: '#fff' }}
        >
          <CloseIcon />
        </IconButton>

        {images.length > 1 && (
          <>
            <IconButton
              onClick={prev}
              sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2, bgcolor: alpha('#000', 0.6), color: '#fff' }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              onClick={next}
              sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2, bgcolor: alpha('#000', 0.6), color: '#fff' }}
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        )}

        <Box
          component="img"
          src={tmdbImg(img.filePath, 'original')}
          alt={img.imageType ?? 'Image'}
          sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
        />

        <Box sx={{ p: 1.5, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip label={img.imageType ?? 'Image'} size="small" sx={{ bgcolor: '#1e1e1e', color: '#b3b3b3', fontSize: '0.68rem' }} />
            {img.width && img.height && (
              <Typography variant="caption" sx={{ color: '#757575' }}>{img.width} × {img.height}</Typography>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: '#757575' }}>{idx + 1} / {images.length}</Typography>
        </Box>
      </Box>
    </Dialog>
  );
}
