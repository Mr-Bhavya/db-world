import React from 'react';
import { Box, Button, Chip, Dialog, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export default function VideoDialog({ video, onClose }) {
  if (!video) return null;
  const isYouTube = video.site === 'YOUTUBE';
  const embedUrl = isYouTube
    ? `https://www.youtube.com/embed/${video.key}?&autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&loop=1&enablejsapi=1&playlist=${video.key}`
    : null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#000', borderRadius: 2, overflow: 'hidden' } }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: alpha('#000', 0.6), color: '#fff' }}
        >
          <CloseIcon />
        </IconButton>
        {embedUrl ? (
          <Box
            component="iframe"
            src={embedUrl}
            title={video.name}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            sx={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }}
          />
        ) : (
          <Box sx={{ p: 4, color: '#fff', textAlign: 'center' }}>
            <Typography>Video from {video.site} — not embeddable</Typography>
            {video.key && (
              <Button
                component="a" href={`https://www.youtube.com/watch?v=${video.key}`}
                target="_blank" rel="noopener noreferrer"
                sx={{ mt: 2, color: '#00bcd4' }}
                startIcon={<OpenInNewIcon />}
              >
                Open in YouTube
              </Button>
            )}
          </Box>
        )}
        <Box sx={{ p: 1.5, bgcolor: '#111' }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{video.name}</Typography>
          <Chip label={video.type} size="small" sx={{ mt: 0.5, bgcolor: alpha('#00bcd4', 0.15), color: '#00bcd4', fontSize: '0.65rem', height: 18 }} />
        </Box>
      </Box>
    </Dialog>
  );
}
