import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Collapse, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Grid, IconButton, InputAdornment,
  TextField, Typography, Tooltip, Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowBack as ArrowBackIcon,
  VpnKey as KeyIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import Constants from '@shared/constants';
import {
  deleteCredentialByCredentialId,
  deleteHostById,
  getCredential,
  updateCredential,
} from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import { toast } from '@shared/components/ui/Toast';

const T = {
  bg:          '#0a0a0f',
  teal:        '#0d9488',
  glass:       'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassHover:  'rgba(255,255,255,0.07)',
  textPrimary: '#f1f5f9',
  textMuted:   'rgba(241,245,249,0.55)',
  textFaint:   'rgba(241,245,249,0.35)',
  red:         '#f87171',
  blue:        '#60a5fa',
};

const DARK_FIELD = {
  '& .MuiInputLabel-root': { color: T.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiOutlinedInput-root': {
    color: T.textPrimary,
    '& fieldset': { borderColor: T.glassBorder },
    '&:hover fieldset': { borderColor: 'rgba(13,148,136,0.45)' },
    '&.Mui-focused fieldset': { borderColor: T.teal },
    '&.Mui-disabled': {
      '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' },
      bgcolor: 'rgba(255,255,255,0.02)',
    },
  },
  '& .MuiInputBase-input': { color: T.textPrimary },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: T.textMuted, opacity: 1 },
};

const BLANK_FORM = { pmId: null, host: null, credentialId: null, username: null, password: null, pin: null, notes: null };

