import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Menu, MenuItem, Skeleton, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import IosShareIcon from '@mui/icons-material/IosShare';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useT } from '@shared/theme';
import { fetchThumbnailBlob } from '../api/walletApi';

export default function DocumentCard({ doc, onPreview, onDownload, onEdit, onShare, onDelete, index = 0 }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const isImage = doc.contentType?.startsWith('image/');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.04 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      style={{ height: '100%' }}
    >
      <Box
        onClick={() => onPreview(doc)}
        sx={{
          bgcolor: T.glass,
          border: `1px solid ${T.border}`,
          borderRadius: 3,
          overflow: 'hidden',
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': { borderColor: T.teal, boxShadow: `0 8px 24px ${T.tealGlow || 'rgba(13,148,136,0.20)'}` },
        }}
      >
        <ThumbArea doc={doc} isImage={isImage} T={T} />

        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }} noWrap>
            {doc.label}
          </Typography>
          {doc.maskedNumber && (
            <Typography sx={{ fontSize: 12, color: T.textMuted, fontFamily: 'monospace' }} noWrap>
              {doc.maskedNumber}
            </Typography>
          )}
          {doc.holderName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <PersonOutlineIcon sx={{ fontSize: 14, color: T.textFaint }} />
              <Typography sx={{ fontSize: 11.5, color: T.textFaint }} noWrap>
                {doc.holderName}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Typography sx={{ fontSize: 11, color: T.textFaint }}>
              {isImage ? 'Image' : 'PDF'}
            </Typography>
            <IconButton
              size="small"
              aria-label="Document actions"
              onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
              sx={{ color: T.textFaint }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
          onClick={(e) => e.stopPropagation()}
          PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 2 } }}
        >
          <MenuItem onClick={() => { setAnchor(null); onPreview(doc); }} sx={{ color: T.textMuted, '&:hover': { bgcolor: T.tealBg } }}>
            <VisibilityIcon sx={{ mr: 1.5, fontSize: 18 }} /> View
          </MenuItem>
          <MenuItem onClick={() => { setAnchor(null); onDownload(doc); }} sx={{ color: T.textMuted, '&:hover': { bgcolor: T.tealBg } }}>
            <DownloadIcon sx={{ mr: 1.5, fontSize: 18 }} /> Download
          </MenuItem>
          <MenuItem onClick={() => { setAnchor(null); onEdit(doc); }} sx={{ color: T.textMuted, '&:hover': { bgcolor: T.tealBg } }}>
            <EditIcon sx={{ mr: 1.5, fontSize: 18 }} /> Edit
          </MenuItem>
          <MenuItem onClick={() => { setAnchor(null); onShare(doc); }} sx={{ color: T.textMuted, '&:hover': { bgcolor: T.tealBg } }}>
            <IosShareIcon sx={{ mr: 1.5, fontSize: 18 }} /> Share
          </MenuItem>
          <MenuItem onClick={() => { setAnchor(null); onDelete(doc); }} sx={{ color: T.error, '&:hover': { bgcolor: T.tealBg } }}>
            <DeleteOutlineIcon sx={{ mr: 1.5, fontSize: 18, color: T.error }} /> Delete
          </MenuItem>
        </Menu>
      </Box>
    </motion.div>
  );
}

function ThumbArea({ doc, isImage, T }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(!!doc.hasThumbnail);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!doc.hasThumbnail) return;
    let objectUrl; let cancelled = false;
    setLoading(true);
    setError(false);
    fetchThumbnailBlob(doc.id)
      .then((blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, doc.hasThumbnail]);

  const showTypeChip = doc.typeDisplayName && doc.label !== doc.typeDisplayName;

  return (
    <Box sx={{ width: '100%', height: { xs: 150, sm: 132 }, position: 'relative', flexShrink: 0 }}>
      {doc.hasThumbnail ? (
        loading ? (
          <Skeleton variant="rectangular" sx={{ height: { xs: 150, sm: 132 }, bgcolor: T.glassHover }} />
        ) : error || !url ? (
          <TypeTile isImage={isImage} T={T} />
        ) : (
          <img src={url} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )
      ) : (
        <TypeTile isImage={isImage} T={T} />
      )}

      {showTypeChip && (
        <Box sx={{
          position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1,
          bgcolor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1.4 }} noWrap>
            {doc.typeDisplayName}
          </Typography>
        </Box>
      )}

      {doc.shared && (
        <Tooltip title="This document has an active share link">
          <Box sx={{
            position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%',
            bgcolor: T.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}>
            <LinkIcon sx={{ fontSize: 14, color: '#fff' }} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

function TypeTile({ isImage, T }) {
  if (isImage) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: T.glassHover }}>
        <ImageIcon sx={{ color: T.textFaint, fontSize: 40 }} />
      </Box>
    );
  }
  return (
    <Box sx={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 0.5,
      background: `linear-gradient(135deg, ${T.tealBg}, transparent)`,
    }}>
      <PictureAsPdfIcon sx={{ color: T.teal, fontSize: 44 }} />
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: T.teal, letterSpacing: 0.5 }}>PDF</Typography>
    </Box>
  );
}
