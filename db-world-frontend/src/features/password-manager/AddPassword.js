import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notify } from '@shared/notify';
import { motion } from 'framer-motion';
import {
  Box, Button, CircularProgress, Container, Divider,
  IconButton, InputAdornment, TextField, Tooltip, Typography,
  Autocomplete,
} from '@mui/material';
import {
  ArrowBack, Save, Lock, Visibility, VisibilityOff,
  VpnKey, ContentCopy, Add, Delete,
} from '@mui/icons-material';
import { useT, getGlowProps, getFieldSx } from '@shared/theme';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { addCredential, findAllHost } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';

const schema = z.object({
  url: z.string().min(1, 'URL is required').url('Must be a valid URL (include https://)'),
  username: z.string().min(1, 'Username / email is required'),
  password: z.string().optional().default(''),
  pin: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const AddPassword = () => {
  usePageMeta('Save Credential');

  const T = useT();
  const GLOW = getGlowProps(T);
  const FIELD = getFieldSx(T);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin]           = useState(false);
  const [genCopied, setGenCopied]       = useState(false);
  const [customFields, setCustomFields] = useState([]);  // [{fieldKey, fieldValue, showValue}]

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { url: '', username: '', password: '', pin: '', notes: '' },
  });

  const { data: hosts = [] } = useQuery({
    queryKey: ['pm-hosts'],
    queryFn: async () => {
      const res = await findAllHost();
      return res.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => addCredential(data),
    onSuccess: () => {
      notify.success('Credential saved successfully');
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      queryClient.invalidateQueries({ queryKey: ['pm-hosts'] });
      reset();
      setCustomFields([]);
    },
    onError: (err) => {
      const msg = err?.response?.data?.message ?? 'Failed to save credential';
      notify.error(msg);
    },
  });

  const handleGenerateAndFill = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+';
    const all = upper + lower + digits + symbols;
    const rand = (cs) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return cs[a[0] % cs.length]; };
    const pwd = [rand(upper), rand(lower), rand(digits), rand(symbols)];
    for (let i = 4; i < 16; i++) pwd.push(rand(all));
    for (let i = pwd.length - 1; i > 0; i--) {
      const a = new Uint32Array(1); crypto.getRandomValues(a);
      const j = a[0] % (i + 1); [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }
    setValue('password', pwd.join(''), { shouldValidate: true });
    setShowPassword(true);
  };

  const handleCopyGenerated = async () => {
    const pw = watch('password');
    if (!pw) return;
    const res = await CommonServices.handleCopy(pw);
    if (res.success) { setGenCopied(true); setTimeout(() => setGenCopied(false), 1500); }
    else notify.error('Copy failed');
  };

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { fieldKey: '', fieldValue: '', showValue: false }]);
  };

  const removeCustomField = (index) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomField = (index, key, value) => {
    setCustomFields((prev) => prev.map((f, i) => i === index ? { ...f, [key]: value } : f));
  };

  const toggleCustomFieldVisibility = (index) => {
    setCustomFields((prev) => prev.map((f, i) => i === index ? { ...f, showValue: !f.showValue } : f));
  };

  const onSubmit = (data) => {
    const validCustomFields = customFields
      .filter((f) => f.fieldKey.trim())
      .map(({ fieldKey, fieldValue }) => ({ fieldKey: fieldKey.trim(), fieldValue }));
    save({ ...data, customFields: validCustomFields });
  };

  const hostOptions = hosts.map((h) => `https://${h}`);

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' } }}>
      <motion.div {...GLOW} />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 6 } }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <Box sx={{ mb: 3 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
              sx={{ color: T.textMuted, fontWeight: 500, '&:hover': { color: T.teal, bgcolor: 'transparent' } }}
            >
              Password Manager
            </Button>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 1.5,
                bgcolor: T.tealBg, border: `1px solid ${T.tealBg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock sx={{ fontSize: 20, color: T.teal }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: T.textPrimary }}>
                  Save Credential
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                  Stored with AES-256 encryption
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: T.glassBorder, mb: 3 }} />

            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
            >
              {/* URL with autocomplete from known hosts */}
              <Controller
                name="url"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    options={hostOptions}
                    value={field.value}
                    onInputChange={(_, v) => field.onChange(v)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Website URL"
                        placeholder="https://example.com"
                        error={!!errors.url}
                        helperText={errors.url?.message}
                        sx={FIELD}
                      />
                    )}
                  />
                )}
              />

              {/* Username */}
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Username / Email"
                    error={!!errors.username}
                    helperText={errors.username?.message}
                    sx={FIELD}
                  />
                )}
              />

              {/* Password with generate shortcut */}
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end" sx={{ gap: 0.5 }}>
                          <Tooltip title="Generate secure password">
                            <IconButton onClick={handleGenerateAndFill} size="small" sx={{ color: T.teal }}>
                              <VpnKey fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {field.value && (
                            <Tooltip title={genCopied ? 'Copied!' : 'Copy password'}>
                              <IconButton onClick={handleCopyGenerated} size="small" sx={{ color: genCopied ? '#10b981' : T.textMuted }}>
                                <ContentCopy fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <IconButton onClick={() => setShowPassword(!showPassword)} size="small" sx={{ color: T.teal }}>
                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={FIELD}
                  />
                )}
              />

              {/* PIN */}
              <Controller
                name="pin"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="PIN (optional)"
                    type={showPin ? 'text' : 'password'}
                    inputProps={{ inputMode: 'numeric' }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPin(!showPin)} size="small" sx={{ color: T.teal }}>
                            {showPin ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={FIELD}
                  />
                )}
              />

              {/* Notes */}
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Notes (optional)"
                    multiline
                    rows={3}
                    placeholder="Security questions, recovery info…"
                    sx={FIELD}
                  />
                )}
              />

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Custom Fields
                  </Typography>
                  {customFields.map((field, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <TextField
                        size="small"
                        label="Label"
                        placeholder="e.g. mPIN, Security Answer"
                        value={field.fieldKey}
                        onChange={(e) => updateCustomField(index, 'fieldKey', e.target.value)}
                        sx={{ ...FIELD, flex: '0 0 38%' }}
                      />
                      <TextField
                        size="small"
                        label="Value"
                        type={field.showValue ? 'text' : 'password'}
                        value={field.fieldValue}
                        onChange={(e) => updateCustomField(index, 'fieldValue', e.target.value)}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton size="small" onClick={() => toggleCustomFieldVisibility(index)} sx={{ color: T.teal }}>
                                {field.showValue ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{ ...FIELD, flex: 1 }}
                      />
                      <Tooltip title="Remove field">
                        <IconButton size="small" onClick={() => removeCustomField(index)}
                          sx={{ color: T.textMuted, '&:hover': { color: '#f87171' }, mt: 0.5 }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Add custom field button */}
              <Button
                size="small"
                startIcon={<Add />}
                onClick={addCustomField}
                sx={{
                  alignSelf: 'flex-start',
                  color: T.teal,
                  border: `1px dashed ${T.teal}`,
                  borderRadius: 2,
                  px: 1.5,
                  fontSize: '0.8rem',
                  '&:hover': { bgcolor: T.tealBg },
                }}
              >
                Add Custom Field
              </Button>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isPending}
                startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <Save />}
                sx={{
                  bgcolor: T.teal, color: '#fff', fontWeight: 700,
                  py: 1.25, borderRadius: 2, mt: 0.5,
                  '&:hover': { bgcolor: '#0f766e' },
                  '&.Mui-disabled': { opacity: 0.6 },
                }}
              >
                {isPending ? 'Saving…' : 'Save Credential'}
              </Button>
            </Box>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default AddPassword;
