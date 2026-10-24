import React, { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notify } from '@shared/notify';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import {
  Box, Button, Chip, CircularProgress, Container, Dialog,
  DialogContent, DialogTitle, Divider, IconButton,
  InputAdornment, MenuItem, Skeleton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';

import {
  AddRounded, ArrowBackRounded, CheckCircleRounded, ContentCopyRounded,
  DeleteOutlineRounded, EditRounded, ErrorOutlineRounded,
  LockRounded, SearchRounded, Visibility, VisibilityOff, ClearRounded,
  AutoAwesomeRounded, CloudOffRounded, LockOpenRounded, DnsRounded, StickyNote2Rounded,
  WarningAmberRounded,
} from '@mui/icons-material';

import BrandLogo, { domainFromUrl } from '@shared/brand/BrandLogo';
import { looksLikeSite, withScheme, isValidUrl, siteKey, findDuplicate, FIELD_TYPES, isSecretField } from './entryUtils';
import FieldValue from './FieldValue';
import useSiteFromName from './useSiteFromName';

import { useT, getFieldSx } from '@shared/theme';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';

import {
  updateCredential, deleteCredentialByCredentialId, deleteHostById,
} from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';

import { analyzeVault, STRENGTH_LEVELS, generatePassword } from './passwordUtils';
import { VaultAurora, GlassPanel, StrengthMeter, useScrollTop, goBackOr, ConfirmDialog, ResponsiveDialogActions } from './vaultShared';
import useVaultQuery, { useVaultOffline, TRASH_QUERY_KEY } from './useVault';

// Compact "3 min ago" for the offline-snapshot banner.
const relativeTime = (ts) => {
  if (!ts) return '';
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24); return `${d} day${d > 1 ? 's' : ''} ago`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Schema + helpers
// ─────────────────────────────────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().optional().default(''),
  type: z.enum(['LOGIN', 'SERVER', 'NOTE']).default('LOGIN'),
  url: z.string().trim().optional().default(''),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  pin: z.string().optional().default(''),
  notes: z.string().optional().default(''),
}).superRefine((v, ctx) => {
  if (v.url && !isValidUrl(v.url)) {
    ctx.addIssue({ code: 'custom', path: ['url'], message: 'Enter a site like example.com, or leave it empty' });
  }
  if (v.type !== 'NOTE' && !v.username.trim()) {
    ctx.addIssue({ code: 'custom', path: ['username'], message: 'Username is required' });
  }
});

// What each kind of entry looks like in the list and in the edit dialog.
const TYPE_META = {
  LOGIN:  { label: 'Login',  Icon: LockRounded },
  SERVER: { label: 'Server', Icon: DnsRounded },
  NOTE:   { label: 'Note',   Icon: StickyNote2Rounded },
};

const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const hasPinValue = (v) => hasValue(v) && String(v).trim() !== '0';

const getTextClampSx = (lines = 1) => ({
  minWidth: 0, overflow: 'hidden', display: '-webkit-box',
  WebkitLineClamp: lines, WebkitBoxOrient: 'vertical',
  overflowWrap: 'anywhere', wordBreak: 'break-word',
});

const getMonoValueSx = (T, visible) => ({
  flex: '1 1 140px', minWidth: 0, color: T.textMuted,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: { xs: '0.78rem', sm: '0.82rem' }, lineHeight: 1.45,
  letterSpacing: visible ? 0 : { xs: 1.1, sm: 1.4 },
  overflowWrap: 'anywhere', wordBreak: 'break-word',
});