// ── Credential row (collapsible) ──────────────────────────────────────────────
const CredentialItem = ({ credential, host, pmId, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const { id, username, password, pin, notes } = credential;

  const copy = async (text, label) => {
    const res = await CommonServices.handleCopy(text);
    if (res.success) toast.success(`${label} copied`);
    else toast.error(res.message);
  };

  return (
    <Box sx={{
      mb: 1, borderRadius: 1.5,
      bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${T.glassBorder}`,
      transition: 'border-color 0.2s',
      '&:hover': { borderColor: 'rgba(13,148,136,0.3)' },
    }}>
      {/* Header row */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.25, cursor: 'pointer',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <KeyIcon sx={{ fontSize: 16, color: T.teal, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: T.textPrimary }} noWrap>
            {username}
          </Typography>
        </Box>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ExpandMoreIcon sx={{ fontSize: 18, color: T.textMuted }} />
        </motion.div>
      </Box>

      {/* Expanded details */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider sx={{ borderColor: T.glassBorder }} />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Grid container spacing={1.5}>
            {/* Username */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: T.textMuted, minWidth: 72 }}>Username</Typography>
                <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: T.textPrimary, flex: 1 }} noWrap>
                  {username}
                </Typography>
                <Tooltip title="Copy username">
                  <IconButton size="small" onClick={() => copy(username, 'Username')} sx={{ color: T.teal }}>
                    <CopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>

            {/* Password */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: T.textMuted, minWidth: 72 }}>Password</Typography>
                <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: T.textPrimary, flex: 1 }}>
                  ••••••••
                </Typography>
                <Tooltip title="Copy password">
                  <IconButton size="small" onClick={() => copy(password, 'Password')} sx={{ color: T.teal }}>
                    <CopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>

            {/* PIN */}
            {pin && (
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: T.textMuted, minWidth: 72 }}>PIN</Typography>
                  <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: T.textPrimary, flex: 1 }}>
                    {pin}
                  </Typography>
                  <Tooltip title="Copy PIN">
                    <IconButton size="small" onClick={() => copy(pin, 'PIN')} sx={{ color: T.teal }}>
                      <CopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>
            )}

            {/* Notes */}
            {notes && (
              <Grid item xs={12}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: T.textMuted, mb: 0.5 }}>Notes</Typography>
                <Typography sx={{ fontSize: '0.8rem', fontStyle: 'italic', color: T.textMuted, whiteSpace: 'pre-wrap' }}>
                  {notes}
                </Typography>
              </Grid>
            )}
          </Grid>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onEdit({ host, username, password, pin, notes, credentialId: id, pmId }); }}
                sx={{ color: T.blue, bgcolor: 'rgba(96,165,250,0.1)', '&:hover': { bgcolor: 'rgba(96,165,250,0.2)' } }}
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDelete({ host, username, password, pin, notes, credentialId: id, pmId }); }}
                sx={{ color: T.red, bgcolor: 'rgba(248,113,113,0.1)', '&:hover': { bgcolor: 'rgba(248,113,113,0.2)' } }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

// ── Host card ─────────────────────────────────────────────────────────────────
const HostCard = ({ hostData, index, onEdit, onDeleteCredential, onDeleteHost }) => {
  const { id: pmId, host, credentials } = hostData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Box sx={{
        bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2.5,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': { borderColor: 'rgba(13,148,136,0.3)', boxShadow: '0 0 24px rgba(13,148,136,0.08)' },
      }}>
        {/* Host header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
          <img
            src={`https://t1.gstatic.com/faviconV2?client=PASSWORD_MANAGER&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=32&url=https%3A%2F%2F${host}`}
            alt={host}
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(13,148,136,0.3)', flexShrink: 0 }}
            onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI0IiBmaWxsPSIjMGQ5NDg4Ii8+PC9zdmc+'; }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: T.textPrimary }} noWrap>
              {host}
            </Typography>
            <Chip
              label={`${credentials.length} credential${credentials.length !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                height: 18, fontSize: '0.7rem', fontWeight: 600,
                bgcolor: 'rgba(13,148,136,0.1)', color: T.teal, mt: 0.25,
              }}
            />
          </Box>
          <Tooltip title="Delete host and all credentials">
            <IconButton
              size="small"
              onClick={() => onDeleteHost({ host, pmId })}
              sx={{ color: T.red, bgcolor: 'rgba(248,113,113,0.08)', '&:hover': { bgcolor: 'rgba(248,113,113,0.18)' } }}
            >
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider sx={{ borderColor: T.glassBorder }} />

        {/* Credentials list */}
        <Box sx={{ p: 1.5 }}>
          {credentials.map((cred) => (
            <CredentialItem
              key={cred.id}
              credential={cred}
              host={host}
              pmId={pmId}
              onEdit={onEdit}
              onDelete={onDeleteCredential}
            />
          ))}
        </Box>
      </Box>
    </motion.div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ViewPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading]                     = useState(true);
  const [credCache, setCredCache]                 = useState([]);
  const [credentials, setCredentials]             = useState([]);
  const [search, setSearch]                       = useState('');
  const [isUpdating, setIsUpdating]               = useState(false);
  const [isDeleting, setIsDeleting]               = useState(false);
  const [isDeletingHost, setIsDeletingHost]       = useState(false);
  const [showEditPwd, setShowEditPwd]             = useState(false);
  const [openEdit, setOpenEdit]                   = useState(false);
  const [openDeleteCred, setOpenDeleteCred]       = useState(false);
  const [openDeleteHost, setOpenDeleteHost]       = useState(false);
  const [form, setForm]                           = useState(BLANK_FORM);

  const fetchCredentials = async () => {
    try {
      const res = await getCredential();
      if (res.httpStatusCode === 200) {
        setCredCache(res.data);
        setCredentials(res.data);
      } else if (res.httpStatusCode === 401) {
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to fetch credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCredentials(); }, []);

  const handleSearch = (q) => {
    setSearch(q);
    if (!q) { setCredentials(credCache); return; }
    const lq = q.toLowerCase();
    setCredentials(
      credCache.filter(({ host, credentials: creds }) =>
        host.toLowerCase().includes(lq) ||
        creds.some(({ username }) => username.toLowerCase().includes(lq))
      )
    );
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    const { credentialId, pmId, host, username, password, pin, notes } = form;
    try {
      const res = await updateCredential(pmId, {
        id: credentialId, url: `https://${host}`,
        username, password, pin: pin === '' ? null : pin, notes,
      });
      if (res.httpStatusCode === 200) {
        toast.success(res.message);
        await fetchCredentials();
        setOpenEdit(false);
      } else if (res.httpStatusCode === 401) {
        toast.error(res.message, { autoClose: 1000, onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }) });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('An error occurred while updating credential');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCred = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteCredentialByCredentialId(form.credentialId);
      if (res.httpStatusCode === 200) {
        toast.success(res.message);
        await fetchCredentials();
        setOpenDeleteCred(false);
      } else if (res.httpStatusCode === 401) {
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('An error occurred while deleting credential');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteHost = async () => {
    setIsDeletingHost(true);
    try {
      const res = await deleteHostById(form.pmId);
      if (res.httpStatusCode === 200) {
        toast.success(res.message);
        await fetchCredentials();
        setOpenDeleteHost(false);
      } else if (res.httpStatusCode === 401) {
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('An error occurred while deleting host');
    } finally {
      setIsDeletingHost(false);
    }
  };

  return (
    <Box sx={{
      bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary,
      pt: { xs: '56px', md: '64px' },
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1a1a 60%, #0a0f0f 100%)',
    }}>
      {/* Teal glow */}
      <motion.div
        animate={{ opacity: [0.06, 0.13, 0.06] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse 50% 40% at 50% 30%, rgba(13,148,136,0.15) 0%, transparent 70%)',
        }}
      />

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 6 } }}>
        {/* Back */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Box sx={{ mb: 3 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
              sx={{ color: T.textMuted, fontWeight: 500, fontSize: '0.875rem', '&:hover': { color: T.teal, bgcolor: 'transparent' } }}
            >
              Password Manager
            </Button>
          </Box>
        </motion.div>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.5,
              bgcolor: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LockIcon sx={{ fontSize: 20, color: T.teal }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: T.textPrimary }}>Password Vault</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>Your stored credentials</Typography>
            </Box>
          </Box>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Box sx={{ mb: 4, maxWidth: 480 }}>
            <TextField
              fullWidth
              placeholder="Search by host or username..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: T.textMuted, fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ ...DARK_FIELD }}
            />
          </Box>
        </motion.div>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress sx={{ color: T.teal }} />
          </Box>
        ) : credentials.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Box sx={{
              p: 6, textAlign: 'center',
              bgcolor: T.glass, border: `2px dashed rgba(13,148,136,0.25)`, borderRadius: 3,
            }}>
              <LockIcon sx={{ fontSize: 56, color: 'rgba(13,148,136,0.3)', mb: 2 }} />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: T.textMuted, mb: 1 }}>
                {search ? 'No matching credentials' : 'Vault is empty'}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: T.textFaint }}>
                {search ? 'Try different search terms' : 'Add your first credential to get started'}
              </Typography>
            </Box>
          </motion.div>
        ) : (
          <Grid container spacing={2.5}>
            <AnimatePresence>
              {credentials.map((hostData, idx) => (
                <Grid item key={hostData.id} xs={12} sm={6} lg={4}>
                  <HostCard
                    hostData={hostData}
                    index={idx}
                    onEdit={(f) => { setForm(f); setOpenEdit(true); setShowEditPwd(false); }}
                    onDeleteCredential={(f) => { setForm(f); setOpenDeleteCred(true); }}
                    onDeleteHost={(f) => { setForm(f); setOpenDeleteHost(true); }}
                  />
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        )}
      </Container>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog
        open={openEdit}
        onClose={() => !isUpdating && setOpenEdit(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#12121a', border: `1px solid ${T.glassBorder}`,
            borderRadius: 3, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          },
        }}
      >
        <DialogTitle sx={{
          borderBottom: `1px solid ${T.glassBorder}`, py: 2, px: 3,
          display: 'flex', alignItems: 'center', gap: 1,
          color: T.textPrimary, fontWeight: 700, fontSize: '1rem',
        }}>
          <EditIcon sx={{ fontSize: 18, color: T.teal }} />
          Update Credential
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" id="edit-form" onSubmit={handleUpdate}>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12}>
                <TextField fullWidth label="Host" name="host" value={form.host || ''} disabled sx={DARK_FIELD} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Username" name="username" value={form.username || ''} disabled sx={DARK_FIELD} />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Password" name="password"
                  type={showEditPwd ? 'text' : 'password'}
                  value={form.password || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowEditPwd(!showEditPwd)} sx={{ color: T.teal }} size="small">
                          {showEditPwd ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={DARK_FIELD}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="PIN (optional)" name="pin"
                  value={form.pin || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, pin: e.target.value }))}
                  sx={DARK_FIELD}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Notes (optional)" name="notes"
                  multiline minRows={3} maxRows={6}
                  value={form.notes || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  sx={{
                    ...DARK_FIELD,
                    '& .MuiInputBase-input': { color: T.textPrimary, fontFamily: 'monospace', lineHeight: 1.6 },
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${T.glassBorder}`, px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => setOpenEdit(false)} disabled={isUpdating}
            sx={{ color: T.textMuted, '&:hover': { color: T.textPrimary } }}
          >
            Cancel
          </Button>
          <Button
            form="edit-form" type="submit" variant="contained" disabled={isUpdating}
            startIcon={isUpdating ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#0f766e' }, '&:disabled': { bgcolor: 'rgba(13,148,136,0.3)' } }}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Credential Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={openDeleteCred}
        onClose={() => !isDeleting && setOpenDeleteCred(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#12121a', border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: T.textPrimary, fontWeight: 700, fontSize: '1rem', pb: 1 }}>
          Delete Credential
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted, fontSize: '0.875rem' }}>
            Delete <Box component="span" sx={{ color: T.textPrimary, fontWeight: 600 }}>{form.username}</Box> from{' '}
            <Box component="span" sx={{ color: T.teal, fontWeight: 600 }}>{form.host}</Box>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setOpenDeleteCred(false)} disabled={isDeleting} sx={{ color: T.textMuted }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteCred} variant="contained" disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: T.red, color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#dc2626' }, '&:disabled': { bgcolor: 'rgba(248,113,113,0.3)' } }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Host Dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={openDeleteHost}
        onClose={() => !isDeletingHost && setOpenDeleteHost(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#12121a', border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: T.textPrimary, fontWeight: 700, fontSize: '1rem', pb: 1 }}>
          Delete Host
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted, fontSize: '0.875rem' }}>
            Delete <Box component="span" sx={{ color: T.teal, fontWeight: 600 }}>{form.host}</Box> and all its credentials? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setOpenDeleteHost(false)} disabled={isDeletingHost} sx={{ color: T.textMuted }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteHost} variant="contained" disabled={isDeletingHost}
            startIcon={isDeletingHost ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: T.red, color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#dc2626' }, '&:disabled': { bgcolor: 'rgba(248,113,113,0.3)' } }}
          >
            {isDeletingHost ? 'Deleting...' : 'Delete All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ViewPassword;
