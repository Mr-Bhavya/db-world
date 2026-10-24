import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notify } from '@shared/notify';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Box, Button, Chip, CircularProgress, Collapse, Container, IconButton,
  InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {
  SaveRounded, LockRounded, Visibility, VisibilityOff, AutoAwesomeRounded,
  ContentCopyRounded, AddRounded, DeleteOutlineRounded, CheckRounded,
  ExpandMoreRounded, DnsRounded, StickyNote2Rounded, WarningAmberRounded,
} from '@mui/icons-material';
import { useT, getFieldSx } from '@shared/theme';
import usePageMeta from '@shared/hooks/usePageMeta';
import { addCredential, getCredential, searchBrands } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import BrandLogo from '@shared/brand/BrandLogo';
import { generatePassword } from './passwordUtils';
import { VaultAurora, StrengthMeter, BackLink, GlassPanel, useScrollTop } from './vaultShared';
import { withScheme, isValidUrl, siteKey, looksLikeSite, pickSite, findDuplicate } from './entryUtils';

// A site is optional: a server, an app or a note has none. When one is typed it must be usable.
const schema = z.object({
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
  if (!v.name.trim() && !v.url) {
    ctx.addIssue({ code: 'custom', path: ['name'], message: 'Give it a name' });
  }
  if (v.type !== 'NOTE' && !v.username.trim()) {
    ctx.addIssue({ code: 'custom', path: ['username'], message: 'Username / email is required' });
  }
});

const TYPES = [
  { value: 'LOGIN',  label: 'Login',  icon: LockRounded },
  { value: 'SERVER', label: 'Server', icon: DnsRounded },
  { value: 'NOTE',   label: 'Note',   icon: StickyNote2Rounded },
];

const COPY = {
  LOGIN:  { name: 'e.g. Netflix',       username: 'Username / Email', site: 'Website (optional)' },
  SERVER: { name: 'e.g. db-world SSH',  username: 'Server user',      site: 'Address (optional)' },
  NOTE:   { name: 'e.g. Wi-Fi, locker', username: 'Username',         site: 'Website (optional)' },
};

const DEFAULTS = { name: '', type: 'LOGIN', url: '', username: '', password: '', pin: '', notes: '' };

