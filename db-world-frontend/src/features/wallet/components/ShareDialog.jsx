import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, TextField, MenuItem,
  Alert, Box, Typography, List, ListItem, ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { createShare, fetchShares, revokeShare, buildShareUrl } from '../api/walletApi';

const EXPIRY_OPTIONS = [{ label: '1 hour', value: 1 }, { label: '24 hours', value: 24 }, { label: '7 days', value: 168 }];

export default function ShareDialog({ doc, open, onClose }) {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [hours, setHours] = useState(24);
  const [maxViews, setMaxViews] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const { data: shares = [] } = useQuery({ queryKey: ['wallet', 'shares', doc.id], queryFn: () => fetchShares(doc.id) });

  const create = useMutation({
    mutationFn: () => createShare(doc.id, { expiresInHours: hours, maxAccessCount: maxViews ? Number(maxViews) : null }),
    onSuccess: (dto) => { setNewUrl(buildShareUrl(dto.token)); qc.invalidateQueries({ queryKey: ['wallet', 'shares', doc.id] }); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to create link', { variant: 'error' }),
  });
  const revoke = useMutation({
    mutationFn: (id) => revokeShare(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet', 'shares', doc.id] }); enqueueSnackbar('Link revoked', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to revoke link', { variant: 'error' }),
  });

  const copy = (url) => { navigator.clipboard.writeText(url); enqueueSnackbar('Link copied', { variant: 'success' }); };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', color: T.textPrimary }}>
        Share &quot;{doc.label}&quot; <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="warning">You are sharing a real government document. Anyone with the link can view it until it expires or you revoke it.</Alert>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
        <List dense>
          {shares.length === 0 && <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No active links.</Typography>}
          {shares.map((s) => (
            <ListItem key={s.id} secondaryAction={
              <Button size="small" color="error" onClick={() => revoke.mutate(s.id)}>Revoke</Button>}>
              <ListItemText
                primary={`Expires ${new Date(s.expiresAt).toLocaleString()}`}
                secondary={`Views: ${s.accessCount}${s.maxAccessCount ? ` / ${s.maxAccessCount}` : ''}`}
                primaryTypographyProps={{ color: T.textPrimary, fontSize: 13 }}
                secondaryTypographyProps={{ color: T.textFaint, fontSize: 12 }} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={{ color: T.textMuted }}>Close</Button></DialogActions>
    </Dialog>
  );
}
