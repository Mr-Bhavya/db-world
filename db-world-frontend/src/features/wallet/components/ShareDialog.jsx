import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, TextField, MenuItem,
  Alert, Box, Typography, List, ListItem, ListItemText, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { createShare, fetchShares, revokeShare, buildShareUrl } from '../api/walletApi';

const EXPIRY_OPTIONS = [{ label: '1 hour', value: 1 }, { label: '24 hours', value: 24 }, { label: '7 days', value: 168 }];

export default function ShareDialog({ doc, open, onClose }) {
  const T = useT();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const qc = useQueryClient();
  const [hours, setHours] = useState(24);
  const [maxViews, setMaxViews] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const { data: shares = [] } = useQuery({ queryKey: ['wallet', 'shares', doc.id], queryFn: () => fetchShares(doc.id) });

  const create = useMutation({
    mutationFn: () => createShare(doc.id, { expiresInHours: hours, maxAccessCount: maxViews ? Number(maxViews) : null }),
    onSuccess: (dto) => { setNewUrl(buildShareUrl(dto.token)); qc.invalidateQueries({ queryKey: ['wallet', 'shares', doc.id] }); },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to create link'),
  });
  const revoke = useMutation({
    mutationFn: (id) => revokeShare(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet', 'shares', doc.id] }); notify.success('Link revoked'); },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to revoke link'),
  });

  const copy = (url) => { navigator.clipboard.writeText(url); notify.success('Link copied'); };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isPhone}
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary, fontWeight: 700 }}>
        Share &quot;{doc.label}&quot;
        <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="warning">You are sharing a real government document. Anyone with the link can view it until it expires or you revoke it.</Alert>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <TextField select size="small" label="Expires in" value={hours} onChange={(e) => setHours(Number(e.target.value))} sx={{ flex: 1 }}>
            {EXPIRY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Max views (optional)" type="number" value={maxViews}
            onChange={(e) => setMaxViews(e.target.value)} inputProps={{ min: 1 }} sx={{ flex: 1 }} />
        </Box>
        <Button variant="contained" onClick={() => create.mutate()} disabled={create.isPending}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Create link</Button>

        {newUrl && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField size="small" fullWidth value={newUrl} InputProps={{ readOnly: true }} />
            <IconButton onClick={() => copy(newUrl)} sx={{ color: T.teal }}><ContentCopyIcon /></IconButton>
          </Box>
        )}

        <Typography sx={{ fontSize: 12, color: T.textFaint, textTransform: 'uppercase' }}>Active links</Typography>
        <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {shares.length === 0 && <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No active links.</Typography>}
          {shares.map((s) => (
            <ListItem key={s.id} disableGutters
              sx={{
                display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
                justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${T.glassBorder}`,
              }}>
              <ListItemText
                primary={`Expires ${new Date(s.expiresAt).toLocaleString()}`}
                secondary={`Views: ${s.accessCount}${s.maxAccessCount ? ` / ${s.maxAccessCount}` : ''}`}
                primaryTypographyProps={{ color: T.textPrimary, fontSize: 13 }}
                secondaryTypographyProps={{ color: T.textFaint, fontSize: 12 }}
                sx={{ flex: '1 1 200px', m: 0 }} />
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
                <IconButton size="small" onClick={() => copy(buildShareUrl(s.token))} sx={{ color: T.teal }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" aria-label="Revoke link" onClick={() => revoke.mutate(s.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={{ color: T.textMuted }}>Close</Button></DialogActions>
    </Dialog>
  );
}
