import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Button, Tabs, Tab, Box, TextField, MenuItem, Typography, Alert, CircularProgress, IconButton, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { bulkCreateUsers, deleteUser, updateUserRole } from '../api/adminApi';
import { useUserStore } from '../stores/useUserStore';
import { inputSx, dialogSx, tabSx } from './constants';

function ImportTab({ onClose }) {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState(null);
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
      qc.invalidateQueries({ queryKey:['users'] });
      enqueueSnackbar(`${res?.length ?? 0} users created`, { variant:'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Bulk create failed', { variant:'error' }),
  });

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Typography sx={{ fontSize:12, color:'rgba(15,23,42,0.55)' }}>
        Paste a JSON array of user objects matching CreateUserRequest format.
      </Typography>
      <TextField multiline rows={8} value={raw} onChange={e => { setRaw(e.target.value); setParsed(null); }}
        placeholder={'[\n  { "firstName": "John", "lastName": "Doe", "email": "j@e.com", "password": "pass123", "gender": "Male", "mobileNo": 9876543210 }\n]'}
        sx={inputSx} fullWidth size="small" />
      {parseError && <Alert severity="error" sx={{ bgcolor:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)' }}>{parseError}</Alert>}
      {parsed && <Alert severity="success" sx={{ bgcolor:'rgba(16,185,129,0.1)', color:'#10b981', border:'1px solid rgba(16,185,129,0.3)' }}>{parsed.length} user(s) ready to import</Alert>}
      <Box sx={{ display:'flex', gap:1, justifyContent:'flex-end' }}>
        <Button onClick={tryParse} variant="outlined" sx={{ borderColor:'rgba(0,0,0,0.2)', color:'rgba(15,23,42,0.7)' }}>Parse</Button>
        <Button onClick={() => mutate()} disabled={!parsed || isPending} variant="contained" sx={{ bgcolor:'#0d9488','&:hover':{ bgcolor:'#0f766e' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Import'}
        </Button>
      </Box>
    </Box>
  );
}

function BulkDeleteTab({ onClose }) {
  const { selectedRows, clearSelection } = useUserStore();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [confirmed, setConfirmed] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => Promise.all(selectedRows.map(id => deleteUser(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      clearSelection();
      enqueueSnackbar(`${selectedRows.length} users deleted`, { variant:'success' });
      onClose();
    },
    onError: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      enqueueSnackbar('Some deletions failed — list refreshed', { variant:'warning' });
    },
  });

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Alert severity="warning" sx={{ bgcolor:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)' }}>
        You are about to permanently delete {selectedRows.length} user(s). This cannot be undone.
      </Alert>
      <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5 }}>
        {selectedRows.map(id => <Chip key={id} label={`ID: ${id}`} size="small" sx={{ bgcolor:'rgba(239,68,68,0.15)', color:'#ef4444' }} />)}
      </Box>
      <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
        <input type="checkbox" id="confirm-del" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        <label htmlFor="confirm-del" style={{ fontSize:13, color:'rgba(15,23,42,0.7)' }}>I understand this is irreversible</label>
      </Box>
      <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
        <Button onClick={() => mutate()} disabled={!confirmed || isPending || !selectedRows.length} variant="contained" sx={{ bgcolor:'#ef4444','&:hover':{ bgcolor:'#dc2626' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : `Delete ${selectedRows.length} Users`}
        </Button>
      </Box>
    </Box>
  );
}

function BulkRoleTab({ onClose }) {
  const { selectedRows, clearSelection } = useUserStore();
  const [roleId, setRoleId] = useState('');
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { mutate, isPending } = useMutation({
    mutationFn: () => Promise.all(selectedRows.map(id => updateUserRole(id, roleId))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      clearSelection();
      enqueueSnackbar(`Role updated for ${selectedRows.length} users`, { variant:'success' });
      onClose();
    },
    onError: () => enqueueSnackbar('Some role updates failed', { variant:'error' }),
  });

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Typography sx={{ fontSize:13, color:'rgba(15,23,42,0.6)' }}>
        Assign role to {selectedRows.length} selected user(s):
      </Typography>
      <TextField select label="Select Role" value={roleId} onChange={e => setRoleId(e.target.value)} size="small" sx={inputSx}>
        <MenuItem value={1}>Owner</MenuItem>
        <MenuItem value={2}>Admin</MenuItem>
        <MenuItem value={3}>Viewer</MenuItem>
      </TextField>
      <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
        <Button onClick={() => mutate()} disabled={!roleId || isPending || !selectedRows.length} variant="contained" sx={{ bgcolor:'#0d9488','&:hover':{ bgcolor:'#0f766e' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Assign Role'}
        </Button>
      </Box>
    </Box>
  );
}

export default function UserBulkModal({ open, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} sx={dialogSx} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', pb:0 }}>
        Bulk Operations
        <IconButton onClick={onClose} sx={{ color:'rgba(15,23,42,0.45)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px:2, borderBottom:'1px solid rgba(0,0,0,0.07)', '& .MuiTabs-indicator':{ bgcolor:'#0d9488' } }}>
        <Tab label="Import" sx={tabSx} />
        <Tab label="Bulk Delete" sx={tabSx} />
        <Tab label="Assign Role" sx={tabSx} />
      </Tabs>
      <DialogContent>
        {tab === 0 && <ImportTab onClose={onClose} />}
        {tab === 1 && <BulkDeleteTab onClose={onClose} />}
        {tab === 2 && <BulkRoleTab onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