const iconButtonSx = (T, hoverColor) => ({
  width: 36, height: 36, color: T.textMuted, flexShrink: 0, borderRadius: 2,
  '&:hover': { color: hoverColor || T.teal, bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Small pieces
// ─────────────────────────────────────────────────────────────────────────────

const HostAvatar = memo(({ host, size = 38 }) => (
  <BrandLogo logoDomain={looksLikeSite(host) ? domainFromUrl(host) : ''} companyName={host} size={size} radius={2} />
));
HostAvatar.displayName = 'HostAvatar';

const StrengthDot = ({ level, reused }) => {
  const lvl = STRENGTH_LEVELS[level] ?? STRENGTH_LEVELS[0];
  const tip = reused ? 'Reused password' : `${lvl.label} password`;
  return (
    <Tooltip title={tip}>
      <Box
        aria-label={tip}
        sx={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, bgcolor: lvl.color, boxShadow: `0 0 8px ${lvl.glow}` }}
      />
    </Tooltip>
  );
};

const CopyBtn = memo(({ value, label, copied, onCopy, T }) => (
  <Tooltip title={copied ? 'Copied!' : `Copy ${label}`}>
    <span>
      <IconButton
        size="small"
        onClick={() => onCopy(value)}
        disabled={!hasValue(value)}
        aria-label={`Copy ${label}`}
        sx={{ ...iconButtonSx(T, copied ? '#22c55e' : T.teal), color: copied ? '#22c55e' : T.textMuted, opacity: hasValue(value) ? 1 : 0.45 }}
      >
        {copied ? <CheckCircleRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}
      </IconButton>
    </span>
  </Tooltip>
));
CopyBtn.displayName = 'CopyBtn';

const SecretValueRow = memo(({ label, value, maskedText = '••••••••', copied, copiedKey, onCopy, T }) => {
  const [visible, setVisible] = useState(false);
  if (!hasValue(value)) return null;
  const displayValue = String(value);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: { xs: 0.75, sm: 1 }, rowGap: 0.35, py: 0.38, minWidth: 0 }}>
      <Typography
        sx={{
          flex: { xs: '1 1 92px', sm: '0 0 92px', md: '0 0 104px' }, maxWidth: { xs: '100%', sm: 104 },
          color: T.textMuted, fontSize: { xs: '0.7rem', sm: '0.72rem' }, lineHeight: 1.25, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}
        title={label}
      >
        {label}
      </Typography>
      <Typography sx={getMonoValueSx(T, visible)} title={visible ? displayValue : ''}>
        {visible ? displayValue : maskedText}
      </Typography>
      <Tooltip title={visible ? `Hide ${label}` : `Show ${label}`}>
        <IconButton size="small" onClick={() => setVisible((v) => !v)} sx={iconButtonSx(T, T.teal)} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>
          {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </Tooltip>
      <CopyBtn value={displayValue} label={label} copied={copied === copiedKey} onCopy={(v) => onCopy(v, copiedKey)} T={T} />
    </Box>
  );
});
SecretValueRow.displayName = 'SecretValueRow';

const EditCustomFieldRow = memo(({ field, index, onChange, onRemove, T, FIELD }) => {
  const [showVal, setShowVal] = useState(false);
  const secret = isSecretField(field);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(100px, 0.38fr) 116px minmax(0, 1fr) auto' }, gap: 1, alignItems: 'flex-start', minWidth: 0 }}>
      <TextField size="small" label="Label" value={field.fieldKey ?? ''} onChange={(e) => onChange(index, 'fieldKey', e.target.value)} sx={FIELD} />
      <TextField
        select size="small" label="Type" value={field.fieldType ?? 'HIDDEN'}
        onChange={(e) => onChange(index, 'fieldType', e.target.value)} sx={FIELD}
      >
        {FIELD_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
      </TextField>
      <TextField
        size="small" label="Value" value={field.fieldValue ?? ''}
        onChange={(e) => onChange(index, 'fieldValue', e.target.value)}
        // multiline so a pasted key keeps its line breaks; masked with CSS, as type=password is single-line
        multiline={secret} minRows={1} maxRows={8}
        slotProps={{ htmlInput: { style: secret && !showVal ? { WebkitTextSecurity: 'disc' } : undefined } }}
        InputProps={secret ? { endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => setShowVal((v) => !v)} sx={{ color: T.teal }} aria-label="Toggle value visibility">
              {showVal ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ) } : undefined}
        sx={FIELD}
      />
      <Tooltip title="Remove">
        <IconButton size="small" onClick={() => onRemove(index)} sx={{ ...iconButtonSx(T, '#f87171'), mt: { xs: -0.5, sm: 0.5 }, justifySelf: { xs: 'flex-end', sm: 'center' } }} aria-label="Remove field">
          <DeleteOutlineRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
});
EditCustomFieldRow.displayName = 'EditCustomFieldRow';

// ─────────────────────────────────────────────────────────────────────────────
// Edit dialog
// ─────────────────────────────────────────────────────────────────────────────

const EditDialog = ({ target, vault, onClose }) => {
  const T = useT();
  const FIELD = getFieldSx(T);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();

  const [showPw, setShowPw] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [customFields, setCustomFields] = useState((target?.cred?.customFields ?? []).map((f) => ({ ...f })));

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: target?.cred?.name ?? '',
      type: target?.cred?.type ?? 'LOGIN',
      url: target?.cred?.url ?? '',
      username: target?.cred?.username ?? '',
      password: target?.cred?.password ?? '',
      pin: hasPinValue(target?.cred?.pin) ? String(target.cred.pin) : '',
      notes: target?.cred?.notes ?? '',
    },
  });

  const pwValue = watch('password');
  const [name, type, url, username] = watch(['name', 'type', 'url', 'username']);

  // A site that is already saved is left alone; an entry with none can find one from its name.
  const setUrl = useCallback((v) => setValue('url', v, { shouldValidate: false }), [setValue]);
  const { autoSite, suggestion, detecting, markTyped, dropSite, takeSuggestion } = useSiteFromName({
    name, enabled: type !== 'NOTE', setUrl, startTouched: !!target?.cred?.url,
  });

  const duplicate = useMemo(
    () => findDuplicate(vault, { url, name, username, ignoreId: target?.cred?.id }),
    [vault, url, name, username, target?.cred?.id],
  );

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => updateCredential(target.pmId, {
      id: target.cred.id, ...data,
      url: data.url ? withScheme(data.url) : '',   // blank removes the site
      customFields: customFields.map((f) => ({ ...f, fieldKey: f.fieldKey?.trim() ?? '', fieldValue: f.fieldValue ?? '', fieldType: f.fieldType ?? 'HIDDEN' })).filter((f) => f.fieldKey),
    }),
    onSuccess: () => { notify.success('Credential updated'); queryClient.invalidateQueries({ queryKey: ['pm-vault'] }); onClose(); },
    onError: (err) => notify.error(err?.response?.data?.message ?? 'Failed to update'),
  });

  const updateField = useCallback((i, k, v) => setCustomFields((p) => p.map((f, idx) => (idx === i ? { ...f, [k]: v } : f))), []);
  const removeField = useCallback((i) => setCustomFields((p) => p.filter((_, idx) => idx !== i)), []);
  const addField = useCallback(() => setCustomFields((p) => [...p, { fieldKey: '', fieldValue: '', fieldType: 'HIDDEN' }]), []);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: T.bg, border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`, borderRadius: fullScreen ? 0 : 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <BrandLogo logoDomain={looksLikeSite(target.host) ? domainFromUrl(target.host) : ''} companyName={target.host} size={42} radius={2.5} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: T.textPrimary, fontWeight: 900, fontSize: '1.08rem', lineHeight: 1.2 }}>
              Edit Credential
            </Typography>
            <Typography sx={{ color: T.textMuted, fontWeight: 500, fontSize: { xs: '0.76rem', sm: '0.8rem' }, ...getTextClampSx(1) }}>
              {target.host}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important', px: { xs: 2, sm: 3 } }}>
        <Controller name="type" control={control} render={({ field }) => (
          <ToggleButtonGroup exclusive fullWidth size="small" value={field.value} aria-label="Entry type"
            onChange={(_, v) => { if (v) field.onChange(v); }}
            sx={{ '& .MuiToggleButton-root': { color: T.textMuted, borderColor: T.glassBorder, fontWeight: 700, gap: 0.75, textTransform: 'none', '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, borderColor: `${T.teal}66` } } }}>
            {Object.entries(TYPE_META).map(([value, { label, Icon }]) => (
              <ToggleButton key={value} value={value}><Icon sx={{ fontSize: 17 }} />{label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        )} />
        <Box>
          <Controller name="name" control={control} render={({ field }) => (
            <TextField {...field} fullWidth label="Name" size="small" placeholder={target.host} autoComplete="off"
              InputProps={{ endAdornment: (
                <InputAdornment position="end">
                  {detecting ? <CircularProgress size={16} sx={{ color: T.teal }} />
                    : siteKey(url) ? <BrandLogo logoDomain={siteKey(url)} companyName={name} size={24} radius={1.5} /> : null}
                </InputAdornment>
              ) }} sx={FIELD} />
          )} />
          {(autoSite || suggestion) && (
            <Box sx={{ pt: 1 }}>
              {autoSite ? (
                <Chip size="small" label={`${autoSite.domain} · site found`} onDelete={dropSite}
                  sx={{ color: T.textPrimary, bgcolor: T.tealBg, border: `1px solid ${T.teal}44`, fontWeight: 700, '& .MuiChip-deleteIcon': { color: T.textMuted } }} />
              ) : (
                <Chip size="small" clickable variant="outlined" onClick={takeSuggestion} label={`Use ${suggestion.domain}?`}
                  sx={{ color: T.teal, borderColor: `${T.teal}66`, fontWeight: 700 }} />
              )}
            </Box>
          )}
        </Box>
        <Controller name="url" control={control} render={({ field }) => (
          <TextField {...field} label={type === 'SERVER' ? 'Address (optional)' : 'Website (optional)'} size="small" placeholder="example.com" autoComplete="off"
            error={!!errors.url} helperText={errors.url?.message}
            onChange={(e) => { markTyped(); field.onChange(e); }} sx={FIELD} />
        )} />
        {type !== 'NOTE' && (
          <Controller name="username" control={control} render={({ field }) => (
            <TextField {...field} label={type === 'SERVER' ? 'Server user' : 'Username / Email'} size="small" error={!!errors.username} helperText={errors.username?.message} sx={FIELD} />
          )} />
        )}
        <Box>
          <Controller name="password" control={control} render={({ field }) => (
            <TextField {...field} fullWidth label="Password" size="small" type={showPw ? 'text' : 'password'}
              InputProps={{ endAdornment: (
                <InputAdornment position="end" sx={{ gap: 0.25 }}>
                  <Tooltip title="Generate strong password">
                    <IconButton size="small" onClick={() => { setValue('password', generatePassword({ length: 18 }), { shouldValidate: true }); setShowPw(true); }} sx={{ color: T.teal }} aria-label="Generate password">
                      <AutoAwesomeRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => setShowPw((v) => !v)} sx={{ color: T.teal }} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ) }} sx={FIELD} />
          )} />
          {pwValue ? <Box sx={{ pt: 1, px: 0.25 }}><StrengthMeter password={pwValue} /></Box> : null}
          {!pwValue && type !== 'NOTE' && (
            <Typography sx={{ mt: 0.75, ml: 0.25, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.74rem', fontWeight: 600, color: '#f59e0b' }}>
              <WarningAmberRounded sx={{ fontSize: 15 }} /> No password yet: this will be saved without one.
            </Typography>
          )}
        </Box>
        {duplicate && (
          <Typography role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.8rem', fontWeight: 700, color: '#f87171' }}>
            <WarningAmberRounded sx={{ fontSize: 17 }} />
            You already have this entry{duplicate.pm?.host ? ` (${duplicate.pm.host})` : ''}. Change the name or username.
          </Typography>
        )}
        <Controller name="pin" control={control} render={({ field }) => (
          <TextField {...field} label="PIN" size="small" type={showPin ? 'text' : 'password'} inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
            InputProps={{ endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPin((v) => !v)} sx={{ color: T.teal }} aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
                  {showPin ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ) }} sx={FIELD} />
        )} />
        <Controller name="notes" control={control} render={({ field }) => (
          <TextField {...field} label="Notes" size="small" multiline minRows={2} maxRows={6} sx={FIELD} />
        )} />

        <Divider sx={{ borderColor: T.glassBorder }} />

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 1.5 }}>
            <Typography sx={{ color: T.textMuted, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>Custom Fields</Typography>
            <Button size="small" startIcon={<AddRounded />} onClick={addField} sx={{ color: T.teal, border: `1px dashed ${T.teal}`, borderRadius: 2, px: 1.25, fontSize: '0.76rem', fontWeight: 700, minHeight: 40, '&:hover': { bgcolor: T.tealBg } }}>Add</Button>
          </Stack>
          {customFields.length === 0 ? (
            <Typography sx={{ color: T.textMuted, fontSize: '0.82rem', opacity: 0.85 }}>No custom fields added.</Typography>
          ) : (
            <Stack spacing={1.25}>
              {customFields.map((f, i) => (
                <EditCustomFieldRow key={`${f.id ?? 'new'}-${i}`} field={f} index={i} onChange={updateField} onRemove={removeField} T={T} FIELD={FIELD} />
              ))}
            </Stack>
          )}
        </Box>
      </DialogContent>

      <ResponsiveDialogActions>
        <Button onClick={onClose} sx={{ color: T.textMuted, fontWeight: 700 }}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit((d) => mutate(d))} disabled={isPending || !!duplicate}
          startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, borderRadius: 2, '&:hover': { bgcolor: '#0f766e' } }}>
          {isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </ResponsiveDialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Credential card
// ─────────────────────────────────────────────────────────────────────────────

const CredentialCard = memo(({ cred, pmId, host, flag, T, onEdit, onDelete }) => {
  const [copiedKey, setCopiedKey] = useState('');

  const copy = useCallback(async (text, key) => {
    if (!hasValue(text)) return;
    const res = await CommonServices.handleCopy(String(text));
    if (res.success) { setCopiedKey(key); setTimeout(() => setCopiedKey(''), 1400); }
    else notify.error('Copy failed');
  }, []);

  const visibleCustomFields = useMemo(
    () => (cred.customFields ?? []).filter((f) => hasValue(f.fieldKey) && hasValue(f.fieldValue)),
    [cred.customFields]
  );

  // Under the username: the entry's own name when it says more than the site does, and its kind.
  const showName = !!(cred.username && cred.name && cred.name.trim().toLowerCase() !== (host ?? '').trim().toLowerCase());
  const { Icon: TypeIcon, label: typeLabel } = TYPE_META[cred.type] ?? TYPE_META.LOGIN;
  const showSubline = showName || (cred.type && cred.type !== 'LOGIN');

  const hasAnySecret = hasValue(cred.password) || hasPinValue(cred.pin) || visibleCustomFields.length > 0;

  return (
    <Box sx={{
      p: { xs: 1.4, sm: 1.7 }, borderRadius: 2.5,
      bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${T.glassBorder}`, transition: 'border-color .2s, background-color .2s', minWidth: 0,
      '&:hover': { borderColor: 'rgba(13,148,136,0.34)', bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
    }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto', alignItems: 'center', gap: { xs: 0.5, sm: 0.75 }, mb: hasAnySecret ? 0.75 : 0, minWidth: 0 }}>
        {flag ? <StrengthDot {...flag} /> : <Box sx={{ width: 9 }} />}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: T.textPrimary, fontWeight: 800, fontSize: { xs: '0.88rem', sm: '0.94rem' }, lineHeight: 1.35, ...getTextClampSx(2) }} title={cred.username}>
            {cred.username || cred.name || 'No username'}
          </Typography>
          {showSubline ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, mt: 0.1 }}>
              {cred.type && cred.type !== 'LOGIN' && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: T.teal, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 }}>
                  <TypeIcon sx={{ fontSize: 13 }} />{typeLabel}
                </Box>
              )}
              {showName && (
                <Typography sx={{ color: T.textMuted, fontSize: '0.74rem', ...getTextClampSx(1) }} title={cred.name}>{cred.name}</Typography>
              )}
            </Box>
          ) : null}
          {flag?.reused && (
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reused</Typography>
          )}
        </Box>
        <CopyBtn value={cred.username} label="username" copied={copiedKey === 'username'} onCopy={(v) => copy(v, 'username')} T={T} />
        <Tooltip title="Edit credential">
          <IconButton size="small" onClick={() => onEdit({ pmId, cred, host })} sx={iconButtonSx(T, T.teal)} aria-label="Edit credential"><EditRounded fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Delete credential">
          <IconButton size="small" onClick={() => onDelete({ credId: cred.id, label: cred.username || 'this credential' })} sx={iconButtonSx(T, '#f87171')} aria-label="Delete credential"><DeleteOutlineRounded fontSize="small" /></IconButton>
        </Tooltip>
      </Box>

      {hasAnySecret && (
        <Stack spacing={0.25} sx={{ minWidth: 0, mt: 0.35, pl: { xs: 0, sm: 1.75 } }}>
          <SecretValueRow label="Password" value={cred.password} maskedText="••••••••••••" copied={copiedKey} copiedKey="password" onCopy={copy} T={T} />
          {hasPinValue(cred.pin) && (
            <SecretValueRow label="PIN" value={cred.pin} maskedText="••••" copied={copiedKey} copiedKey="pin" onCopy={copy} T={T} />
          )}
          {visibleCustomFields.map((f, index) => {
            const id = f.id ?? `${f.fieldKey}-${index}`;
            return <FieldValue key={id} field={f} copied={copiedKey === `custom-${id}`} onCopy={(v) => copy(v, `custom-${id}`)} />;
          })}
        </Stack>
      )}

      {hasValue(cred.notes) && (
        <Box sx={{ mt: 1.1, pt: 1, borderTop: `1px solid ${T.glassBorder}` }}>
          <Typography sx={{ color: T.textMuted, fontSize: { xs: '0.76rem', sm: '0.8rem' }, lineHeight: 1.5, fontStyle: 'italic', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{cred.notes}</Typography>
        </Box>
      )}
    </Box>
  );
});
CredentialCard.displayName = 'CredentialCard';

