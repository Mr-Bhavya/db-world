import { useState } from 'react';
import {
  Chip, Menu, MenuItem, ListItemText, Box, Typography,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material';
import { useT } from '@shared/theme';
import { useRecordVisibility } from './useRecordVisibility';
import { VISIBILITY_ORDER, visibilityMeta } from './visibilityConstants';

/**
 * Inline visibility control shared by the records table, mobile list and the detail drawer
 * ("record page"). Shows the current status as a clickable chip; the menu switches between
 * DRAFT / PUBLISHED / UNLISTED. Publishing a record that has no media files yet is
 * warned-but-allowed (a confirm step) — the "new title" push is then held until media arrives.
 */
export default function VisibilityControl({ row, size = 'small' }) {
  const T = useT();
  const mut = useRecordVisibility();
  const [anchor, setAnchor] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const current = visibilityMeta(row.visibility);
  const hasMedia = Number(row.mediaFileCount ?? 0) > 0;

  const apply = (visibility) => {
    setAnchor(null);
    if (visibility === row.visibility) return;
    if (visibility === 'PUBLISHED' && !hasMedia) {
      setConfirmPublish(true); // warn, but allow
      return;
    }
    mut.mutate({ id: row.recordId, visibility });
  };

  const publishAnyway = () => {
    setConfirmPublish(false);
    mut.mutate({ id: row.recordId, visibility: 'PUBLISHED' });
  };

  return (
    <>
      <Chip
        label={current.label}
        size={size}
        disabled={mut.isPending}
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        sx={{
          bgcolor: `${current.color}22`, color: current.color, fontWeight: 700, fontSize: 11,
          border: `1px solid ${current.color}44`, cursor: 'pointer',
          '&:hover': { bgcolor: `${current.color}33` },
        }}
      />

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{ sx: { bgcolor: T.sidebar, color: T.textPrimary, border: `1px solid ${T.glassBorder}`, minWidth: 240 } }}
      >
        {VISIBILITY_ORDER.map((v) => {
          const m = visibilityMeta(v);
          const noMediaHint = v === 'PUBLISHED' && !hasMedia ? ' — no media yet' : '';
          return (
            <MenuItem
              key={v}
              selected={v === row.visibility}
              onClick={() => apply(v)}
              sx={{ alignItems: 'flex-start', gap: 1, py: 1, '&.Mui-selected': { bgcolor: T.tealBg } }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color, mt: 0.7, flexShrink: 0 }} />
              <ListItemText
                primary={<Typography sx={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.label}{noMediaHint}</Typography>}
                secondary={<Typography sx={{ fontSize: 11, color: T.textFaint }}>{m.desc}</Typography>}
              />
            </MenuItem>
          );
        })}
      </Menu>

      <Dialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        PaperProps={{ sx: { bgcolor: T.sidebar, color: T.textPrimary, border: `1px solid ${T.glassBorder}`, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ color: T.textPrimary, fontWeight: 700 }}>Publish without media files?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: T.textMuted, fontSize: 13 }}>
            <b>{row.name}</b> has no media files yet, so there&apos;s nothing to play. You can publish it now as a
            placeholder — the &quot;new title&quot; notification is held until its first media file is added.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmPublish(false)} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button onClick={publishAnyway} variant="contained"
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            Publish anyway
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
