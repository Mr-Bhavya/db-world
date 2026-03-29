import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import { addCredential, findAllHost } from '@shared/services/ApiServices';
import {
  Box, Button, CircularProgress, Container, Grid,
  IconButton, InputAdornment, TextField, Typography,
} from '@mui/material';
import {
  Visibility, VisibilityOff, ArrowBack, Lock,
  Public, Person, VpnKey, NoteAdd, Save,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from '@shared/components/ui/Toast';
import Autocomplete from '@mui/material/Autocomplete';

const T = {
  bg:          '#0a0a0f',
  teal:        '#0d9488',
  glass:       'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#f1f5f9',
  textMuted:   'rgba(241,245,249,0.55)',
};

const DARK_FIELD = {
  '& .MuiInputLabel-root': { color: T.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiOutlinedInput-root': {
    color: T.textPrimary,
    '& fieldset': { borderColor: T.glassBorder },
    '&:hover fieldset': { borderColor: 'rgba(13,148,136,0.45)' },
    '&.Mui-focused fieldset': { borderColor: T.teal },
  },
  '& .MuiInputBase-input': { color: T.textPrimary },
  '& .MuiFormHelperText-root': { fontSize: '0.72rem' },
};

const AddPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [hosts, setHosts] = useState([]);
  const [form, setForm] = useState({ url: '', username: '', password: '', pin: '', notes: '' });

  const onFieldChange = (e) => {
    const { id, value } = e.target;
    if (id === 'url') setIsValidUrl(CommonServices.isValidUrl(value));
    setForm(prev => ({ ...prev, [id]: value }));
  };

  const fetchHosts = async () => {
    const res = await findAllHost();
    if (res.httpStatusCode === 200) setHosts(res.data);
    else if (res.httpStatusCode === 401) navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
  };

  useEffect(() => { fetchHosts(); }, []);

  const validate = () => {
    if (!form.url || !form.username || !form.password) {
      toast.warning('Please fill all required fields.');
      return false;
    }
    if (!isValidUrl) {
      toast.warning('Please enter a valid URL.');
      return false;
    }
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await addCredential({ ...form, pin: form.pin || null });
      if (res.httpStatusCode === 201) {
        toast.success(res.message);
        setForm({ url: '', username: '', password: '', pin: '', notes: '' });
        fetchHosts();
      } else if (res.httpStatusCode === 401) {
        toast.error(res.message, {
          autoClose: 1000,
          onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }),
        });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('An error occurred while saving the credential.');
    } finally {
      setSubmitting(false);
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

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 6 } }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {/* Back */}
          <Box sx={{ mb: 3 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
              sx={{
                color: T.textMuted, fontWeight: 500, fontSize: '0.875rem',
                '&:hover': { color: T.teal, bgcolor: 'transparent' },
              }}
            >
              Password Manager
            </Button>
          </Box>

          {/* Page title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.5,
              bgcolor: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock sx={{ fontSize: 20, color: T.teal }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: T.textPrimary }}>
                Save Credential
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
                Stored with AES-256 end-to-end encryption
              </Typography>
            </Box>
          </Box>

          {/* Form card */}
          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{
              p: { xs: 3, md: 4 },
              bgcolor: T.glass,
              border: `1px solid ${T.glassBorder}`,
              borderRadius: 3,
            }}
          >
            <Grid container spacing={2.5}>

              {/* URL */}
              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={hosts.map(h => `https://${h}/`)}
                  value={form.url}
                  onChange={(_, val) => {
                    setForm(prev => ({ ...prev, url: val || '' }));
                    setIsValidUrl(CommonServices.isValidUrl(val));
                  }}
                  onInputChange={(_, val) => {
                    setForm(prev => ({ ...prev, url: val }));
                    setIsValidUrl(CommonServices.isValidUrl(val));
                  }}
                  PaperComponent={({ children }) => (
                    <Box sx={{ bgcolor: '#141420', border: `1px solid ${T.glassBorder}`, borderRadius: 2, mt: 0.5 }}>
                      {children}
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      id="url"
                      label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Public sx={{ fontSize: 15 }} />Website URL *</Box>}
                      placeholder="https://example.com"
                      error={!isValidUrl && form.url !== ''}
                      helperText={!isValidUrl && form.url !== '' ? 'Enter a valid URL starting with http:// or https://' : ''}
                      sx={DARK_FIELD}
                    />
                  )}
                  sx={{
                    '& .MuiAutocomplete-popupIndicator': { color: T.textMuted },
                    '& .MuiAutocomplete-clearIndicator': { color: T.textMuted },
                    '& .MuiAutocomplete-option': { color: T.textPrimary },
                  }}
                />
              </Grid>

              {/* Username */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth id="username"
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Person sx={{ fontSize: 15 }} />Username *</Box>}
                  placeholder="email, username or mobile"
                  value={form.username}
                  onChange={onFieldChange}
                  sx={DARK_FIELD}
                />
              </Grid>

              {/* Password */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth id="password"
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><VpnKey sx={{ fontSize: 15 }} />Password *</Box>}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={onFieldChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} size="small" sx={{ color: T.teal }}>
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={DARK_FIELD}
                />
              </Grid>

              {/* PIN */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth id="pin"
                  label="PIN (optional)"
                  type={showPin ? 'text' : 'password'}
                  placeholder="Mobile app PIN or backup code"
                  value={form.pin}
                  onChange={onFieldChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPin(!showPin)} size="small" sx={{ color: T.teal }}>
                          {showPin ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={DARK_FIELD}
                />
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth id="notes"
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><NoteAdd sx={{ fontSize: 15 }} />Notes (optional)</Box>}
                  multiline minRows={3} maxRows={6}
                  placeholder={`Security questions, backup codes, recovery details...\nExample:\n• Security Q: Pet's name? A: Fluffy\n• Backup: XXXX-XXXX`}
                  value={form.notes}
                  onChange={onFieldChange}
                  sx={{
                    ...DARK_FIELD,
                    '& .MuiInputBase-input': { color: T.textPrimary, fontFamily: 'monospace', lineHeight: 1.6 },
                  }}
                />
              </Grid>

              {/* Submit */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    sx={{
                      bgcolor: T.teal, color: '#fff', fontWeight: 700,
                      px: { xs: 4, md: 6 }, py: 1.25, borderRadius: 2, minWidth: 200,
                      fontSize: '0.95rem',
                      '&:hover': { bgcolor: '#0f766e' },
                      '&:disabled': { bgcolor: 'rgba(13,148,136,0.3)', color: T.textMuted },
                    }}
                  >
                    {submitting ? 'Saving...' : 'Save Credential'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default AddPassword;
