import React, { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import {
  Add,
  ArrowBack,
  CheckCircleOutline,
  ContentCopy,
  Delete,
  Edit,
  ErrorOutline,
  Language,
  Lock,
  Search,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

import { useT, getGlowProps, getFieldSx } from '@shared/theme';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';

import {
  getCredential,
  updateCredential,
  deleteCredentialByCredentialId,
  deleteHostById,
} from '@shared/services/ApiServices';

import CommonServices from '@shared/services/CommonServices';


// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const editSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional().default(''),
  pin: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
};

const hasPinValue = (value) => {
  if (!hasValue(value)) return false;
  return String(value).trim() !== '0';
};

const getTextClampSx = (lines = 1) => ({
  minWidth: 0,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
});

const getMonoValueSx = (T, visible) => ({
  flex: '1 1 140px',
  minWidth: 0,
  color: T.textMuted,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: {
    xs: '0.76rem',
    sm: '0.8rem',
    md: '0.82rem',
  },
  lineHeight: 1.45,
  letterSpacing: visible ? 0 : { xs: 1.1, sm: 1.4 },
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
});

const iconButtonSx = (T, hoverColor) => ({
  width: { xs: 34, sm: 32 },
  height: { xs: 34, sm: 32 },
  color: T.textMuted,
  flexShrink: 0,
  '&:hover': {
    color: hoverColor || T.teal,
    bgcolor: 'rgba(255,255,255,0.04)',
  },
});

const actionButtonSx = (T) => ({
  borderColor: T.teal,
  color: T.teal,
  borderRadius: 2,
  border: '1px solid',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  px: { xs: 1.5, sm: 2 },
  minHeight: 36,
  '&:hover': {
    bgcolor: T.tealBg,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Host Avatar
// ─────────────────────────────────────────────────────────────────────────────

const HostAvatar = memo(({ host, size = 36 }) => {
  const [err, setErr] = useState(false);
  const domain = host || '';
  const src = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

  if (err || !domain) {
    return (
      <Avatar
        sx={{
          width: size,
          height: size,
          bgcolor: 'rgba(13,148,136,0.15)',
          flexShrink: 0,
        }}
      >
        <Language sx={{ fontSize: size * 0.56, color: '#0d9488' }} />
      </Avatar>
    );
  }

  return (
    <Avatar
      src={src}
      onError={() => setErr(true)}
      sx={{
        width: size,
        height: size,
        bgcolor: 'rgba(13,148,136,0.08)',
        flexShrink: 0,
      }}
    >
      <Language sx={{ color: '#0d9488' }} />
    </Avatar>
  );
});

HostAvatar.displayName = 'HostAvatar';

// ─────────────────────────────────────────────────────────────────────────────
// Copy Button
// ─────────────────────────────────────────────────────────────────────────────

const CopyBtn = memo(({ value, label, copied, onCopy, T }) => (
  <Tooltip title={copied ? 'Copied!' : `Copy ${label}`}>
    <span>
      <IconButton
        size="small"
        onClick={() => onCopy(value)}
        disabled={!hasValue(value)}
        sx={{
          ...iconButtonSx(T, copied ? '#10b981' : T.teal),
          color: copied ? '#10b981' : T.textMuted,
          opacity: hasValue(value) ? 1 : 0.45,
        }}
      >
        {copied ? (
          <CheckCircleOutline fontSize="small" />
        ) : (
          <ContentCopy fontSize="small" />
        )}
      </IconButton>
    </span>
  </Tooltip>
));

CopyBtn.displayName = 'CopyBtn';

// ─────────────────────────────────────────────────────────────────────────────
// Secret Value Row
// Label is shown once.
// Desktop/tablet: label + value + icons stay one row.
// Mobile/no space: value wraps naturally below label.
// ─────────────────────────────────────────────────────────────────────────────

const SecretValueRow = memo(
  ({
    label,
    value,
    maskedText = '••••••••',
    copied,
    copiedKey,
    onCopy,
    T,
    defaultVisible = false,
  }) => {
    const [visible, setVisible] = useState(defaultVisible);

    if (!hasValue(value)) return null;

    const displayValue = String(value);

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          columnGap: { xs: 0.75, sm: 1 },
          rowGap: 0.35,
          py: 0.38,
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            flex: {
              xs: '1 1 92px',
              sm: '0 0 92px',
              md: '0 0 104px',
            },
            maxWidth: {
              xs: '100%',
              sm: 104,
            },
            color: T.textMuted,
            fontSize: {
              xs: '0.7rem',
              sm: '0.72rem',
              md: '0.74rem',
            },
            lineHeight: 1.25,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.45,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
          title={label}
        >
          {label}
        </Typography>

        <Typography
          sx={getMonoValueSx(T, visible)}
          title={visible ? displayValue : ''}
        >
          {visible ? displayValue : maskedText}
        </Typography>

        <Tooltip title={visible ? `Hide ${label}` : `Show ${label}`}>
          <IconButton
            size="small"
            onClick={() => setVisible((v) => !v)}
            sx={iconButtonSx(T, T.teal)}
          >
            {visible ? (
              <VisibilityOff fontSize="small" />
            ) : (
              <Visibility fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        <CopyBtn
          value={displayValue}
          label={label}
          copied={copied === copiedKey}
          onCopy={(v) => onCopy(v, copiedKey)}
          T={T}
        />
      </Box>
    );
  }
);

SecretValueRow.displayName = 'SecretValueRow';

// ─────────────────────────────────────────────────────────────────────────────
// Edit Custom Field Row
// ─────────────────────────────────────────────────────────────────────────────

const EditCustomFieldRow = memo(({ field, index, onChange, onRemove, T, FIELD }) => {
  const [showVal, setShowVal] = useState(false);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'minmax(120px, 0.42fr) minmax(0, 1fr) auto',
        },
        gap: 1,
        alignItems: 'flex-start',
        minWidth: 0,
      }}
    >
      <TextField
        size="small"
        label="Label"
        value={field.fieldKey ?? ''}
        onChange={(e) => onChange(index, 'fieldKey', e.target.value)}
        sx={FIELD}
      />

      <TextField
        size="small"
        label="Value"
        type={showVal ? 'text' : 'password'}
        value={field.fieldValue ?? ''}
        onChange={(e) => onChange(index, 'fieldValue', e.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={() => setShowVal((v) => !v)}
                sx={{ color: T.teal }}
              >
                {showVal ? (
                  <VisibilityOff fontSize="small" />
                ) : (
                  <Visibility fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={FIELD}
      />

      <Tooltip title="Remove">
        <IconButton
          size="small"
          onClick={() => onRemove(index)}
          sx={{
            ...iconButtonSx(T, '#f87171'),
            mt: { xs: -0.5, sm: 0.5 },
            justifySelf: { xs: 'flex-end', sm: 'center' },
          }}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
});

EditCustomFieldRow.displayName = 'EditCustomFieldRow';

// ─────────────────────────────────────────────────────────────────────────────
// Responsive Dialog Actions
// ─────────────────────────────────────────────────────────────────────────────

const ResponsiveDialogActions = ({ children }) => (
  <DialogActions
    sx={{
      px: { xs: 2, sm: 3 },
      pb: { xs: 2, sm: 2.5 },
      gap: 1,
      flexDirection: { xs: 'column-reverse', sm: 'row' },
      alignItems: { xs: 'stretch', sm: 'center' },
      '& > button': {
        width: { xs: '100%', sm: 'auto' },
      },
    }}
  >
    {children}
  </DialogActions>
);

// ─────────────────────────────────────────────────────────────────────────────
// Edit Dialog
// ─────────────────────────────────────────────────────────────────────────────

const EditDialog = ({ target, onClose }) => {
  const T = useT();
  const FIELD = getFieldSx(T);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [showPw, setShowPw] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [customFields, setCustomFields] = useState(
    (target?.cred?.customFields ?? []).map((f) => ({ ...f }))
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      username: target?.cred?.username ?? '',
      password: target?.cred?.password ?? '',
      pin: hasPinValue(target?.cred?.pin) ? String(target.cred.pin) : '',
      notes: target?.cred?.notes ?? '',
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) =>
      updateCredential(target.pmId, {
        id: target.cred.id,
        ...data,
        customFields: customFields
          .map((f) => ({
            ...f,
            fieldKey: f.fieldKey?.trim() ?? '',
            fieldValue: f.fieldValue ?? '',
          }))
          .filter((f) => f.fieldKey),
      }),
    onSuccess: () => {
      enqueueSnackbar('Credential updated', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      onClose();
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message ?? 'Failed to update', {
        variant: 'error',
      });
    },
  });

  const updateField = useCallback((index, key, value) => {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [key]: value } : f))
    );
  }, []);

  const removeField = useCallback((index) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addField = useCallback(() => {
    setCustomFields((prev) => [...prev, { fieldKey: '', fieldValue: '' }]);
  }, []);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          bgcolor: T.bg,
          border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
          borderRadius: fullScreen ? 0 : 3,
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          color: T.textPrimary,
          fontWeight: 800,
          pb: 1,
          px: { xs: 2, sm: 3 },
        }}
      >
        Edit Credential

        <Typography
          sx={{
            mt: 0.35,
            color: T.textMuted,
            fontWeight: 500,
            fontSize: { xs: '0.78rem', sm: '0.82rem' },
            ...getTextClampSx(2),
          }}
        >
          {target.host}
        </Typography>
      </DialogTitle>

      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pt: '12px !important',
          px: { xs: 2, sm: 3 },
        }}
      >
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Username / Email"
              size="small"
              error={!!errors.username}
              helperText={errors.username?.message}
              sx={FIELD}
            />
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Password"
              size="small"
              type={showPw ? 'text' : 'password'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPw((v) => !v)}
                      sx={{ color: T.teal }}
                    >
                      {showPw ? (
                        <VisibilityOff fontSize="small" />
                      ) : (
                        <Visibility fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={FIELD}
            />
          )}
        />

        <Controller
          name="pin"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="PIN"
              size="small"
              type={showPin ? 'text' : 'password'}
              inputProps={{
                inputMode: 'numeric',
                autoComplete: 'off',
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPin((v) => !v)}
                      sx={{ color: T.teal }}
                    >
                      {showPin ? (
                        <VisibilityOff fontSize="small" />
                      ) : (
                        <Visibility fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={FIELD}
            />
          )}
        />

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Notes"
              size="small"
              multiline
              minRows={2}
              maxRows={6}
              sx={FIELD}
            />
          )}
        />

        <Divider sx={{ borderColor: T.glassBorder }} />

        <Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 1.5 }}
          >
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              Custom Fields
            </Typography>

            <Button
              size="small"
              startIcon={<Add />}
              onClick={addField}
              sx={{
                color: T.teal,
                border: `1px dashed ${T.teal}`,
                borderRadius: 2,
                px: 1.25,
                fontSize: '0.76rem',
                fontWeight: 700,
                '&:hover': { bgcolor: T.tealBg },
              }}
            >
              Add
            </Button>
          </Stack>

          {customFields.length === 0 ? (
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: '0.82rem',
                opacity: 0.85,
              }}
            >
              No custom fields added.
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {customFields.map((f, i) => (
                <EditCustomFieldRow
                  key={`${f.id ?? 'new'}-${i}`}
                  field={f}
                  index={i}
                  onChange={updateField}
                  onRemove={removeField}
                  T={T}
                  FIELD={FIELD}
                />
              ))}
            </Stack>
          )}
        </Box>
      </DialogContent>

      <ResponsiveDialogActions>
        <Button onClick={onClose} sx={{ color: T.textMuted, fontWeight: 700 }}>
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handleSubmit((d) => mutate(d))}
          disabled={isPending}
          startIcon={
            isPending ? <CircularProgress size={14} color="inherit" /> : null
          }
          sx={{
            bgcolor: T.teal,
            color: '#fff',
            fontWeight: 800,
            borderRadius: 2,
            '&:hover': { bgcolor: '#0f766e' },
          }}
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </ResponsiveDialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Delete Dialog
// ─────────────────────────────────────────────────────────────────────────────

