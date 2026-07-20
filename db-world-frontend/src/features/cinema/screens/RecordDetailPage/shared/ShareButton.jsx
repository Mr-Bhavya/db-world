import React, { useState } from 'react';
import {
  Box, Button, Dialog, Drawer, IconButton, Slide,
  Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import { tmdbImg } from '../../../api/cinemaApi';
import { publicShareUrl } from '@shared/config/apiBaseUrl';

/* ═══════════════════════════════════════════════════════════
   SOCIAL PLATFORMS
═══════════════════════════════════════════════════════════ */

const SOCIALS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    color: '#25d366',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    urlFn: (url, title) => `https://wa.me/?text=${encodeURIComponent(title + '\n' + url)}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    color: '#0088cc',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    urlFn: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    key: 'twitter',
    label: 'X',
    color: '#fff',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    urlFn: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#1877f2',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    urlFn: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'reddit',
    label: 'Reddit',
    color: '#ff4500',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 00.029-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z" />
      </svg>
    ),
    urlFn: (url, title) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    key: 'email',
    label: 'Email',
    color: '#ea4335',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    urlFn: (url, title, text) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`,
  },
];

/* ═══════════════════════════════════════════════════════════
   z-index must be ABOVE RecordDetailSheet (1300) and its
   backdrop (1299). Using 1400 for the share overlay.
═══════════════════════════════════════════════════════════ */

const SHARE_Z_INDEX = 1400;

/* ═══════════════════════════════════════════════════════════
   QR CODE
═══════════════════════════════════════════════════════════ */

