import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Button, Tabs, Tab, Box, TextField, MenuItem, Typography, Alert, CircularProgress, IconButton, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { bulkCreateUsers, deleteUser, updateUserRole } from '../api/adminApi';
import { useUserStore } from '../stores/useUserStore';
import { getInputSx, getDialogSx, getTabSx } from './constants';

function ImportTab({ onClose }) {
  const T = useT();
  const [raw, setRaw]             = useState('');
  const [parsed, setParsed]       = useState(null);
  const [parseError, setParseError] = useState('');
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const tryParse = () => {
    try { const d = JSON.parse(raw); setParsed(Array.isArray(d) ? d : [d]); setParseError(''); }
    catch { setParseError('Invalid JSON. Expected an array of user objects.'); }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => bulkCreateUsers(parsed),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      enqueueSnackbar(`${res?.length ?? 0} users created`, { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Bulk create failed', { variant: 'error' }),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>
        Paste a JSON array of user objects matching CreateUserRequest format.
      </Typography>
      <TextField
        multiline rows={8} value={raw}
        onChange={e => { setRaw(e.target.value); setParsed(null); }}
        placeholder={'[\n  { "firstName": "John", "lastName": "Doe", "email": "j@e.com", "password": "pass123", "gender": "Male", "mobileNo": 9876543210 }\n]'}
        sx={getInputSx(T)} fullWidth size="small"
      />
      {parseError && <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>{parseError}</Alert>}
      {parsed    && <Alert severity="success" sx={{ bgcolor: T.successBg, color: T.success, border: `1px solid ${T.success}44`, '& .MuiAlert-icon': { color: T.success } }}>{parsed.length} user(s) ready to import</Alert>}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={tryParse} variant="outlined" sx={{ borderColor: T.glassBorder, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}>Parse</Button>
        <Button onClick={() => mutate()} disabled={!parsed || isPending} variant="contained"
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Import'}
        </Button>
      </Box>
    </Box>
  );
}

function BulkDeleteTab({ onClose }) {
  const T = useT();
  const { selectedRows, clearSelection } = useUserStore();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [confirmed, setConfirmed] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => Promise.all(selectedRows.map(id => deleteUser(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      clearSelection();
      enqueueSnackbar(`${selectedRows.length} users deleted`, { variant: 'success' });
      onClose();
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      enqueueSnackbar('Some deletions failed — list refreshed', { variant: 'warning' });
    },
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="warning" sx={{ bgcolor: T.warningBg, color: T.warning, border: `1px solid ${T.warning}44`, '& .MuiAlert-icon': { color: T.warning } }}>
        You are about to permanently delete {selectedRows.length} user(s). This cannot be undone.
      </Alert>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {selectedRows.map(id => <Chip key={id} label={`ID: ${id}`} size="small" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}33` }} />)}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <input type="checkbox" id="confirm-del" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ accentColor: T.teal }} />
        <label htmlFor="confirm-del" style={{ fontSize: 13, color: T.textMuted }}>I understand this is irreversible</label>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => mutate()} disabled={!confirmed || isPending || !selectedRows.length} variant="contained"
          sx={{ bgcolor: T.error, '&:hover': { bgcolor: '#dc2626' }, fontWeight: 600 }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : `Delete ${selectedRows.length} Users`}
        </Button>
      </Box>
    </Box>
  );
}

function BulkRoleTab({ onClose }) {
  const T = useT();
  const { selectedRows, clearSelection } = useUserStore();
  const [roleId, setRoleId] = useState('');
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { mutate, isPending } = useMutation({
    mutationFn: () => Promise.all(selectedRows.map(id => updateUserRole(id, roleId))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      clearSelection();
      enqueueSnackbar(`Role updated for ${selectedRows.length} users`, { variant: 'success' });
      onClose();
    },
    onError: () => enqueueSnackbar('Some role updates failed', { variant: 'error' }),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontSize: 13, color: T.textMuted }}>
        Assign role to {selectedRows.length} selected user(s):
      </Typography>
      <TextField select label="Select Role" value={roleId} onChange={e => setRoleId(e.target.value)} size="small" sx={getInputSx(T)}>
        <MenuItem value={1} sx={{ color: T.textPrimary }}>Owner</MenuItem>
        <MenuItem value={2} sx={{ color: T.textPrimary }}>Admin</MenuItem>
        <MenuItem value={3} sx={{ color: T.textPrimary }}>Viewer</MenuItem>
      </TextField>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => mutate()} disabled={!roleId || isPending || !selectedRows.length} variant="contained"
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Assign Role'}
        </Button>
      </Box>
    </Box>
  );
}

export default function UserBulkModal({ open, onClose }) {
  const T   = useT();
  const [tab, setTab] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} {...getDialogSx(T)} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', pb: 0, color: T.textPrimary }}>
        Bulk Operations
        <IconButton onClick={onClose} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: `1px solid ${T.border}`, '& .MuiTabs-indicator': { bgcolor: T.teal } }}>
        <Tab label="Import"      sx={getTabSx(T)} />
        <Tab label="Bulk Delete" sx={getTabSx(T)} />
        <Tab label="Assign Role" sx={getTabSx(T)} />
      </Tabs>
      <DialogContent>
        {tab === 0 && <ImportTab     onClose={onClose} />}
        {tab === 1 && <BulkDeleteTab onClose={onClose} />}
        {tab === 2 && <BulkRoleTab   onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
