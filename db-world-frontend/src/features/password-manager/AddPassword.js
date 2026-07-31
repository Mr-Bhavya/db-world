import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notify } from '@shared/notify';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Box, Button, CircularProgress, Container, IconButton,
  InputAdornment, TextField, Tooltip, Typography, Autocomplete,
} from '@mui/material';
import {
  SaveRounded, LockRounded, Visibility, VisibilityOff, AutoAwesomeRounded,
  ContentCopyRounded, AddRounded, DeleteOutlineRounded, CheckRounded,
} from '@mui/icons-material';
import { useT, getFieldSx } from '@shared/theme';
import usePageMeta from '@shared/hooks/usePageMeta';
import { addCredential, findAllHost, searchBrands } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import BrandLogo from '@shared/brand/BrandLogo';
import { generatePassword } from './passwordUtils';
import { VaultAurora, StrengthMeter, BackLink, GlassPanel, useScrollTop } from './vaultShared';

const schema = z.object({
  url: z.string().min(1, 'URL is required').url('Must be a valid URL (include https://)'),
  username: z.string().min(1, 'Username / email is required'),
  password: z.string().optional().default(''),
  pin: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const AddPassword = () => {
  usePageMeta('Save Credential');
  useScrollTop();

  const T = useT();
  const FIELD = getFieldSx(T);
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin]           = useState(false);
  const [genCopied, setGenCopied]       = useState(false);
  const [customFields, setCustomFields] = useState([]);

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { url: '', username: '', password: '', pin: '', notes: '' },
  });

  const pwValue = watch('password');

  const { data: hosts = [] } = useQuery({
    queryKey: ['pm-hosts'],
    queryFn: async () => (await findAllHost()).data ?? [],
    staleTime: 5 * 60 * 1000,
  });

  // ── Site/app search: your saved hosts + public logo.dev suggestions ──────────
  const [siteOptions, setSiteOptions] = useState([]);
  const [siteLoading, setSiteLoading] = useState(false);
  const searchTimer = useRef();

  const savedOptions = useMemo(
    () => hosts.map((h) => ({ name: h, domain: h, url: `https://${h}`, saved: true })),
    [hosts]
  );

  // Seed the dropdown with saved hosts so an empty/short query still suggests.
  useEffect(() => { setSiteOptions(savedOptions.slice(0, 6)); }, [savedOptions]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const runSiteSearch = useCallback((raw) => {
    clearTimeout(searchTimer.current);
    const q = (raw || '').trim();
    const ql = q.toLowerCase();
    const saved = savedOptions.filter((o) => o.domain.toLowerCase().includes(ql)).slice(0, 5);
    if (q.length < 2) { setSiteLoading(false); setSiteOptions(saved); return; }
    // Prefer our own saved sites — only spend a (quota-limited) logo.dev search
    // when the vault has no local match for what the user typed.
    if (saved.length > 0) { setSiteLoading(false); setSiteOptions(saved); return; }
    setSiteLoading(true);
    searchTimer.current = setTimeout(async () => {
      const res = await searchBrands(q);
      const seen = new Set(saved.map((s) => s.domain.toLowerCase()));
      const brands = (res?.data ?? [])
        .filter((b) => b.domain && !seen.has(b.domain.toLowerCase()))
        .map((b) => ({ name: b.name || b.domain, domain: b.domain, url: `https://${b.domain}`, logoUrl: b.logoUrl }));
      setSiteOptions([...saved, ...brands]);
      setSiteLoading(false);
    }, 320);
  }, [savedOptions]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => addCredential(data),
    onSuccess: () => {
      notify.success('Credential saved securely');
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      queryClient.invalidateQueries({ queryKey: ['pm-hosts'] });
      reset();
      setCustomFields([]);
    },
    onError: (err) => notify.error(err?.response?.data?.message ?? 'Failed to save credential'),
  });

  const handleGenerate = () => {
    setValue('password', generatePassword({ length: 18 }), { shouldValidate: true });
    setShowPassword(true);
  };

  const handleCopyGenerated = async () => {
    if (!pwValue) return;
    const res = await CommonServices.handleCopy(pwValue);
    if (res.success) { setGenCopied(true); setTimeout(() => setGenCopied(false), 1500); }
    else notify.error('Copy failed');
  };

  const addCustomField    = () => setCustomFields((p) => [...p, { fieldKey: '', fieldValue: '', showValue: false }]);
  const removeCustomField = (i) => setCustomFields((p) => p.filter((_, idx) => idx !== i));
  const updateCustomField = (i, k, v) => setCustomFields((p) => p.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));
  const toggleCustomVis   = (i) => setCustomFields((p) => p.map((f, idx) => (idx === i ? { ...f, showValue: !f.showValue } : f)));

  const onSubmit = (data) => {
    const validCustomFields = customFields
      .filter((f) => f.fieldKey.trim())
      .map(({ fieldKey, fieldValue }) => ({ fieldKey: fieldKey.trim(), fieldValue }));
    save({ ...data, customFields: validCustomFields });
  };

  return (
    <Box sx={{ position: 'relative', bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' }, overflowX: 'hidden' }}>
      <VaultAurora />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ mb: 2 }}><BackLink /></Box>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel sx={{ p: { xs: 2.25, sm: 3.25 } }}>
            {/* Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{ width: 46, height: 46, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: T.tealBg, border: `1px solid ${T.teal}44` }}>
                <LockRounded sx={{ fontSize: 22, color: T.teal }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 'clamp(1.15rem, 4.5vw, 1.4rem)', fontWeight: 900, color: T.textPrimary, lineHeight: 1.1 }}>
                  Save Credential
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>Encrypted with AES-256</Typography>
              </Box>
            </Box>

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <Controller
                name="url"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    autoHighlight
                    options={siteOptions}
                    filterOptions={(x) => x}
                    inputValue={field.value}
                    loading={siteLoading}
                    onInputChange={(_, v, reason) => {
                      field.onChange(v);
                      if (reason === 'input') runSiteSearch(v);
                    }}
                    onChange={(_, val) => {
                      if (val && typeof val === 'object') field.onChange(val.url);
                      else if (typeof val === 'string') field.onChange(val);
                    }}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.url)}
                    renderOption={(props, option) => {
                      const { key, ...rest } = props;
                      return (
                        <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.25, alignItems: 'center', py: 1 }}>
                          <BrandLogo logoDomain={option.domain} companyName={option.name} size={26} radius={1.5} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {option.name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: T.textMuted }}>
                              {option.domain}{option.saved ? ' · saved' : ''}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }}
                    slotProps={{ paper: { sx: { bgcolor: T.bg, backgroundImage: 'none', border: `1px solid ${T.glassBorder}`, color: T.textPrimary, boxShadow: `0 20px 60px ${T.tealGlow}` } } }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Website / App"
                        placeholder="Search a site or paste a URL…"
                        error={!!errors.url}
                        helperText={errors.url?.message}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {siteLoading ? <CircularProgress size={16} sx={{ color: T.teal }} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                        sx={FIELD}
                      />
                    )}
                  />
                )}
              />

              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Username / Email" error={!!errors.username} helperText={errors.username?.message} sx={FIELD} />
                )}
              />

              {/* Password + inline generate + live strength */}
              <Box>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end" sx={{ gap: 0.25 }}>
                            <Tooltip title="Generate strong password">
                              <IconButton onClick={handleGenerate} size="small" sx={{ color: T.teal }} aria-label="Generate password">
                                <AutoAwesomeRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {field.value && (
                              <Tooltip title={genCopied ? 'Copied!' : 'Copy'}>
                                <IconButton onClick={handleCopyGenerated} size="small" sx={{ color: genCopied ? '#22c55e' : T.textMuted }} aria-label="Copy password">
                                  {genCopied ? <CheckRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            )}
                            <IconButton onClick={() => setShowPassword((v) => !v)} size="small" sx={{ color: T.teal }} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                              {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={FIELD}
                    />
                  )}
                />
                <AnimatePresence>
                  {pwValue && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <Box sx={{ pt: 1.25, px: 0.25 }}>
                        <StrengthMeter password={pwValue} />
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>

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
                          <IconButton onClick={() => setShowPin((v) => !v)} size="small" sx={{ color: T.teal }} aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
                            {showPin ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
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
                  <TextField {...field} label="Notes (optional)" multiline rows={3} placeholder="Security questions, recovery info…" sx={FIELD} />
                )}
              />

              {/* Custom fields */}
              <AnimatePresence initial={false}>
                {customFields.length > 0 && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Custom Fields
                      </Typography>
                      {customFields.map((field, index) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'minmax(110px, 0.42fr) 1fr auto' },
                            gap: 1,
                            alignItems: 'flex-start',
                          }}
                        >
                          <TextField size="small" label="Label" placeholder="e.g. mPIN" value={field.fieldKey} onChange={(e) => updateCustomField(index, 'fieldKey', e.target.value)} sx={FIELD} />
                          <TextField
                            size="small"
                            label="Value"
                            type={field.showValue ? 'text' : 'password'}
                            value={field.fieldValue}
                            onChange={(e) => updateCustomField(index, 'fieldValue', e.target.value)}
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton size="small" onClick={() => toggleCustomVis(index)} sx={{ color: T.teal }} aria-label="Toggle value visibility">
                                    {field.showValue ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            sx={FIELD}
                          />
                          <Tooltip title="Remove field">
                            <IconButton size="small" onClick={() => removeCustomField(index)} sx={{ color: T.textMuted, justifySelf: { xs: 'flex-end', sm: 'center' }, '&:hover': { color: '#f87171' }, mt: { xs: 0, sm: 0.5 } }} aria-label="Remove field">
                              <DeleteOutlineRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                size="small"
                startIcon={<AddRounded />}
                onClick={addCustomField}
                sx={{ alignSelf: 'flex-start', minHeight: 40, color: T.teal, border: `1px dashed ${T.teal}`, borderRadius: 2, px: 1.5, fontSize: '0.8rem', fontWeight: 700, '&:hover': { bgcolor: T.tealBg } }}
              >
                Add Custom Field
              </Button>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isPending}
                startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
                sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, py: 1.4, borderRadius: 2.5, mt: 0.5, minHeight: 48, boxShadow: `0 10px 30px ${T.tealGlow}`, '&:hover': { bgcolor: '#0f766e' }, '&.Mui-disabled': { opacity: 0.6 } }}
              >
                {isPending ? 'Saving…' : 'Save Credential'}
              </Button>
            </Box>
          </GlassPanel>
        </motion.div>
      </Container>
    </Box>
  );
};

export default AddPassword;