function QrCode({ url, size = 160 }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=1a1a1a&color=ffffff&margin=0`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box
        component="img"
        src={src}
        alt="QR Code"
        draggable={false}
        sx={{
          width: size,
          height: size,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
        Scan to open on your phone
      </Typography>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARE CONTENT
═══════════════════════════════════════════════════════════ */

function ShareContent({ record, shareUrl, shareTitle, shareText, onClose, showQr }) {
  const tmdb = record?.tmdb ?? {};
  const [copied, setCopied] = useState(false);

  const posterUrl = tmdbImg(tmdb.posterPath, 'w154');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  };

  const openSocial = (urlFn) => {
    const url = urlFn(shareUrl, shareTitle, shareText);
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  return (
    <Box sx={{ p: { xs: 2.5, sm: 3 }, pb: { xs: 3.5, sm: 3 } }}>

      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 2.5,
      }}>
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
          Share
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Close share"
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Title card preview */}
      <Box sx={{
        display: 'flex', gap: 1.5, mb: 3,
        bgcolor: 'rgba(255,255,255,0.04)',
        borderRadius: 2, p: 1.25,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {posterUrl && (
          <Box
            component="img"
            src={posterUrl}
            alt={tmdb.title ?? record?.name ?? ''}
            draggable={false}
            sx={{
              width: 52,
              height: 78,
              borderRadius: 1.5,
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography sx={{
            color: '#fff', fontWeight: 700,
            fontSize: '0.88rem', lineHeight: 1.2,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {tmdb.title ?? record?.name}
          </Typography>
          {tmdb.overview && (
            <Typography sx={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.72rem', lineHeight: 1.4, mt: 0.5,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {tmdb.overview}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Social grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
        gap: 1.5, mb: 3,
      }}>
        {SOCIALS.map(({ key, label, color, icon, urlFn }) => (
          <Box
            key={key}
            component={motion.button}
            whileTap={{ scale: 0.92 }}
            onClick={() => openSocial(urlFn)}
            sx={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 0.75,
              bgcolor: 'transparent', border: 'none',
              cursor: 'pointer', p: 1, borderRadius: 2,
              transition: 'background 0.15s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            <Box sx={{
              width: 48, height: 48,
              borderRadius: '50%',
              bgcolor: alpha(color, 0.12),
              border: `1px solid ${alpha(color, 0.25)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: color,
              transition: 'all 0.18s',
            }}>
              {icon}
            </Box>
            <Typography sx={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.65rem', fontWeight: 600,
              textAlign: 'center', lineHeight: 1.2,
            }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Copy link */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: 'rgba(255,255,255,0.05)',
        borderRadius: 1.5, p: 1, mb: showQr ? 3 : 0,
        border: `1px solid ${copied ? alpha('#4caf50', 0.4) : 'rgba(255,255,255,0.08)'}`,
        transition: 'border-color 0.3s',
      }}>
        <Typography sx={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.5)',
          fontSize: '0.78rem', pl: 0.5,
        }}>
          {shareUrl}
        </Typography>
        <Button
          size="small"
          onClick={handleCopy}
          startIcon={
            copied
              ? <CheckIcon sx={{ fontSize: '16px !important' }} />
              : <ContentCopyIcon sx={{ fontSize: '16px !important' }} />
          }
          sx={{
            textTransform: 'none', fontWeight: 700,
            fontSize: '0.75rem', borderRadius: 1.5,
            px: 1.5, py: 0.5, flexShrink: 0,
            color: copied ? '#4caf50' : '#fff',
            bgcolor: copied ? alpha('#4caf50', 0.12) : 'rgba(255,255,255,0.08)',
            '&:hover': {
              bgcolor: copied ? alpha('#4caf50', 0.18) : 'rgba(255,255,255,0.14)',
            },
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </Box>

      {/* QR Code — desktop/TV only */}
      {showQr && (
        <Box sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          pt: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <QrCode url={shareUrl} size={140} />
        </Box>
      )}
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARE BUTTON — main export

   Key fix for RecordDetailSheet compatibility:
   - z-index 1400 on Drawer/Dialog (above sheet's 1300)
   - onTouchStart/onClick stopPropagation on Drawer paper
     to prevent sheet gesture handlers from intercepting
   - data-noexpand on the trigger button (already in Hero)
═══════════════════════════════════════════════════════════ */

export default function ShareButton({ record, size }) {
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTv = useMediaQuery('(min-width:1920px)');

  const [open, setOpen] = useState(false);

  const shareUrl = publicShareUrl();
  const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
  const shareTitle = [tmdb.title, year].filter(Boolean).join(' (') + (year ? ')' : '');
  const shareText = tmdb.overview
    ? tmdb.overview.slice(0, 120) + '…'
    : shareTitle;

  const handleShare = async (e) => {
    // Stop the event from reaching the sheet's gesture handlers
    e.stopPropagation();

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const btnSize = size ?? (isTv ? 52 : isMobile ? 34 : 38);
  const iconSz = isTv ? 24 : isMobile ? 17 : 19;

  const sharedProps = {
    record,
    shareUrl,
    shareTitle,
    shareText,
    onClose: handleClose,
    showQr: !isMobile,
  };

  /**
   * Stops touch/click events inside the share overlay from leaking
   * down to the RecordDetailSheet's gesture handlers.
   */
  const stopSheetGestures = {
    onTouchStart: (e) => e.stopPropagation(),
    onTouchMove: (e) => e.stopPropagation(),
    onTouchEnd: (e) => e.stopPropagation(),
    onClick: (e) => e.stopPropagation(),
    onPointerDown: (e) => e.stopPropagation(),
  };

  return (
    <>
      <Tooltip title="Share" placement="top">
        <IconButton
          size="small"
          onClick={handleShare}
          aria-label="Share"
          sx={{
            bgcolor: alpha('#fff', 0.1),
            border: `1.5px solid ${alpha('#fff', 0.2)}`,
            color: '#b3b3b3',
            width: btnSize, height: btnSize,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: alpha('#fff', 0.18),
              transform: 'scale(1.08)',
            },
          }}
        >
          <ShareIcon sx={{ fontSize: iconSz }} />
        </IconButton>
      </Tooltip>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={open}
          onClose={handleClose}
          // CRITICAL: z-index above RecordDetailSheet (1300)
          sx={{ zIndex: SHARE_Z_INDEX }}
          slotProps={{
            backdrop: {
              sx: {
                zIndex: SHARE_Z_INDEX,
                bgcolor: 'rgba(0,0,0,0.6)',
              },
              // Stop backdrop clicks from reaching the sheet
              ...stopSheetGestures,
            },
          }}
          PaperProps={{
            sx: {
              bgcolor: '#1a1a1a',
              color: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '85vh',
              zIndex: SHARE_Z_INDEX + 1,
              // Grab handle
              '&::before': {
                content: '""',
                display: 'block',
                width: 36, height: 4,
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: 2,
                mx: 'auto', mt: 1.5, mb: 0.5,
              },
            },
            // Stop paper touch/click from reaching the sheet
            ...stopSheetGestures,
          }}
        >
          <ShareContent {...sharedProps} />
          {/* Bottom safe area for notched phones */}
          <Box sx={{ pb: 'env(safe-area-inset-bottom, 8px)' }} />
        </Drawer>
      ) : (
        <Dialog
          open={open}
          onClose={handleClose}
          maxWidth="xs"
          fullWidth
          // CRITICAL: z-index above RecordDetailSheet
          sx={{ zIndex: SHARE_Z_INDEX }}
          TransitionComponent={Slide}
          TransitionProps={{ direction: 'up' }}
          PaperProps={{
            sx: {
              bgcolor: '#1a1a1a',
              color: '#fff',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.08)',
              backgroundImage: 'none',
              maxWidth: isTv ? 520 : 420,
            },
            ...stopSheetGestures,
          }}
          slotProps={{
            backdrop: {
              sx: {
                bgcolor: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
              },
              ...stopSheetGestures,
            },
          }}
        >
          <ShareContent {...sharedProps} />
        </Dialog>
      )}
    </>
  );
}