// ─────────────────────────────────────────────────────────────────────────────
// Host card
// ─────────────────────────────────────────────────────────────────────────────

const HostCard = memo(({ entry, flags, T, onEdit, onDeleteCred, onDeleteHost }) => {
  const credentialCount = entry.credentials?.length ?? 0;
  return (
    <GlassPanel sx={{ p: { xs: 1.5, sm: 2, md: 2.25 }, minWidth: 0 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto', alignItems: 'center', gap: { xs: 1, sm: 1.25 }, mb: 1.75, minWidth: 0 }}>
        <HostAvatar host={entry.host} size={38} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: T.textPrimary, fontWeight: 900, fontSize: { xs: '0.95rem', sm: '1.05rem' }, lineHeight: 1.25, ...getTextClampSx(2) }} title={entry.host}>{entry.host}</Typography>
          <Typography sx={{ color: T.textMuted, fontSize: '0.76rem', mt: 0.2 }}>{credentialCount} {credentialCount === 1 ? 'credential' : 'credentials'}</Typography>
        </Box>
        <Chip size="small" label={credentialCount} sx={{ display: { xs: 'none', sm: 'inline-flex' }, height: 24, bgcolor: T.tealBg, color: T.teal, fontWeight: 800, border: `1px solid ${T.teal}33` }} />
        <Tooltip title="Delete all credentials for this site">
          <IconButton size="small" onClick={() => onDeleteHost({ pmId: entry.id, host: entry.host })} sx={iconButtonSx(T, '#f87171')} aria-label="Delete site"><DeleteOutlineRounded fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
      <Stack spacing={1.25}>
        {entry.credentials?.map((cred) => (
          <CredentialCard key={cred.id} cred={cred} pmId={entry.id} host={entry.host} flag={flags?.[cred.id]} T={T} onEdit={onEdit} onDelete={onDeleteCred} />
        ))}
      </Stack>
    </GlassPanel>
  );
});
HostCard.displayName = 'HostCard';

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip
// ─────────────────────────────────────────────────────────────────────────────