const AddPassword = () => {
  usePageMeta('New Entry');
  useScrollTop();

  const T = useT();
  const FIELD = getFieldSx(T);
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin]           = useState(false);
  const [genCopied, setGenCopied]       = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [showMore, setShowMore]         = useState(false);

  const { control, handleSubmit, setValue, watch, reset, setFocus, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const [name, type, url, username, pwValue] = watch(['name', 'type', 'url', 'username', 'password']);
  const copy = COPY[type] ?? COPY.LOGIN;

  // ── Site from the name ─────────────────────────────────────────────────────
  // Typing "Netflix" or "net flix" fills in netflix.com. It never overwrites a site the person
  // typed (urlTouched), and a loose match is only offered as a chip, not applied.
  const [urlTouched, setUrlTouched] = useState(false);
  const [autoSite, setAutoSite]     = useState(null); // { domain, name } currently applied by us
  const [suggestion, setSuggestion] = useState(null);
  const [detecting, setDetecting]   = useState(false);
  const seq = useRef(0);

  const applyAuto = useCallback((site) => {
    setAutoSite(site);
    setValue('url', site ? `https://${site.domain}` : '', { shouldValidate: false });
  }, [setValue]);

  useEffect(() => {
    if (urlTouched || type === 'NOTE') return undefined;
    const typed = (name ?? '').trim().replace(/\s+/g, ' ');
    const mine = ++seq.current;

    if (typed.length < 2) { applyAuto(null); setSuggestion(null); setDetecting(false); return undefined; }

    if (looksLikeSite(typed)) { // already an address: no lookup needed
      setSuggestion(null); setDetecting(false);
      applyAuto({ domain: siteKey(typed), name: typed });
      return undefined;
    }

    setDetecting(true);
    const timer = setTimeout(async () => {
      const res = await searchBrands(typed);
      if (mine !== seq.current) return; // a newer keystroke owns the answer now
      const { auto, suggest } = pickSite(typed, res?.data);
      setDetecting(false);
      setSuggestion(suggest);
      applyAuto(auto ? { domain: auto.domain, name: auto.name || auto.domain } : null);
    }, 420);
    return () => clearTimeout(timer);
  }, [name, type, urlTouched, applyAuto]);

  const dropSite = () => { setUrlTouched(true); applyAuto(null); setSuggestion(null); };
  const takeSuggestion = () => {
    applyAuto({ domain: suggestion.domain, name: suggestion.name || suggestion.domain });
    setSuggestion(null);
  };

  // ── Duplicate check against the vault the person already has ───────────────
  const { data: vault } = useQuery({
    queryKey: ['pm-vault'],
    queryFn: async () => (await getCredential()).data ?? [],
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const duplicate = useMemo(
    () => ((username.trim() || type === 'NOTE') ? findDuplicate(vault, { url, name, username }) : null),
    [vault, url, name, username, type],
  );

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => addCredential(data),
    onSuccess: () => {
      notify.success('Saved securely');
      queryClient.invalidateQueries({ queryKey: ['pm-vault'] });
      queryClient.invalidateQueries({ queryKey: ['pm-hosts'] });
      reset(DEFAULTS);
      setCustomFields([]);
      setUrlTouched(false);
      setAutoSite(null);
      setSuggestion(null);
      setTimeout(() => setFocus('name'), 0);
    },
    onError: (err) => notify.error(err?.response?.data?.message ?? 'Failed to save'),
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

  const addCustomField    = () => { setShowMore(true); setCustomFields((p) => [...p, { fieldKey: '', fieldValue: '', showValue: false }]); };
  const removeCustomField = (i) => setCustomFields((p) => p.filter((_, idx) => idx !== i));
  const updateCustomField = (i, k, v) => setCustomFields((p) => p.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));
  const toggleCustomVis   = (i) => setCustomFields((p) => p.map((f, idx) => (idx === i ? { ...f, showValue: !f.showValue } : f)));

  const onSubmit = (data) => {
    const validCustomFields = customFields
      .filter((f) => f.fieldKey.trim())
      .map(({ fieldKey, fieldValue }) => ({ fieldKey: fieldKey.trim(), fieldValue }));
    save({
      ...data,
      name: data.name.trim(),
      url: data.url ? withScheme(data.url) : '',
      customFields: validCustomFields,
    });
  };

  // If the problem is inside "More options", open it so the message is visible.
  const onInvalid = (errs) => { if (errs.url) setShowMore(true); };

  const siteDomain = siteKey(url);

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
                  New entry
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>Encrypted with AES-256</Typography>
              </Box>
            </Box>

            <Box component="form" noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Name: the only thing a quick entry needs besides the secret */}
              <Box>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      autoFocus
                      fullWidth
                      label="Name"
                      placeholder={copy.name}
                      autoComplete="off"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            {detecting
                              ? <CircularProgress size={16} sx={{ color: T.teal }} />
                              : siteDomain
                                ? <BrandLogo logoDomain={siteDomain} companyName={name} size={26} radius={1.5} />
                                : null}
                          </InputAdornment>
                        ),
                      }}
                      sx={FIELD}
                    />
                  )}
                />
                {/* What we found for that name, in plain sight and one click to undo */}
                <AnimatePresence initial={false}>
                  {(autoSite || suggestion) && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <Box sx={{ pt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {autoSite ? (
                          <Chip
                            size="small"
                            icon={<CheckRounded sx={{ fontSize: 15, color: `${T.teal} !important` }} />}
                            label={`${autoSite.domain} · site found`}
                            onDelete={dropSite}
                            sx={{ color: T.textPrimary, bgcolor: T.tealBg, border: `1px solid ${T.teal}44`, fontWeight: 700, '& .MuiChip-deleteIcon': { color: T.textMuted } }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            clickable
                            onClick={takeSuggestion}
                            label={`Use ${suggestion.domain}?`}
                            variant="outlined"
                            sx={{ color: T.teal, borderColor: `${T.teal}66`, fontWeight: 700 }}
                          />
                        )}
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>

              {type !== 'NOTE' && (
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label={copy.username} autoComplete="off" error={!!errors.username} helperText={errors.username?.message} sx={FIELD} />
                  )}
                />
              )}

              {/* Password: optional, with a warning rather than an error when it is empty */}
              <Box>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Password"
                      autoComplete="new-password"
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
                {!pwValue && type !== 'NOTE' && (
                  <Typography sx={{ mt: 0.75, ml: 0.25, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.74rem', fontWeight: 600, color: '#f59e0b' }}>
                    <WarningAmberRounded sx={{ fontSize: 15 }} /> No password yet: this will be saved without one.
                  </Typography>
                )}
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

              {duplicate && (
                <Typography role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.8rem', fontWeight: 700, color: '#f87171' }}>
                  <WarningAmberRounded sx={{ fontSize: 17 }} />
                  You already have this entry{duplicate.pm?.host ? ` (${duplicate.pm.host})` : ''}. Change the name or username to add another.
                </Typography>
              )}

              {/* Everything else, one tap away */}
              <Button
                onClick={() => setShowMore((v) => !v)}
                endIcon={<ExpandMoreRounded sx={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
                aria-expanded={showMore}
                sx={{ alignSelf: 'flex-start', color: T.textMuted, fontWeight: 700, fontSize: '0.8rem', px: 0.5, minHeight: 36, '&:hover': { bgcolor: 'transparent', color: T.teal } }}
              >
                {showMore ? 'Fewer options' : 'More options'}
              </Button>

              <Collapse in={showMore} timeout={reduce ? 0 : 'auto'}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 0.5 }}>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <ToggleButtonGroup
                        exclusive
                        fullWidth
                        size="small"
                        value={field.value}
                        onChange={(_, v) => { if (v) field.onChange(v); }}
                        aria-label="Entry type"
                        sx={{ '& .MuiToggleButton-root': { color: T.textMuted, borderColor: T.glassBorder, fontWeight: 700, gap: 0.75, textTransform: 'none', '&.Mui-selected': { color: T.teal, bgcolor: T.tealBg, borderColor: `${T.teal}66` } } }}
                      >
                        {TYPES.map(({ value, label, icon: Icon }) => (
                          <ToggleButton key={value} value={value}><Icon sx={{ fontSize: 17 }} />{label}</ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    )}
                  />

                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={copy.site}
                        placeholder="example.com"
                        autoComplete="off"
                        error={!!errors.url}
                        helperText={errors.url?.message}
                        onChange={(e) => { setUrlTouched(true); setAutoSite(null); setSuggestion(null); field.onChange(e); }}
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
                      <TextField {...field} label="Notes (optional)" multiline minRows={3} maxRows={12} placeholder="Security questions, recovery info, a private key…" sx={FIELD} />
                    )}
                  />

                  {customFields.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Custom Fields
                      </Typography>
                      {customFields.map((field, index) => (
                        <Box
                          key={index}
                          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(110px, 0.42fr) 1fr auto' }, gap: 1, alignItems: 'flex-start' }}
                        >
                          <TextField size="small" label="Label" placeholder="e.g. mPIN" value={field.fieldKey} onChange={(e) => updateCustomField(index, 'fieldKey', e.target.value)} sx={FIELD} />
                          <TextField
                            size="small"
                            label="Value"
                            // multiline so a pasted key keeps its line breaks; masked with CSS, as type=password is single-line
                            multiline
                            minRows={1}
                            maxRows={8}
                            slotProps={{ htmlInput: { style: field.showValue ? undefined : { WebkitTextSecurity: 'disc' } } }}
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
                  )}

                  <Button
                    size="small"
                    startIcon={<AddRounded />}
                    onClick={addCustomField}
                    sx={{ alignSelf: 'flex-start', minHeight: 40, color: T.teal, border: `1px dashed ${T.teal}`, borderRadius: 2, px: 1.5, fontSize: '0.8rem', fontWeight: 700, '&:hover': { bgcolor: T.tealBg } }}
                  >
                    Add Custom Field
                  </Button>
                </Box>
              </Collapse>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isPending || !!duplicate}
                startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
                sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, py: 1.4, borderRadius: 2.5, mt: 0.5, minHeight: 48, boxShadow: `0 10px 30px ${T.tealGlow}`, '&:hover': { bgcolor: '#0f766e' }, '&.Mui-disabled': { opacity: 0.6 } }}
              >
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          </GlassPanel>
        </motion.div>
      </Container>
    </Box>
  );
};

export default AddPassword;
