import { Box, Typography, IconButton, Chip, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import { useState } from 'react';
import { useT } from '@shared/theme';

export default function DocumentCard({ doc, onPreview, onDownload, onEdit, onShare, onDelete }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const isPdf = doc.contentType === 'application/pdf';
  return (
    <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2,
               display: 'flex', flexDirection: 'column', gap: 1, cursor: 'pointer',
               '&:hover': { borderColor: T.teal } }}
         onClick={() => onPreview(doc)}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {isPdf ? <DescriptionIcon sx={{ color: T.teal }} /> : <ImageIcon sx={{ color: T.teal }} />}
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
          sx={{ color: T.textFaint }}><MoreVertIcon fontSize="small" /></IconButton>
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }} noWrap>{doc.label}</Typography>
      {doc.typeDisplayName && <Chip label={doc.typeDisplayName} size="small"
        sx={{ alignSelf: 'flex-start', bgcolor: T.tealBg, color: T.teal, fontSize: 11 }} />}
      {doc.maskedNumber && <Typography sx={{ fontSize: 12, color: T.textMuted }}>{doc.maskedNumber}</Typography>}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => { setAnchor(null); onPreview(doc); }}>Preview</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onDownload(doc); }}>Download</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onEdit(doc); }}>Edit</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onShare(doc); }}>Share</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onDelete(doc); }} sx={{ color: T.error }}>Delete</MenuItem>
      </Menu>
    </Box>
  );
}
