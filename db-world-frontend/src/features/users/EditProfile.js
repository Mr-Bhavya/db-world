import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Button, Checkbox, CircularProgress, Container,
  FormControl, FormHelperText, Grid,
  InputAdornment, MenuItem, TextField, Typography,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  Wc as GenderIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import Constants from '@shared/constants';
import { updateUserDetails } from '@shared/services/ApiServices';
import { toast } from '@shared/components/ui/Toast';
import { handleApiSuccess } from '@shared/components/ui/utils/successHandler';
import { handleApiError } from '@shared/components/ui/utils/errorHandler';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT, getFieldSx, getSelectMenuProps, getGlowProps } from '@shared/theme';

// ── Section label ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: '0.68rem', fontWeight: 700, color: T.textFaint,
      textTransform: 'uppercase', letterSpacing: '0.1em', mt: 1, mb: 1.5,
    }}>
      {children}
    </Typography>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const EditProfile = ({ user, isFromAdmin }) => {
  usePageMeta('Edit Profile');

  const T           = useT();
  const FIELD       = getFieldSx(T);
  const SELECT_MENU = getSelectMenuProps(T);
  const GLOW        = getGlowProps(T);
  const navigate    = useNavigate();
  const location    = useLocation();

  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    userId: '', firstName: '', lastName: '', gender: '',
    dob: '', age: 0, mobileNo: '', email: '', agreeCheckBox: false,
  });
  const [errors, setErrors] = useState({
    firstName: false, lastName: false, gender: false, dob: false,
    mobileNo: false, email: false, agreeCheckBox: false,
  });

  useEffect(() => {
    const init = async () => {
      const userData = isFromAdmin ? user : (location?.state?.userData || {});
      setFormData({
        userId:       userData.userId       || '',
        firstName:    userData.firstName    || '',
        lastName:     userData.lastName     || '',
        gender:       userData.gender       || '',
        dob:          userData.dob          || '',
        age:          userData.age          || 0,
        mobileNo:     userData.mobileNo     || '',
        email:        userData.email        || '',
        agreeCheckBox: userData.agreeCheckBox || false,
      });
      setLoading(false);
    };
    init();
  }, [isFromAdmin, location, navigate, user]);

  const validateField = (name, value) => {
    let ok = true;
    switch (name) {
      case 'firstName':
      case 'lastName':
        ok = !!value && !/[ ]{2,}/.test(value); break;
      case 'dob': {
        const pattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
        const year = value?.split('-')[0];
        const now  = new Date().getFullYear();
        ok = !!value && pattern.test(value) && year >= 1900 && year <= now;
        break;
      }
      case 'gender':    ok = !!value; break;
      case 'mobileNo':  ok = /^[0-9]{10}$/.test(value); break;
      case 'email':     ok = !!value && !/\s/.test(value); break;
      case 'agreeCheckBox': ok = !!value; break;
      default: break;
    }
    setErrors(p => ({ ...p, [name]: !ok }));
    return ok;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    setFormData(p => ({ ...p, [name]: fieldValue }));
    validateField(name, fieldValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValid = Object.entries(formData).every(([k, v]) => {
      if (k === 'age' || k === 'userId') return true;
      return validateField(k, v);
    });
    if (!isValid) {
      toast.warning('Please fill all required fields correctly.');
      return;
    }
    setSubmitting(true);
    try {
      const { userId, firstName, lastName, gender, dob, mobileNo } = formData;
      await updateUserDetails({ userId, firstName, lastName, gender, dob, mobileNo: Number(mobileNo) });
      handleApiSuccess('Profile updated successfully!', navigate, Constants.USER_PROFILE_ROUTE);
    } catch (err) {
      handleApiError(err, navigate, location);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: T.teal }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: T.bg, color: T.text, position: 'relative' }}>
      <motion.div {...GLOW} />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 40px)' }, pb: 6, px: { xs: 2, sm: 3 } }}>

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate(Constants.USER_PROFILE_ROUTE)}
            sx={{ mb: 3, color: T.textMuted, textTransform: 'none', fontWeight: 500, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
          >
            Back to profile
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>

          {/* Card */}
          <Box sx={{
            bgcolor: T.glass,
            border: `1px solid ${T.glassBorder}`,
            borderRadius: 3,
            backdropFilter: 'blur(20px)',
            p: { xs: 2.5, sm: 4 },
          }}>

            {/* Header */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: T.text, letterSpacing: '-0.01em' }}>
                Edit Profile
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: T.textMuted, mt: 0.5 }}>
                Update your personal information
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} noValidate>

              {/* ── Personal ── */}
              <SectionLabel>Personal information</SectionLabel>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="First name" name="firstName"
                    value={formData.firstName} onChange={handleChange}
                    error={errors.firstName}
                    helperText={errors.firstName ? 'First name is required' : ''}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ fontSize: 18, color: errors.firstName ? T.error : T.textMuted }} />
                      </InputAdornment>
                    )}}
                    sx={FIELD}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Last name" name="lastName"
                    value={formData.lastName} onChange={handleChange}
                    error={errors.lastName}
                    helperText={errors.lastName ? 'Last name is required' : ''}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ fontSize: 18, color: errors.lastName ? T.error : T.textMuted }} />
                      </InputAdornment>
                    )}}
                    sx={FIELD}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select fullWidth label="Gender" name="gender"
                    value={formData.gender} onChange={handleChange}
                    error={errors.gender}
                    helperText={errors.gender ? 'Please select a gender' : ''}
                    SelectProps={{ MenuProps: SELECT_MENU }}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <GenderIcon sx={{ fontSize: 18, color: errors.gender ? T.error : T.textMuted }} />
                      </InputAdornment>
                    )}}
                    sx={FIELD}
                  >
                    <MenuItem value=""><em style={{ color: T.textFaint }}>Select gender</em></MenuItem>
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Prefer not to say</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Date of birth" name="dob" type="date"
                    value={formData.dob} onChange={handleChange}
                    InputLabelProps={{ shrink: true }}
                    error={errors.dob}
                    helperText={errors.dob ? 'Enter a valid date' : ''}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <CalendarIcon sx={{ fontSize: 18, color: errors.dob ? T.error : T.textMuted }} />
                      </InputAdornment>
                    )}}
                    sx={FIELD}
                  />
                </Grid>
              </Grid>

              {/* ── Contact & Security ── */}
              <SectionLabel>Contact &amp; security</SectionLabel>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Mobile number" name="mobileNo"
                    value={formData.mobileNo} onChange={handleChange}
                    error={errors.mobileNo}
                    helperText={errors.mobileNo ? '10-digit number required' : ''}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon sx={{ fontSize: 18, color: errors.mobileNo ? T.error : T.textMuted }} />
                      </InputAdornment>
                    )}}
                    sx={FIELD}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Email address" name="email" type="email"
                    value={formData.email} onChange={handleChange}
                    error={errors.email}
                    helperText={errors.email ? 'Enter a valid email' : ''}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ fontSize: 18, color: errors.email ? T.error : T.textMuted }} />
                      </InputAdornment>
                    )}}
                    sx={FIELD}
                  />
                </Grid>
              </Grid>

              {/* ── Terms ── */}
              <FormControl error={errors.agreeCheckBox} sx={{ mt: 2, mb: 3, display: 'block' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox
                    name="agreeCheckBox"
                    checked={formData.agreeCheckBox}
                    onChange={handleChange}
                    sx={{
                      color: errors.agreeCheckBox ? T.error : T.textMuted,
                      '&.Mui-checked': { color: T.teal },
                      p: 0.5,
                    }}
                  />
                  <Typography sx={{ fontSize: '0.875rem', color: T.textMuted }}>
                    I confirm these changes are correct
                    <Box component="span" sx={{ color: T.error }}> *</Box>
                  </Typography>
                </Box>
                {errors.agreeCheckBox && (
                  <FormHelperText sx={{ color: T.error, ml: 0, mt: 0.5 }}>
                    Please confirm before saving
                  </FormHelperText>
                )}
              </FormControl>

              {/* ── Buttons ── */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  type="submit"
                  fullWidth
                  disabled={submitting || !formData.agreeCheckBox}
                  startIcon={!submitting && <SaveIcon />}
                  sx={{
                    py: 1.4,
                    bgcolor: T.teal, color: '#fff', fontWeight: 700,
                    fontSize: '0.95rem', borderRadius: 1.5, textTransform: 'none',
                    '&:hover': { bgcolor: T.tealHover },
                    '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint },
                  }}
                >
                  {submitting
                    ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />Saving…</>
                    : 'Save changes'
                  }
                </Button>
                <Button
                  onClick={() => navigate(Constants.USER_PROFILE_ROUTE)}
                  sx={{
                    py: 1.4, px: 3,
                    border: `1px solid ${T.glassBorder}`,
                    color: T.textMuted, borderRadius: 1.5, textTransform: 'none',
                    fontWeight: 500, flexShrink: 0,
                    '&:hover': { borderColor: T.error, color: T.error, bgcolor: T.errorBg },
                  }}
                >
                  Cancel
                </Button>
              </Box>

            </Box>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default EditProfile;
