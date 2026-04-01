import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Avatar, Box, Button, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, InputAdornment, Skeleton,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowBack, ContentCopy, Delete, Edit, Lock,
  Search, Visibility, VisibilityOff, Language,
  Add, CheckCircleOutline, ErrorOutline,
} from '@mui/icons-material';
import { useT, getGlowProps, getFieldSx } from '@shared/theme';
import Constants from '@shared/constants';
import {
  getCredential, updateCredential,
  deleteCredentialByCredentialId, deleteHostById,
} from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';

// ─── Edit schema ────────────────────────────────────────────────────────────
const editSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional().default(''),
  pin: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

// ─── Sub-components ─────────────────────────────────────────────────────────

const HostAvatar = ({ host, size = 32 }) => {
  const [err, setErr] = useState(false);
  const src = `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
  if (err) return (
    <Avatar sx={{ width: size, height: size, bgcolor: 'rgba(13,148,136,0.15)', fontSize: size * 0.5 }}>
      <Language sx={{ fontSize: size * 0.6, color: '#0d9488' }} />
    </Avatar>
  );
  return (
    <Avatar src={src} onError={() => setErr(true)} sx={{ width: size, height: size, bgcolor: 'transparent' }}>
      <Language sx={{ color: '#0d9488' }} />
    </Avatar>
  );
};

const CopyBtn = ({ value, label, copied, onCopy, T }) => (
  <Tooltip title={copied ? 'Copied!' : `Copy ${label}`}>
    <IconButton
      size="small"
      onClick={() => onCopy(value)}
      disabled={!value}
      sx={{ color: copied ? '#10b981' : T.textMuted, '&:hover': { color: T.teal } }}
    >
      {copied ? <CheckCircleOutline fontSize="small" /> : <ContentCopy fontSize="small" />}
    </IconButton>
  </Tooltip>
);

// ─── Edit Dialog ─────────────────────────────────────────────────────────────
const EditDialog = ({ target, onClose }) => {
  const T = useT();
  const FIELD = getFieldSx(T);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [showPw, setShowPw] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      username: target.cred.username ?? '',
      password: target.cred.password ?? '',
      pin: target.cred.pin ?? '',
      notes: target.cred.notes ?? '',
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => updateCredential(target.pmId, { id: target.cred.id, ...data }),
    onSuccess: () => {
      enqueueSnackbar('Credential updated', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      onClose();
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message ?? 'Failed to update', { variant: 'error' });
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { bgcolor: T.bg, border: `1px solid ${T.glassBorder}`, borderRadius: 3 },
      }}
    >
      <DialogTitle sx={{ color: T.textPrimary, fontWeight: 700, pb: 1 }}>
        Edit Credential
        <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, fontWeight: 400, mt: 0.25 }}>
          {target.host}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <Controller name="username" control={control} render={({ field }) => (
          <TextField {...field} label="Username / Email" size="small"
            error={!!errors.username} helperText={errors.username?.message} sx={FIELD} />
        )} />
        <Controller name="password" control={control} render={({ field }) => (
          <TextField {...field} label="Password" size="small" type={showPw ? 'text' : 'password'}
            InputProps={{ endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPw(!showPw)} sx={{ color: T.teal }}>
                  {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            )}} sx={FIELD} />
        )} />
        <Controller name="pin" control={control} render={({ field }) => (
          <TextField {...field} label="PIN (optional)" size="small" type={showPin ? 'text' : 'password'}
            inputProps={{ inputMode: 'numeric' }}
            InputProps={{ endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPin(!showPin)} sx={{ color: T.teal }}>
                  {showPin ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            )}} sx={FIELD} />
        )} />
        <Controller name="notes" control={control} render={({ field }) => (
          <TextField {...field} label="Notes (optional)" size="small" multiline rows={2} sx={FIELD} />
        )} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit((d) => mutate(d))}
          disabled={isPending}
          startIcon={isPending && <CircularProgress size={14} color="inherit" />}
          sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#0f766e' } }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Confirm Delete Dialog ───────────────────────────────────────────────────
const ConfirmDialog = ({ title, body, loading, onConfirm, onClose }) => {
  const T = useT();
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { bgcolor: T.bg, border: `1px solid ${T.glassBorder}`, borderRadius: 3 },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#f87171', fontWeight: 700 }}>
        <ErrorOutline /> {title}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: T.textMuted, fontSize: '0.9rem' }}>{body}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading && <CircularProgress size={14} color="inherit" />}
          sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#dc2626' } }}
        >
          {loading ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Credential Row ──────────────────────────────────────────────────────────
const CredRow = ({ cred, pmId, host, T, enqueueSnackbar, onEdit, onDelete }) => {
  const [revealed, setRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const copy = async (text, key) => {
    const res = await CommonServices.handleCopy(text);
    if (res.success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 1500);
    } else {
      enqueueSnackbar('Copy failed', { variant: 'error' });
    }
  };

  return (
    <Box
      sx={{
        p: 2, borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.025)',
        border: `1px solid ${T.glassBorder}`,
        '&:hover': { borderColor: 'rgba(13,148,136,0.3)' },
        transition: 'border-color 0.2s',
      }}
    >
      {/* Username row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: cred.password || cred.pin ? 1 : 0 }}>
        <Typography sx={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: T.textPrimary, wordBreak: 'break-all' }}>
          {cred.username}
        </Typography>
        <CopyBtn value={cred.username} label="username" copied={copiedKey === 'u'} onCopy={(v) => copy(v, 'u')} T={T} />
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit({ pmId, cred, host })}
            sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete credential">
          <IconButton size="small" onClick={() => onDelete({ credId: cred.id, label: cred.username })}
            sx={{ color: T.textMuted, '&:hover': { color: '#f87171' } }}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Password row */}
      {cred.password && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ flex: 1, fontSize: '0.8rem', color: T.textMuted, fontFamily: 'monospace', letterSpacing: revealed ? 0 : 2 }}>
            {revealed ? cred.password : '••••••••••••'}
          </Typography>
          <Tooltip title={revealed ? 'Hide' : 'Show password'}>
            <IconButton size="small" onClick={() => setRevealed(!revealed)}
              sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}>
              {revealed ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </Tooltip>
          <CopyBtn value={cred.password} label="password" copied={copiedKey === 'pw'} onCopy={(v) => copy(v, 'pw')} T={T} />
        </Box>
      )}

      {/* PIN row */}
      {cred.pin && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mr: 0.5 }}>PIN</Typography>
          <Typography sx={{ flex: 1, fontSize: '0.8rem', color: T.textMuted, fontFamily: 'monospace', letterSpacing: 2 }}>
            ••••
          </Typography>
          <CopyBtn value={cred.pin} label="PIN" copied={copiedKey === 'pin'} onCopy={(v) => copy(v, 'pin')} T={T} />
        </Box>
      )}

      {/* Notes */}
      {cred.notes && (
        <Typography sx={{ mt: 1, fontSize: '0.75rem', color: T.textMuted, fontStyle: 'italic', wordBreak: 'break-word' }}>
          {cred.notes}
        </Typography>
      )}
    </Box>
  );
};

// ─── Host Card ───────────────────────────────────────────────────────────────
const HostCard = ({ entry, T, enqueueSnackbar, onEdit, onDeleteCred, onDeleteHost }) => (
  <Box sx={{ p: { xs: 2, md: 2.5 }, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3 }}>
    {/* Header */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <HostAvatar host={entry.host} size={36} />
      <Typography sx={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: T.textPrimary }}>
        {entry.host}
      </Typography>
      <Tooltip title="Delete all credentials for this site">
        <IconButton
          size="small"
          onClick={() => onDeleteHost({ pmId: entry.id, host: entry.host })}
          sx={{ color: T.textMuted, '&:hover': { color: '#f87171' } }}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {entry.credentials.map((cred) => (
        <CredRow
          key={cred.id}
          cred={cred}
          pmId={entry.id}
          host={entry.host}
          T={T}
          enqueueSnackbar={enqueueSnackbar}
          onEdit={onEdit}
          onDelete={onDeleteCred}
        />
      ))}
    </Box>
  </Box>
);

// ─── Loading skeleton ────────────────────────────────────────────────────────
const VaultSkeleton = ({ T }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {[1, 2, 3].map((i) => (
      <Box key={i} sx={{ p: 2.5, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Skeleton variant="circular" width={36} height={36} sx={{ bgcolor: T.glassBorder }} />
          <Skeleton variant="text" width={120} sx={{ bgcolor: T.glassBorder }} />
        </Box>
        <Skeleton variant="rounded" height={60} sx={{ bgcolor: T.glassBorder }} />
      </Box>
    ))}
  </Box>
);

// ─── Main component ──────────────────────────────────────────────────────────
const ViewPassword = () => {
  const T = useT();
  const GLOW = getGlowProps(T);
  const FIELD = getFieldSx(T);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [search, setSearch]               = useState('');
  const [editTarget, setEditTarget]       = useState(null);   // { pmId, cred, host }
  const [deleteCredTarget, setDelCred]    = useState(null);   // { credId, label }
  const [deleteHostTarget, setDelHost]    = useState(null);   // { pmId, host }

  // ── Fetch vault
  const { data: vault = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['pm-vault'],
    queryFn: async () => {
      const res = await getCredential();
      return res.data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // ── Filtered list
  const filtered = useMemo(() => {
    if (!search.trim()) return vault;
    const q = search.toLowerCase();
    return vault.filter((entry) =>
      entry.host.toLowerCase().includes(q) ||
      entry.credentials.some((c) => c.username.toLowerCase().includes(q))
    );
  }, [vault, search]);

  // ── Delete credential
  const { mutate: deleteCred, isPending: deletingCred } = useMutation({
    mutationFn: (credId) => deleteCredentialByCredentialId(credId),
    onSuccess: () => {
      enqueueSnackbar('Credential deleted', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      setDelCred(null);
    },
    onError: () => enqueueSnackbar('Failed to delete credential', { variant: 'error' }),
  });

  // ── Delete host entry
  const { mutate: deleteHost, isPending: deletingHost } = useMutation({
    mutationFn: (pmId) => deleteHostById(pmId),
    onSuccess: () => {
      enqueueSnackbar('Entry deleted', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      queryClient.invalidateQueries({ queryKey: ['pm-hosts'] });
      setDelHost(null);
    },
    onError: () => enqueueSnackbar('Failed to delete entry', { variant: 'error' }),
  });

  const totalCreds = vault.reduce((s, e) => s + e.credentials.length, 0);

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' } }}>
      <motion.div {...GLOW} />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, md: 5 } }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
            sx={{ color: T.textMuted, fontWeight: 500, '&:hover': { color: T.teal, bgcolor: 'transparent' } }}
          >
            Password Manager
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => navigate(Constants.DB_ADD_PASSWORD_ROUTE)}
            sx={{ borderColor: T.teal, color: T.teal, borderRadius: 2, border: '1px solid', fontWeight: 600,
              '&:hover': { bgcolor: T.tealBg } }}
          >
            Add Credential
          </Button>
        </Box>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 1.5,
            bgcolor: T.tealBg, border: `1px solid ${T.tealBg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock sx={{ fontSize: 20, color: T.teal }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: T.textPrimary }}>
              Your Vault
            </Typography>
            {!isLoading && (
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                {vault.length} {vault.length === 1 ? 'site' : 'sites'} · {totalCreds} {totalCreds === 1 ? 'credential' : 'credentials'}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Search */}
        {!isLoading && vault.length > 0 && (
          <TextField
            fullWidth
            size="small"
            placeholder="Search by site or username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: T.textMuted, fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3, ...FIELD }}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <VaultSkeleton T={T} />
        ) : isError ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <ErrorOutline sx={{ fontSize: 48, color: '#f87171', mb: 2 }} />
            <Typography sx={{ color: T.textMuted, mb: 2 }}>Failed to load vault</Typography>
            <Button onClick={refetch} sx={{ color: T.teal }}>Retry</Button>
          </Box>
        ) : vault.length === 0 ? (
          <Box sx={{
            textAlign: 'center', py: 8,
            bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3,
          }}>
            <Lock sx={{ fontSize: 48, color: T.teal, opacity: 0.4, mb: 2 }} />
            <Typography sx={{ fontWeight: 700, color: T.textPrimary, mb: 1 }}>Vault is empty</Typography>
            <Typography sx={{ color: T.textMuted, fontSize: '0.875rem', mb: 3 }}>
              No credentials saved yet.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate(Constants.DB_ADD_PASSWORD_ROUTE)}
              sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#0f766e' } }}
            >
              Save Your First Credential
            </Button>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Search sx={{ fontSize: 40, color: T.textMuted, mb: 1.5 }} />
            <Typography sx={{ color: T.textMuted }}>No results for "{search}"</Typography>
          </Box>
        ) : (
          <AnimatePresence>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <HostCard
                    entry={entry}
                    T={T}
                    enqueueSnackbar={enqueueSnackbar}
                    onEdit={setEditTarget}
                    onDeleteCred={setDelCred}
                    onDeleteHost={setDelHost}
                  />
                </motion.div>
              ))}
            </Box>
          </AnimatePresence>
        )}
      </Container>

      {/* Edit dialog */}
      {editTarget && (
        <EditDialog
          target={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete credential confirm */}
      {deleteCredTarget && (
        <ConfirmDialog
          title="Delete Credential"
          body={`Remove "${deleteCredTarget.label}" from your vault? This cannot be undone.`}
          loading={deletingCred}
          onConfirm={() => deleteCred(deleteCredTarget.credId)}
          onClose={() => setDelCred(null)}
        />
      )}

      {/* Delete host confirm */}
      {deleteHostTarget && (
        <ConfirmDialog
          title="Delete Site Entry"
          body={`Remove all credentials for "${deleteHostTarget.host}"? This cannot be undone.`}
          loading={deletingHost}
          onConfirm={() => deleteHost(deleteHostTarget.pmId)}
          onClose={() => setDelHost(null)}
        />
      )}
    </Box>
  );
};

export default ViewPassword;