const FilterChip = ({ label, count, active, tone, onClick, T }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    aria-pressed={active}
    sx={{
      appearance: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.75,
      minHeight: 40, px: 1.5, borderRadius: 999, fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap',
      transition: 'all .2s ease',
      color: active ? '#fff' : T.textMuted, // active is always white; tone only drives bgcolor
      bgcolor: active ? (tone === 'weak' ? '#f59e0b' : tone === 'reused' ? '#ef4444' : T.teal) : 'transparent',
      border: `1px solid ${active ? 'transparent' : T.glassBorder}`,
      '&:hover': { borderColor: T.teal, color: active ? '#fff' : T.textPrimary },
      '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
    }}
  >
    {label}
    <Box component="span" sx={{ px: 0.75, py: 0.1, borderRadius: 999, fontSize: '0.7rem', bgcolor: active ? 'rgba(255,255,255,0.25)' : T.glassBorder, color: active ? '#fff' : T.textMuted, fontVariantNumeric: 'tabular-nums' }}>{count}</Box>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const VaultSkeleton = ({ T }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
    {[1, 2, 3, 4].map((i) => (
      <GlassPanel key={i} sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Skeleton variant="circular" width={38} height={38} sx={{ bgcolor: T.glassBorder }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="55%" sx={{ bgcolor: T.glassBorder }} />
            <Skeleton variant="text" width="30%" sx={{ bgcolor: T.glassBorder }} />
          </Box>
        </Box>
        <Skeleton variant="rounded" height={92} sx={{ bgcolor: T.glassBorder, borderRadius: 2 }} />
      </GlassPanel>
    ))}
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const ViewPassword = () => {
  usePageMeta('Vault');
  useScrollTop();

  const T = useT();
  const FIELD = getFieldSx(T);
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | weak | reused
  const [editTarget, setEditTarget] = useState(null);
  const [deleteCredTarget, setDelCred] = useState(null);
  const [deleteHostTarget, setDelHost] = useState(null);
  const offline = useVaultOffline(); // { syncedAt } | { locked } | { invalidated } | null

  const { data: vault = [], isLoading, isError, refetch } = useVaultQuery();

  const { flags, weak, reused, total } = useMemo(() => analyzeVault(vault), [vault]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return vault
      .map((entry) => {
        // search filter (host-level match keeps all creds)
        const hostMatch = !q || (entry.host?.toLowerCase() ?? '').includes(q);

        let creds = entry.credentials ?? [];

        if (q && !hostMatch) {
          creds = creds.filter((c) => {
            const u = c.username?.toLowerCase() ?? '';
            const n = c.notes?.toLowerCase() ?? '';
            const cf = c.customFields?.some((f) => (f.fieldKey?.toLowerCase() ?? '').includes(q));
            return u.includes(q) || n.includes(q) || cf;
          });
        }

        if (filter !== 'all') {
          creds = creds.filter((c) => flags[c.id]?.[filter]);
        }

        return { ...entry, credentials: creds };
      })
      .filter((entry) => (entry.credentials?.length ?? 0) > 0);
  }, [vault, search, filter, flags]);

  // Both deletes move to Trash (the server soft-deletes); they come back from there for 30 days.
  const afterTrash = () => {
    queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
    queryClient.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
  };

  const { mutate: deleteCred, isPending: deletingCred } = useMutation({
    mutationFn: (credId) => deleteCredentialByCredentialId(credId),
    onSuccess: () => { notify.success('Moved to Trash'); afterTrash(); setDelCred(null); },
    onError: (err) => notify.error(err?.response?.data?.message ?? 'Failed to move to Trash'),
  });

  const { mutate: deleteHost, isPending: deletingHost } = useMutation({
    mutationFn: (pmId) => deleteHostById(pmId),
    onSuccess: () => { notify.success('Moved to Trash'); afterTrash(); queryClient.invalidateQueries({ queryKey: ['pm-hosts'] }); setDelHost(null); },
    onError: (err) => notify.error(err?.response?.data?.message ?? 'Failed to move to Trash'),
  });

  return (
    <Box sx={{ position: 'relative', bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' }, overflowX: 'hidden' }}>
      <VaultAurora />

      <Container maxWidth={false} sx={{
        position: 'relative', zIndex: 1, width: '100%',
        maxWidth: { xs: '100%', sm: 760, md: 980, lg: 1240, xl: 1480 },
        px: { xs: 2, sm: 2.5, md: 3 }, py: { xs: 2.5, sm: 3.5, md: 5 },
      }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: { xs: 2, md: 2.5 } }}>
          <Button startIcon={<ArrowBackRounded />} onClick={() => goBackOr(navigate)}
            sx={{ color: T.textMuted, fontWeight: 700, px: 1, minHeight: 44, borderRadius: 2, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
            Back
          </Button>
          <Button startIcon={<AddRounded />} onClick={() => navigate(Constants.DB_ADD_PASSWORD_ROUTE)}
            sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, px: 2, minHeight: 44, borderRadius: 2, whiteSpace: 'nowrap', boxShadow: `0 8px 24px ${T.tealGlow}`, '&:hover': { bgcolor: '#0f766e' } }}>
            Add
          </Button>
        </Box>

        {/* Header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', gap: 1.4, mb: 2.5 }}>
          <Box sx={{ width: { xs: 42, sm: 46 }, height: { xs: 42, sm: 46 }, borderRadius: 2.5, bgcolor: T.tealBg, border: `1px solid ${T.teal}44`, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: `0 0 28px ${T.tealGlow}` }}>
            <LockRounded sx={{ fontSize: 22, color: T.teal }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 'clamp(1.25rem, 5vw, 1.6rem)', lineHeight: 1.1, fontWeight: 900, color: T.textPrimary, ...getTextClampSx(2) }}>Your Vault</Typography>
            {!isLoading && (
              <Typography sx={{ mt: 0.35, fontSize: { xs: '0.78rem', sm: '0.84rem' }, color: T.textMuted }}>
                {vault.length} {vault.length === 1 ? 'site' : 'sites'} · {total} {total === 1 ? 'credential' : 'credentials'}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Offline snapshot banner */}
        {offline?.syncedAt && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, mb: 2.5, borderRadius: 2.5, bgcolor: T.warningBg, border: `1px solid ${T.warning}44` }}>
            <CloudOffRounded sx={{ color: T.warning, fontSize: 20, flexShrink: 0 }} />
            <Typography sx={{ color: T.textMuted, fontSize: '0.8rem', lineHeight: 1.4 }}>
              Offline — showing your vault saved {relativeTime(offline.syncedAt)}. Editing is unavailable until you reconnect.
            </Typography>
          </Box>
        )}

        {/* Search + filters */}
        {!isLoading && vault.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth size="small" placeholder="Search site, username, notes…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: T.textMuted, fontSize: 19 }} /></InputAdornment>),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')} sx={{ color: T.textMuted }} aria-label="Clear search"><ClearRounded fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{ mb: 1.5, ...FIELD, '& input': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <FilterChip label="All"    count={total}  active={filter === 'all'}    tone="teal"   onClick={() => setFilter('all')}    T={T} />
              <FilterChip label="Weak"   count={weak}   active={filter === 'weak'}   tone="weak"   onClick={() => setFilter(filter === 'weak' ? 'all' : 'weak')}   T={T} />
              <FilterChip label="Reused" count={reused} active={filter === 'reused'} tone="reused" onClick={() => setFilter(filter === 'reused' ? 'all' : 'reused')} T={T} />
            </Box>
          </Box>
        )}

        {/* Content */}
        {isLoading ? (
          <VaultSkeleton T={T} />
        ) : isError ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            {offline?.invalidated ? (
              <>
                <LockRounded sx={{ fontSize: 48, color: T.warning, mb: 2 }} />
                <Typography sx={{ color: T.textPrimary, fontWeight: 800, mb: 1 }}>Device security changed</Typography>
                <Typography sx={{ color: T.textMuted, mb: 2, maxWidth: 360, mx: 'auto', fontSize: '0.86rem' }}>
                  Your offline copy was locked after a change to this device’s screen lock. Connect to the internet to sync your vault again.
                </Typography>
                <Button onClick={refetch} sx={{ color: T.teal, fontWeight: 800, minHeight: 44 }}>Retry</Button>
              </>
            ) : offline?.locked ? (
              <>
                <LockRounded sx={{ fontSize: 48, color: T.teal, mb: 2 }} />
                <Typography sx={{ color: T.textPrimary, fontWeight: 800, mb: 1 }}>You’re offline</Typography>
                <Typography sx={{ color: T.textMuted, mb: 2, maxWidth: 360, mx: 'auto', fontSize: '0.86rem' }}>
                  Unlock to view your saved vault from this device.
                </Typography>
                <Button startIcon={<LockOpenRounded />} onClick={refetch} variant="contained"
                  sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, borderRadius: 2, minHeight: 44, '&:hover': { bgcolor: '#0f766e' } }}>
                  Unlock vault
                </Button>
              </>
            ) : (
              <>
                <ErrorOutlineRounded sx={{ fontSize: 48, color: '#f87171', mb: 2 }} />
                <Typography sx={{ color: T.textMuted, mb: 2 }}>Failed to load vault</Typography>
                <Button onClick={refetch} sx={{ color: T.teal, fontWeight: 800, minHeight: 44 }}>Retry</Button>
              </>
            )}
          </Box>
        ) : vault.length === 0 ? (
          <GlassPanel sx={{ textAlign: 'center', py: { xs: 6, sm: 8 }, px: 2 }}>
            <LockRounded sx={{ fontSize: 48, color: T.teal, opacity: 0.42, mb: 2 }} />
            <Typography sx={{ fontWeight: 900, color: T.textPrimary, mb: 1, fontSize: '1.05rem' }}>Vault is empty</Typography>
            <Typography sx={{ color: T.textMuted, fontSize: '0.875rem', mb: 3 }}>No credentials saved yet.</Typography>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate(Constants.DB_ADD_PASSWORD_ROUTE)}
              sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, borderRadius: 2, minHeight: 48, '&:hover': { bgcolor: '#0f766e' } }}>
              Save Your First Credential
            </Button>
          </GlassPanel>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
            <SearchRounded sx={{ fontSize: 40, color: T.textMuted, mb: 1.5 }} />
            <Typography sx={{ color: T.textMuted, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {filter !== 'all' ? `No ${filter} passwords` : `No results for “${search}”`}
            </Typography>
          </Box>
        ) : (
          <AnimatePresence mode="popLayout">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 1.5, sm: 2, xl: 2.25 }, alignItems: 'start' }}>
              {filtered.map((entry, i) => (
                <motion.div key={entry.id} layout
                  initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.26, delay: Math.min(i * 0.035, 0.18) }} style={{ minWidth: 0 }}>
                  <HostCard entry={entry} flags={flags} T={T} onEdit={setEditTarget} onDeleteCred={setDelCred} onDeleteHost={setDelHost} />
                </motion.div>
              ))}
            </Box>
          </AnimatePresence>
        )}
      </Container>

      {editTarget && <EditDialog target={editTarget} vault={vault} onClose={() => setEditTarget(null)} />}
      {deleteCredTarget && (
        <ConfirmDialog title="Delete Credential" body={`Remove "${deleteCredTarget.label}" from your vault? Moves to Trash for 30 days, and can be restored from there until then.`} confirmLabel="Move to Trash" loadingLabel="Moving…" loading={deletingCred} onConfirm={() => deleteCred(deleteCredTarget.credId)} onClose={() => setDelCred(null)} />
      )}
      {deleteHostTarget && (
        <ConfirmDialog title="Delete Site Entry" body={`Remove all credentials for "${deleteHostTarget.host}"? Moves to Trash for 30 days, and can be restored from there until then.`} confirmLabel="Move to Trash" loadingLabel="Moving…" loading={deletingHost} onConfirm={() => deleteHost(deleteHostTarget.pmId)} onClose={() => setDelHost(null)} />
      )}
    </Box>
  );
};

export default ViewPassword;
