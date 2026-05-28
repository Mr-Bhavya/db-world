import React, { useState } from 'react';
import { Box, Button, Dialog, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

export default function ShareButton({ record }) {
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const shareUrl = window.location.href;
  const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
  const shareTitle = [tmdb.title, year].filter(Boolean).join(' (') + (year ? ')' : '');
  const shareText = tmdb.overview ? tmdb.overview.slice(0, 120) + '…' : shareTitle;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch (e) {
        if (e?.name !== 'AbortError') setDialogOpen(true);
      }
    } else {
      setDialogOpen(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <>
      <Tooltip title="Share" placement="top">
        <IconButton
          size="small"
          onClick={handleShare}
          sx={{
            bgcolor: alpha('#fff', 0.1),
            border: `1.5px solid ${alpha('#fff', 0.2)}`,
            color: '#b3b3b3',
            width: 38, height: 38,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: alpha('#fff', 0.18) },
          }}
        >
          <ShareIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1a1a', color: '#fff', borderRadius: 2 } }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Share</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>{shareTitle}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1.5, p: 1.2 }}>
            <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
              {shareUrl}
            </Typography>
            <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? '#4caf50' : '#fff', flexShrink: 0 }}>
              {copied ? <CheckIcon sx={{ fontSize: 18 }} /> : <ContentCopyIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank')}
              sx={{ borderColor: '#1da1f2', color: '#1da1f2', textTransform: 'none', fontSize: '0.78rem' }}>
              Twitter / X
            </Button>
            <Button size="small" variant="outlined" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}
              sx={{ borderColor: '#1877f2', color: '#1877f2', textTransform: 'none', fontSize: '0.78rem' }}>
              Facebook
            </Button>
            <Button size="small" variant="outlined" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`, '_blank')}
              sx={{ borderColor: '#25d366', color: '#25d366', textTransform: 'none', fontSize: '0.78rem' }}>
              WhatsApp
            </Button>
          </Box>
          <Button fullWidth onClick={() => setDialogOpen(false)} sx={{ mt: 2, color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>
            Close
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
