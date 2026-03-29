import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, IconButton, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
  Tooltip, Alert, CircularProgress, Divider, alpha, List, ListItem,
  ListItemText, ListItemSecondaryAction, Collapse, Paper,
} from '@mui/material';
import {
  Label, Add, Edit, Delete, Refresh, ExpandLess, ExpandMore,
  DragIndicator, CheckCircle, Cancel, PlaylistPlay, Tag,
  TrendingUp, Star, NewReleases, Whatshot, Schedule, FiberNew,
} from '@mui/icons-material';
import axios from 'axios';

const TAG_COLORS = {
  FEATURED:       { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: <Star sx={{ fontSize: 16 }} /> },
  TRENDING:       { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: <TrendingUp sx={{ fontSize: 16 }} /> },
  NEW_RELEASE:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: <NewReleases sx={{ fontSize: 16 }} /> },
  RECENTLY_ADDED: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: <FiberNew sx={{ fontSize: 16 }} /> },
  EDITOR_PICK:    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: <Star sx={{ fontSize: 16 }} /> },
  TOP_10:         { color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: <Whatshot sx={{ fontSize: 16 }} /> },
  SHOW_ON_TOP:    { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  icon: <Schedule sx={{ fontSize: 16 }} /> },
};

const RAIL_TYPES = ['TAG', 'GENRE', 'LANGUAGE', 'CUSTOM'];

function TagCard({ tag, count, onRefresh }) {
  const meta = TAG_COLORS[tag] ?? { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: <Tag sx={{ fontSize: 16 }} /> };
  return (
    <Card sx={{ bgcolor: '#12121e', border: `1px solid ${meta.color}30`, borderRadius: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ color: meta.color }}>{meta.icon}</Box>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {tag.replace(/_/g, ' ')}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{count ?? '—'}</Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>records tagged</Typography>
        <Tooltip title={`Recalculate ${tag} tag`}>
          <Button size="small" variant="outlined" sx={{ mt: 1.5, borderColor: `${meta.color}50`, color: meta.color,
            fontSize: '0.68rem', py: 0.3, '&:hover': { borderColor: meta.color, bgcolor: meta.bg } }}
            onClick={() => onRefresh(tag)} startIcon={<Refresh sx={{ fontSize: 12 }} />}>
            Recalculate
          </Button>
        </Tooltip>
      </CardContent>
    </Card>
  );
}