const ConfirmDialog = ({ title, body, loading, onConfirm, onClose }) => {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          bgcolor: T.bg,
          border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
          borderRadius: fullScreen ? 0 : 3,
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: '#f87171',
          fontWeight: 800,
          px: { xs: 2, sm: 3 },
        }}
      >
        <ErrorOutline />
        {title}
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
        <Typography
          sx={{
            color: T.textMuted,
            fontSize: '0.9rem',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {body}
        </Typography>
      </DialogContent>

      <ResponsiveDialogActions>
        <Button onClick={onClose} sx={{ color: T.textMuted, fontWeight: 700 }}>
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          startIcon={
            loading ? <CircularProgress size={14} color="inherit" /> : null
          }
          sx={{
            bgcolor: '#ef4444',
            color: '#fff',
            fontWeight: 800,
            borderRadius: 2,
            '&:hover': { bgcolor: '#dc2626' },
          }}
        >
          {loading ? 'Deleting…' : 'Delete'}
        </Button>
      </ResponsiveDialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Credential Card
// ─────────────────────────────────────────────────────────────────────────────

const CredentialCard = memo(
  ({ cred, pmId, host, T, enqueueSnackbar, onEdit, onDelete }) => {
    const [copiedKey, setCopiedKey] = useState('');

    const copy = useCallback(
      async (text, key) => {
        if (!hasValue(text)) return;

        const res = await CommonServices.handleCopy(String(text));

        if (res.success) {
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(''), 1400);
        } else {
          enqueueSnackbar('Copy failed', { variant: 'error' });
        }
      },
      [enqueueSnackbar]
    );

    const visibleCustomFields = useMemo(() => {
      return (cred.customFields ?? []).filter(
        (f) => hasValue(f.fieldKey) && hasValue(f.fieldValue)
      );
    }, [cred.customFields]);

    const hasAnySecret =
      hasValue(cred.password) ||
      hasPinValue(cred.pin) ||
      visibleCustomFields.length > 0;

    return (
      <Box
        sx={{
          p: { xs: 1.35, sm: 1.6, md: 1.8 },
          borderRadius: 2.25,
          bgcolor: 'rgba(255,255,255,0.028)',
          border: `1px solid ${T.glassBorder}`,
          transition: 'border-color 0.2s, background-color 0.2s',
          minWidth: 0,
          '&:hover': {
            borderColor: 'rgba(13,148,136,0.34)',
            bgcolor: 'rgba(255,255,255,0.04)',
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
            alignItems: 'center',
            gap: { xs: 0.5, sm: 0.75 },
            mb: hasAnySecret ? 0.75 : 0,
            minWidth: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                color: T.textPrimary,
                fontWeight: 800,
                fontSize: {
                  xs: '0.88rem',
                  sm: '0.92rem',
                  md: '0.95rem',
                },
                lineHeight: 1.35,
                ...getTextClampSx(2),
              }}
              title={cred.username}
            >
              {cred.username || 'No username'}
            </Typography>
          </Box>

          <CopyBtn
            value={cred.username}
            label="username"
            copied={copiedKey === 'username'}
            onCopy={(v) => copy(v, 'username')}
            T={T}
          />

          <Tooltip title="Edit credential">
            <IconButton
              size="small"
              onClick={() => onEdit({ pmId, cred, host })}
              sx={iconButtonSx(T, T.teal)}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete credential">
            <IconButton
              size="small"
              onClick={() =>
                onDelete({
                  credId: cred.id,
                  label: cred.username || 'this credential',
                })
              }
              sx={iconButtonSx(T, '#f87171')}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {hasAnySecret && (
          <Stack
            spacing={0.25}
            sx={{
              minWidth: 0,
              mt: 0.35,
            }}
          >
            <SecretValueRow
              label="Password"
              value={cred.password}
              maskedText="••••••••••••"
              copied={copiedKey}
              copiedKey="password"
              onCopy={copy}
              T={T}
            />

            {hasPinValue(cred.pin) && (
              <SecretValueRow
                label="PIN"
                value={cred.pin}
                maskedText="••••"
                copied={copiedKey}
                copiedKey="pin"
                onCopy={copy}
                T={T}
              />
            )}

            {visibleCustomFields.map((f, index) => {
              const id = f.id ?? `${f.fieldKey}-${index}`;

              return (
                <SecretValueRow
                  key={id}
                  label={f.fieldKey || 'Custom'}
                  value={f.fieldValue}
                  maskedText="••••••"
                  copied={copiedKey}
                  copiedKey={`custom-${id}`}
                  onCopy={copy}
                  T={T}
                />
              );
            })}
          </Stack>
        )}

        {hasValue(cred.notes) && (
          <Box
            sx={{
              mt: 1.1,
              pt: 1,
              borderTop: `1px solid ${T.glassBorder}`,
            }}
          >
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: {
                  xs: '0.76rem',
                  sm: '0.8rem',
                },
                lineHeight: 1.5,
                fontStyle: 'italic',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {cred.notes}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }
);

CredentialCard.displayName = 'CredentialCard';

// ─────────────────────────────────────────────────────────────────────────────
// Host Card
// ─────────────────────────────────────────────────────────────────────────────

const HostCard = memo(
  ({ entry, T, enqueueSnackbar, onEdit, onDeleteCred, onDeleteHost }) => {
    const credentialCount = entry.credentials?.length ?? 0;

    return (
      <Box
        sx={{
          p: { xs: 1.5, sm: 2, md: 2.25 },
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 3,
          minWidth: 0,
          boxShadow: '0 18px 60px rgba(0,0,0,0.18)',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.25 },
            mb: 1.75,
            minWidth: 0,
          }}
        >
          <HostAvatar host={entry.host} size={38} />

          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                color: T.textPrimary,
                fontWeight: 900,
                fontSize: {
                  xs: '0.95rem',
                  sm: '1rem',
                  md: '1.05rem',
                },
                lineHeight: 1.25,
                ...getTextClampSx(2),
              }}
              title={entry.host}
            >
              {entry.host}
            </Typography>

            <Typography
              sx={{
                color: T.textMuted,
                fontSize: '0.76rem',
                mt: 0.2,
              }}
            >
              {credentialCount}{' '}
              {credentialCount === 1 ? 'credential' : 'credentials'}
            </Typography>
          </Box>

          <Chip
            size="small"
            label={credentialCount}
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              height: 24,
              bgcolor: T.tealBg,
              color: T.teal,
              fontWeight: 800,
              border: `1px solid ${T.tealBg}`,
            }}
          />

          <Tooltip title="Delete all credentials for this site">
            <IconButton
              size="small"
              onClick={() =>
                onDeleteHost({
                  pmId: entry.id,
                  host: entry.host,
                })
              }
              sx={iconButtonSx(T, '#f87171')}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Stack spacing={1.25}>
          {entry.credentials?.map((cred) => (
            <CredentialCard
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
        </Stack>
      </Box>
    );
  }
);

HostCard.displayName = 'HostCard';

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const VaultSkeleton = ({ T }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        lg: 'repeat(2, minmax(0, 1fr))',
      },
      gap: 2,
    }}
  >
    {[1, 2, 3, 4].map((i) => (
      <Box
        key={i}
        sx={{
          p: 2.5,
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Skeleton
            variant="circular"
            width={38}
            height={38}
            sx={{ bgcolor: T.glassBorder }}
          />

          <Box sx={{ flex: 1 }}>
            <Skeleton
              variant="text"
              width="55%"
              sx={{ bgcolor: T.glassBorder }}
            />
            <Skeleton
              variant="text"
              width="30%"
              sx={{ bgcolor: T.glassBorder }}
            />
          </Box>
        </Box>

        <Skeleton
          variant="rounded"
          height={92}
          sx={{ bgcolor: T.glassBorder, borderRadius: 2 }}
        />
      </Box>
    ))}
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const ViewPassword = () => {
  usePageMeta('Vault');

  const T = useT();
  const GLOW = getGlowProps(T);
  const FIELD = getFieldSx(T);

  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteCredTarget, setDelCred] = useState(null);
  const [deleteHostTarget, setDelHost] = useState(null);

  const {
    data: vault = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['pm-vault'],
    queryFn: async () => {
      const res = await getCredential();
      return res.data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return vault;

    return vault.filter((entry) => {
      const host = entry.host?.toLowerCase() ?? '';
      const matchHost = host.includes(q);

      const matchCredential = entry.credentials?.some((c) => {
        const username = c.username?.toLowerCase() ?? '';
        const notes = c.notes?.toLowerCase() ?? '';

        const matchCustom = c.customFields?.some((f) => {
          const key = f.fieldKey?.toLowerCase() ?? '';
          return key.includes(q);
        });

        return username.includes(q) || notes.includes(q) || matchCustom;
      });

      return matchHost || matchCredential;
    });
  }, [vault, search]);

  const totalCreds = useMemo(
    () => vault.reduce((s, e) => s + (e.credentials?.length ?? 0), 0),
    [vault]
  );

  const { mutate: deleteCred, isPending: deletingCred } = useMutation({
    mutationFn: (credId) => deleteCredentialByCredentialId(credId),
    onSuccess: () => {
      enqueueSnackbar('Credential deleted', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      setDelCred(null);
    },
    onError: () => {
      enqueueSnackbar('Failed to delete credential', { variant: 'error' });
    },
  });

  const { mutate: deleteHost, isPending: deletingHost } = useMutation({
    mutationFn: (pmId) => deleteHostById(pmId),
    onSuccess: () => {
      enqueueSnackbar('Entry deleted', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      queryClient.invalidateQueries({ queryKey: ['pm-hosts'] });
      setDelHost(null);
    },
    onError: () => {
      enqueueSnackbar('Failed to delete entry', { variant: 'error' });
    },
  });

  return (
    <Box
      sx={{
        bgcolor: T.bg,
        minHeight: '100vh',
        color: T.textPrimary,
        pt: { xs: '56px', md: '64px' },
        overflowX: 'hidden',
      }}
    >
      <motion.div {...GLOW} />

      <Container
        maxWidth={false}
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: {
            xs: '100%',
            sm: 760,
            md: 980,
            lg: 1240,
            xl: 1480,
          },
          px: {
            xs: 1.5,
            sm: 2.5,
            md: 3,
          },
          py: {
            xs: 2.5,
            sm: 3.5,
            md: 5,
          },
        }}
      >
        {/* Top bar */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'auto 1fr auto',
            },
            alignItems: {
              xs: 'stretch',
              sm: 'center',
            },
            gap: {
              xs: 1.25,
              sm: 2,
            },
            mb: {
              xs: 2.5,
              md: 3,
            },
          }}
        >
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
            sx={{
              justifyContent: { xs: 'flex-start', sm: 'center' },
              color: T.textMuted,
              fontWeight: 700,
              px: 0,
              minWidth: 0,
              '&:hover': {
                color: T.teal,
                bgcolor: 'transparent',
              },
            }}
          >
            Password Manager
          </Button>

          <Box />

          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => navigate(Constants.DB_ADD_PASSWORD_ROUTE)}
            sx={actionButtonSx(T)}
          >
            Add Credential
          </Button>
        </Box>

        {/* Header */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 1.4,
            mb: 2.5,
          }}
        >
          <Box
            sx={{
              width: { xs: 40, sm: 44 },
              height: { xs: 40, sm: 44 },
              borderRadius: 2,
              bgcolor: T.tealBg,
              border: `1px solid ${T.tealBg}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Lock sx={{ fontSize: 21, color: T.teal }} />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: {
                  xs: '1.18rem',
                  sm: '1.35rem',
                  md: '1.55rem',
                },
                lineHeight: 1.15,
                fontWeight: 900,
                color: T.textPrimary,
                ...getTextClampSx(2),
              }}
            >
              Your Vault
            </Typography>

            {!isLoading && (
              <Typography
                sx={{
                  mt: 0.35,
                  fontSize: {
                    xs: '0.78rem',
                    sm: '0.84rem',
                  },
                  color: T.textMuted,
                }}
              >
                {vault.length} {vault.length === 1 ? 'site' : 'sites'} ·{' '}
                {totalCreds} {totalCreds === 1 ? 'credential' : 'credentials'}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Search */}
        {!isLoading && vault.length > 0 && (
          <TextField
            fullWidth
            size="small"
            placeholder="Search by site, username, notes or custom field…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: T.textMuted, fontSize: 19 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 3,
              ...FIELD,
              '& input': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <VaultSkeleton T={T} />
        ) : isError ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <ErrorOutline sx={{ fontSize: 48, color: '#f87171', mb: 2 }} />

            <Typography sx={{ color: T.textMuted, mb: 2 }}>
              Failed to load vault
            </Typography>

            <Button onClick={refetch} sx={{ color: T.teal, fontWeight: 800 }}>
              Retry
            </Button>
          </Box>
        ) : vault.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: { xs: 6, sm: 8 },
              px: 2,
              bgcolor: T.glass,
              border: `1px solid ${T.glassBorder}`,
              borderRadius: 3,
            }}
          >
            <Lock sx={{ fontSize: 48, color: T.teal, opacity: 0.42, mb: 2 }} />

            <Typography
              sx={{
                fontWeight: 900,
                color: T.textPrimary,
                mb: 1,
                fontSize: '1.05rem',
              }}
            >
              Vault is empty
            </Typography>

            <Typography
              sx={{
                color: T.textMuted,
                fontSize: '0.875rem',
                mb: 3,
              }}
            >
              No credentials saved yet.
            </Typography>

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate(Constants.DB_ADD_PASSWORD_ROUTE)}
              sx={{
                bgcolor: T.teal,
                color: '#fff',
                fontWeight: 800,
                borderRadius: 2,
                '&:hover': { bgcolor: '#0f766e' },
              }}
            >
              Save Your First Credential
            </Button>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
            <Search sx={{ fontSize: 40, color: T.textMuted, mb: 1.5 }} />

            <Typography
              sx={{
                color: T.textMuted,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              No results for “{search}”
            </Typography>
          </Box>
        ) : (
          <AnimatePresence>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
                gap: {
                  xs: 1.5,
                  sm: 2,
                  xl: 2.25,
                },
                alignItems: 'start',
              }}
            >
              {filtered.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{
                    duration: 0.26,
                    delay: Math.min(i * 0.035, 0.18),
                  }}
                  style={{ minWidth: 0 }}
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

      {editTarget && (
        <EditDialog target={editTarget} onClose={() => setEditTarget(null)} />
      )}

      {deleteCredTarget && (
        <ConfirmDialog
          title="Delete Credential"
          body={`Remove "${deleteCredTarget.label}" from your vault? This cannot be undone.`}
          loading={deletingCred}
          onConfirm={() => deleteCred(deleteCredTarget.credId)}
          onClose={() => setDelCred(null)}
        />
      )}

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