function RailRow({ rail, onEdit, onDelete, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2, px: 1.5,
        borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
        <DragIndicator sx={{ fontSize: 16, color: 'rgba(255,255,255,0.2)', cursor: 'grab' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{rail.title}</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.3, flexWrap: 'wrap' }}>
            <Chip label={rail.railType} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(99,102,241,0.15)', color: '#6366f1' }} />
            {rail.pageType && <Chip label={rail.pageType} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }} />}
            {rail.sortField && <Chip label={`Sort: ${rail.sortField}`} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }} />}
          </Box>
        </Box>
        <Switch size="small" checked={rail.active ?? true} onChange={() => onToggle(rail)}
          sx={{ '& .MuiSwitch-thumb': { bgcolor: rail.active ? '#6366f1' : undefined } }} />
        <IconButton size="small" onClick={() => setExpanded(p => !p)}
          sx={{ color: 'rgba(255,255,255,0.4)' }}>
          {expanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
        </IconButton>
        <IconButton size="small" onClick={() => onEdit(rail)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#6366f1' } }}>
          <Edit sx={{ fontSize: 14 }} />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(rail)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444' } }}>
          <Delete sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ mx: 2, mb: 1, p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', mb: 0.5 }}>Rule JSON</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {JSON.stringify(rail.rule ?? {}, null, 2)}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
}

const BLANK_RAIL = { title: '', railType: 'TAG', pageType: 'HOME', sortField: 'popularity', sortDir: 'DESC', limit: 20, active: true, rule: {} };

export default function TagsRailsManager() {
  const [tagCounts, setTagCounts]     = useState({});
  const [rails,     setRails]         = useState([]);
  const [loading,   setLoading]       = useState(true);
  const [syncing,   setSyncing]       = useState(false);
  const [alert,     setAlert]         = useState(null);
  const [railDialog, setRailDialog]   = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, rail: null });

  const showAlert = (msg, sev = 'success') => {
    setAlert({ msg, sev });
    setTimeout(() => setAlert(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tagsRes, railsRes] = await Promise.all([
        axios.get('/api/admin/dashboard/stats').catch(() => ({ data: { tags: {} } })),
        axios.get('/api/cinema/admin/rails').catch(() => ({ data: [] })),
      ]);
      setTagCounts(tagsRes.data?.tags ?? {});
      setRails(Array.isArray(railsRes.data) ? railsRes.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRecalculate = async (tag) => {
    setSyncing(true);
    try {
      await axios.post(`/api/cinema/admin/tags/recalculate/${tag}`);
      showAlert(`${tag} tags recalculated`);
      load();
    } catch {
      showAlert('Recalculate failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleRecalculateAll = async () => {
    setSyncing(true);
    try {
      await axios.post('/api/cinema/admin/tags/recalculate/all');
      showAlert('All tags recalculated successfully');
      load();
    } catch {
      showAlert('Recalculate all failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveRail = async (data) => {
    try {
      if (data.id) {
        await axios.put(`/api/cinema/admin/rails/${data.id}`, data);
      } else {
        await axios.post('/api/cinema/admin/rails', data);
      }
      showAlert(`Rail ${data.id ? 'updated' : 'created'}`);
      setRailDialog({ open: false, data: null });
      load();
    } catch {
      showAlert('Save failed', 'error');
    }
  };

  const handleDeleteRail = async (rail) => {
    try {
      await axios.delete(`/api/cinema/admin/rails/${rail.id}`);
      showAlert('Rail deleted');
      setDeleteDialog({ open: false, rail: null });
      load();
    } catch {
      showAlert('Delete failed', 'error');
    }
  };

  const handleToggle = async (rail) => {
    try {
      await axios.patch(`/api/cinema/admin/rails/${rail.id}/toggle`);
      load();
    } catch {
      showAlert('Toggle failed', 'error');
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress sx={{ color: '#6366f1' }} />
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Label sx={{ color: '#6366f1', fontSize: 28 }} />
        <Box>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Tags &amp; Rails Manager</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
            Manage content tags and configure homepage rails
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={syncing ? <CircularProgress size={14} /> : <Refresh />}
          disabled={syncing} onClick={handleRecalculateAll}
          sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)',
            '&:hover': { borderColor: '#6366f1', color: '#6366f1' }, fontSize: '0.78rem' }}>
          Recalculate All Tags
        </Button>
      </Box>

      {alert && (
        <Alert severity={alert.sev} sx={{ mb: 2, bgcolor: alert.sev === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}
          onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}

      {/* Tag counts grid */}
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
        Content Tags
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Object.keys(TAG_COLORS).map(tag => (
          <Grid item xs={6} sm={4} md={3} lg={2} key={tag}>
            <TagCard tag={tag} count={tagCounts[tag]} onRefresh={handleRecalculate} />
          </Grid>
        ))}
      </Grid>

      {/* Rails section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <PlaylistPlay sx={{ color: '#6366f1', fontSize: 20 }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>
          Rails Configuration
        </Typography>
        <Button size="small" variant="contained" startIcon={<Add />}
          onClick={() => setRailDialog({ open: true, data: { ...BLANK_RAIL } })}
          sx={{ bgcolor: '#6366f1', fontSize: '0.75rem', '&:hover': { bgcolor: '#5558e3' } }}>
          New Rail
        </Button>
      </Box>

      <Paper sx={{ bgcolor: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        {rails.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <PlaylistPlay sx={{ fontSize: 40, color: 'rgba(255,255,255,0.1)', mb: 1 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No rails configured</Typography>
          </Box>
        ) : (
          rails.map((rail, i) => (
            <Box key={rail.id ?? i}>
              {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
              <RailRow rail={rail}
                onEdit={(r) => setRailDialog({ open: true, data: { ...r } })}
                onDelete={(r) => setDeleteDialog({ open: true, rail: r })}
                onToggle={handleToggle} />
            </Box>
          ))
        )}
      </Paper>

      {/* Rail edit dialog */}
      <RailDialog open={railDialog.open} data={railDialog.data}
        onClose={() => setRailDialog({ open: false, data: null })}
        onSave={handleSaveRail} />

      {/* Delete confirmation */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, rail: null })}
        PaperProps={{ sx: { bgcolor: '#12121e', border: '1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ color: '#fff', fontSize: '1rem' }}>Delete Rail</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            Delete <strong style={{ color: '#fff' }}>{deleteDialog.rail?.title}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog({ open: false, rail: null })} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => handleDeleteRail(deleteDialog.rail)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function RailDialog({ open, data, onClose, onSave }) {
  const [form, setForm] = useState(data ?? { ...BLANK_RAIL });
  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.checked }));

  const handleRuleChange = (val) => {
    try { setForm(p => ({ ...p, rule: JSON.parse(val) })); } catch { /* keep old */ }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#12121e', border: '1px solid rgba(255,255,255,0.1)' } }}>
      <DialogTitle sx={{ color: '#fff', fontSize: '1rem', pb: 1 }}>
        {form.id ? 'Edit Rail' : 'New Rail'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField label="Title" value={form.title} onChange={set('title')} fullWidth size="small"
          InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
          inputProps={{ style: { color: '#fff' } }}
          sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }} />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.4)' }}>Rail Type</InputLabel>
            <Select value={form.railType ?? 'TAG'} onChange={set('railType')} label="Rail Type"
              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}>
              {RAIL_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.4)' }}>Page Type</InputLabel>
            <Select value={form.pageType ?? 'HOME'} onChange={set('pageType')} label="Page Type"
              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}>
              {['HOME', 'MOVIE', 'SERIES', 'ALL'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Sort Field" value={form.sortField ?? ''} onChange={set('sortField')} fullWidth size="small"
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }} inputProps={{ style: { color: '#fff' } }}
            sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }} />
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.4)' }}>Sort Dir</InputLabel>
            <Select value={form.sortDir ?? 'DESC'} onChange={set('sortDir')} label="Sort Dir"
              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}>
              <MenuItem value="DESC">DESC</MenuItem>
              <MenuItem value="ASC">ASC</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Limit" type="number" value={form.limit ?? 20} onChange={set('limit')} size="small"
            inputProps={{ style: { color: '#fff' }, min: 1, max: 100 }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
            sx={{ width: 90, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }} />
        </Box>
        <TextField label="Rule JSON" multiline rows={3}
          defaultValue={JSON.stringify(form.rule ?? {}, null, 2)}
          onChange={(e) => handleRuleChange(e.target.value)} fullWidth size="small"
          InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
          inputProps={{ style: { color: '#fff', fontFamily: 'monospace', fontSize: '0.75rem' } }}
          sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }} />
        <FormControlLabel control={<Switch checked={form.active ?? true} onChange={setCheck('active')} />}
          label={<Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>Active</Typography>} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.title}
          sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#5558e3' } }}>
          {form.id ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
