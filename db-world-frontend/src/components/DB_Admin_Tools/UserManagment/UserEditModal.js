import React, { useState, useMemo, forwardRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Divider, Avatar, MenuItem,
  FormControl, InputLabel, Select, FormHelperText,
  CircularProgress, Stack, IconButton, InputAdornment,
  useMediaQuery, useTheme, alpha, Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Visibility,
  VisibilityOff,
  Edit as EditIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  Transgender as GenderIcon,
  Lock as LockIcon,
  AdminPanelSettings as RoleIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { styled, keyframes } from '@mui/material/styles';

// Animations
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 }
};

const pulseAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

// Styled Components
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
    backdropFilter: 'blur(20px)',
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    boxShadow: `0 25px 50px -12px ${alpha(theme.palette.common.black, 0.25)}`,
    borderRadius: theme.spacing(3),
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(0),
      borderRadius: 0,
      height: '100vh',
      maxHeight: '100vh',
      width: '100vw',
      maxWidth: '100vw',
    }
  }
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 80,
  height: 80,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
  fontSize: '2rem',
  fontWeight: 'bold',
  [theme.breakpoints.down('sm')]: {
    width: 60,
    height: 60,
    fontSize: '1.5rem',
  }
}));

const SectionCard = styled(motion.div)(({ theme }) => ({
  background: alpha(theme.palette.background.default, 0.5),
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  backdropFilter: 'blur(10px)',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1.5),
  }
}));

const ActionButton = styled(motion(Button))(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1.5, 3),
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '1rem',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.3)}`,
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1, 2),
    fontSize: '0.875rem',
    minWidth: '120px',
  }
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  right: theme.spacing(2),
  background: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(5px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
  '&:hover': {
    background: alpha(theme.palette.error.main, 0.1),
    transform: 'rotate(90deg)',
  },
  transition: 'all 0.3s ease',
  [theme.breakpoints.down('sm')]: {
    top: theme.spacing(1),
    right: theme.spacing(1),
  }
}));

const FormIconWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: theme.spacing(1),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
  marginRight: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    width: 32,
    height: 32,
    marginRight: theme.spacing(1),
  }
}));

const ROLES = [
  { id: 1, name: 'OWNER', color: 'error' },
  { id: 2, name: 'ADMIN', color: 'primary' },
  { id: 3, name: 'VIEWER', color: 'success' }
];

const validationSchema = Yup.object({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  mobileNo: Yup.string().matches(/^[0-9]{10}$/, 'Invalid mobile number'),
  dob: Yup.date()
    .required('Date of birth is required')
    .max(new Date(), 'Date cannot be in the future'),
  gender: Yup.string().required('Gender is required'),
  password: Yup.string().required('Password is required'),
  userRole: Yup.object().shape({
    id: Yup.number().required(),
    name: Yup.string().required()
  }).nullable().required('Role is required')
});

// Enhanced FormField Component
const FormField = ({ formik, name, label, icon, showPassword, onTogglePassword, ...props }) => {
  const theme = useTheme();
  const isError = formik.touched[name] && Boolean(formik.errors[name]);

  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        label={label}
        name={name}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={isError}
        helperText={formik.touched[name] && formik.errors[name]}
        InputProps={{
          startAdornment: icon && (
            <InputAdornment position="start">
              {React.cloneElement(icon, {
                sx: {
                  color: isError ? theme.palette.error.main : alpha(theme.palette.text.primary, 0.5)
                }
              })}
            </InputAdornment>
          ),
          endAdornment: props.type === 'password' && (
            <InputAdornment position="end">
              <IconButton
                onClick={onTogglePassword}
                edge="end"
                aria-label="toggle password visibility"
                sx={{ color: alpha(theme.palette.text.primary, 0.5) }}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: theme.spacing(1.5),
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(5px)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              transform: 'translateY(-2px)',
              boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
            },
            '&.Mui-focused': {
              backgroundColor: alpha(theme.palette.background.paper, 0.95),
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
            },
            '& fieldset': {
              borderColor: isError ? theme.palette.error.main : alpha(theme.palette.divider, 0.2),
            },
          },
          '& .MuiInputLabel-root': {
            color: alpha(theme.palette.text.primary, 0.7),
            '&.Mui-focused': {
              color: theme.palette.primary.main,
            },
          }
        }}
        {...props}
      />
    </Box>
  );
};

// Enhanced SelectField Component
const SelectField = ({
  formik,
  name,
  label,
  options,
  optionKey = null,
  optionLabel = null,
  errorKey = null,
  icon,
  ...props
}) => {
  const theme = useTheme();
  const isError = formik.touched[name] && Boolean(formik.errors[name]);

  return (
    <FormControl
      fullWidth
      error={isError}
    >
      <InputLabel
        sx={{
          color: alpha(theme.palette.text.primary, 0.7),
          '&.Mui-focused': {
            color: theme.palette.primary.main,
          }
        }}
      >
        {label}
      </InputLabel>
      <Select
        label={label}
        {...props}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: theme.spacing(1.5),
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(5px)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              transform: 'translateY(-2px)',
              boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
            },
            '&.Mui-focused': {
              backgroundColor: alpha(theme.palette.background.paper, 0.95),
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
            },
          }
        }}
      >
        {options.map((option) => {
          const key = optionKey ? option[optionKey] : option;
          const labelText = optionLabel ? option[optionLabel] : option;
          const color = option.color || 'default';

          return (
            <MenuItem
              key={key}
              value={key}
              sx={{
                borderRadius: theme.spacing(1),
                margin: theme.spacing(0.5),
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1),
                  transform: 'translateX(4px)',
                },
                '&.Mui-selected': {
                  background: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.2),
                  color: theme.palette[color]?.main || theme.palette.primary.main,
                  fontWeight: 600,
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <RoleIcon fontSize="small" />
                <span>{labelText}</span>
              </Stack>
            </MenuItem>
          );
        })}
      </Select>
      <FormHelperText>
        {formik.touched[name] && (errorKey ? formik.errors[name]?.[errorKey] : formik.errors[name])}
      </FormHelperText>
    </FormControl>
  );
};

// DateField Component
const DateField = ({ formik, name, label }) => {
  const theme = useTheme();
  const isError = formik.touched[name] && Boolean(formik.errors[name]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DatePicker
        label={label}
        value={formik.values[name]}
        onChange={(value) => formik.setFieldValue(name, value)}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            error={isError}
            helperText={formik.touched[name] && formik.errors[name]}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarIcon sx={{
                    color: isError ? theme.palette.error.main : alpha(theme.palette.text.primary, 0.5)
                  }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: theme.spacing(1.5),
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(5px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.background.paper, 0.9),
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
                },
                '&.Mui-focused': {
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
                },
                '& fieldset': {
                  borderColor: isError ? theme.palette.error.main : alpha(theme.palette.divider, 0.2),
                },
              },
              '& .MuiInputLabel-root': {
                color: alpha(theme.palette.text.primary, 0.7),
                '&.Mui-focused': {
                  color: theme.palette.primary.main,
                },
              }
            }}
          />
        )}
      />
    </LocalizationProvider>
  );
};

const UserEditModal = ({ user, open, onClose, onSave }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const initialValues = useMemo(() => ({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    mobileNo: user?.mobileNo || '',
    dob: user?.dob ? new Date(user.dob) : null,
    gender: user?.gender
      ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1).toLowerCase()
      : '',
    password: user?.password || '',
    userRole: user?.userRole
      ? ROLES.find(role => role.name.toLowerCase() === user.userRole.name.toLowerCase()) || null
      : null
  }), [user]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        // Add animation before saving
        await new Promise(resolve => setTimeout(resolve, 500));
        await onSave({ ...values, userId: user.userId });
        onClose();
      } catch (error) {
        console.error('Error saving user:', error);
      } finally {
        setLoading(false);
      }
    }
  });

  const handleRoleChange = (e) => {
    const role = ROLES.find(r => r.id === parseInt(e.target.value));
    formik.setFieldValue('userRole', role);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const userInitials = useMemo(() =>
    `${formik.values.firstName?.[0] || ''}${formik.values.lastName?.[0] || ''}`.toUpperCase(),
    [formik.values.firstName, formik.values.lastName]
  );

  const fullName = useMemo(() =>
    `${user?.firstName || ''} ${user?.lastName || ''}`,
    [user?.firstName, user?.lastName]
  );

  const getRoleColor = (roleName) => {
    const role = ROLES.find(r => r.name === roleName);
    return role ? role.color : 'primary';
  };

  if (!open) return null;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <StyledDialog
        open={open}
        onClose={onClose}
        fullWidth
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            maxHeight: isMobile ? '80vh' : '90vh',
            maxWidth: isTablet ? '600px' : isMobile ? '95%' : '800px',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={scaleIn}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        >
          <DialogTitle
            sx={{
              position: 'relative',
              px: { xs: 1.5, sm: 3 },
              py: { xs: 1.5, sm: 2.5 },
              background: `linear-gradient(
      135deg,
      ${alpha(theme.palette.primary.dark, 0.1)} 0%,
      ${alpha(theme.palette.secondary.dark, 0.05)} 100%
    )`,
              flexShrink: 0,
            }}
          >
            {/* Close Button */}
            <CloseButton
              onClick={onClose}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1,
              }}
            >
              <CloseIcon fontSize="small" />
            </CloseButton>

            {/* Always ROW layout (mobile + desktop) */}
            <Stack
              direction="row"
              spacing={{ xs: 1.25, sm: 3 }}
              alignItems="center"
              sx={{
                pr: 4,          // prevents overlap with close button
                minWidth: 0,    // required for ellipsis
              }}
            >
              {/* Avatar */}
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                style={{ flexShrink: 0 }}
              >
                <StyledAvatar
                  sx={{
                    width: { xs: 44, sm: 64 },
                    height: { xs: 44, sm: 64 },
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                  }}
                >
                  {userInitials}
                </StyledAvatar>
              </motion.div>

              {/* Text Section */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.05rem', sm: '1.6rem' },
                    lineHeight: 1.15,
                    background: `linear-gradient(
            135deg,
            ${theme.palette.primary.main} 0%,
            ${theme.palette.secondary.main} 100%
          )`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Edit User Profile
                </Typography>

                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.8rem', sm: '1rem' },
                    color: theme.palette.text.secondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {fullName}
                </Typography>

                {user?.userRole && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                  >
                    <Chip
                      icon={<RoleIcon fontSize="small" />}
                      label={user.userRole.name}
                      size="small"
                      sx={{
                        mt: 0.5,
                        height: { xs: 20, sm: 24 },
                        fontSize: { xs: '0.65rem', sm: '0.8rem' },
                        fontWeight: 600,
                        background: alpha(
                          theme.palette[getRoleColor(user.userRole.name)]?.main ||
                          theme.palette.primary.main,
                          0.12
                        ),
                        color:
                          theme.palette[getRoleColor(user.userRole.name)]?.main ||
                          theme.palette.primary.main,
                      }}
                    />
                  </motion.div>
                )}
              </Box>
            </Stack>
          </DialogTitle>

          {/* Scrollable Content */}
          <DialogContent
            dividers
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: isMobile ? 2 : 4,
              py: isMobile ? 2 : 3,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <form onSubmit={formik.handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Stack spacing={isMobile ? 2 : 4} sx={{ flex: 1 }}>
                {/* Personal Information Section */}
                <motion.div variants={fadeInUp} transition={{ delay: 0.1 }}>
                  <SectionCard>
                    <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                      <FormIconWrapper>
                        <PersonIcon sx={{ color: theme.palette.primary.main, fontSize: isMobile ? '1rem' : '1.25rem' }} />
                      </FormIconWrapper>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: isMobile ? '1rem' : 'inherit' }}>
                        Personal Information
                      </Typography>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                      <FormField
                        formik={formik}
                        name="firstName"
                        label="First Name"
                        fullWidth
                        icon={<PersonIcon />}
                      />
                      <FormField
                        formik={formik}
                        name="lastName"
                        label="Last Name"
                        fullWidth
                        icon={<PersonIcon />}
                      />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ width: '100%' }}>
                        <DateField
                          formik={formik}
                          name="dob"
                          label="Date of Birth"
                        />
                      </Box>
                      <Box sx={{ width: '100%' }}>
                        <SelectField
                          formik={formik}
                          name="gender"
                          label="Gender"
                          value={formik.values.gender}
                          onChange={formik.handleChange}
                          options={['Male', 'Female', 'Other']}
                          icon={<GenderIcon />}
                        />
                      </Box>
                    </Stack>
                  </SectionCard>
                </motion.div>

                {/* Contact Information Section */}
                <motion.div variants={fadeInUp} transition={{ delay: 0.2 }}>
                  <SectionCard>
                    <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                      <FormIconWrapper>
                        <EmailIcon sx={{ color: theme.palette.info.main, fontSize: isMobile ? '1rem' : '1.25rem' }} />
                      </FormIconWrapper>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: isMobile ? '1rem' : 'inherit' }}>
                        Contact Information
                      </Typography>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <FormField
                        formik={formik}
                        name="email"
                        label="Email"
                        fullWidth
                        icon={<EmailIcon />}
                      />
                      <FormField
                        formik={formik}
                        name="mobileNo"
                        label="Mobile Number"
                        fullWidth
                        icon={<PhoneIcon />}
                      />
                    </Stack>
                  </SectionCard>
                </motion.div>

                {/* Security Section */}
                <motion.div variants={fadeInUp} transition={{ delay: 0.3 }}>
                  <SectionCard>
                    <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                      <FormIconWrapper>
                        <LockIcon sx={{ color: theme.palette.warning.main, fontSize: isMobile ? '1rem' : '1.25rem' }} />
                      </FormIconWrapper>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: isMobile ? '1rem' : 'inherit' }}>
                        Security Settings
                      </Typography>
                    </Stack>

                    <FormField
                      formik={formik}
                      name="password"
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      fullWidth
                      icon={<LockIcon />}
                      showPassword={showPassword}
                      onTogglePassword={togglePasswordVisibility}
                    />
                  </SectionCard>
                </motion.div>

                {/* Role Information Section */}
                <motion.div variants={fadeInUp} transition={{ delay: 0.4 }}>
                  <SectionCard>
                    <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                      <FormIconWrapper>
                        <RoleIcon sx={{ color: theme.palette.error.main, fontSize: isMobile ? '1rem' : '1.25rem' }} />
                      </FormIconWrapper>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: isMobile ? '1rem' : 'inherit' }}>
                        Role & Permissions
                      </Typography>
                    </Stack>

                    {loadingRoles ? (
                      <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress size={isMobile ? 24 : 32} />
                      </Box>
                    ) : (
                      <SelectField
                        formik={formik}
                        name="userRole"
                        label="User Role"
                        value={formik.values.userRole?.id || ''}
                        onChange={handleRoleChange}
                        options={ROLES}
                        optionKey="id"
                        optionLabel="name"
                        errorKey="name"
                        icon={<RoleIcon />}
                      />
                    )}
                  </SectionCard>
                </motion.div>
              </Stack>
            </form>
          </DialogContent>

          {/* Fixed Footer */}
          <DialogActions sx={{
            px: isMobile ? 2 : 4,
            py: isMobile ? 2 : 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.8)} 0%, ${alpha(theme.palette.background.default, 0.6)} 100%)`,
            backdropFilter: 'blur(10px)',
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            flexShrink: 0,
            display: 'flex',
            gap: isMobile ? 1 : 2,
          }}>
            <ActionButton
              onClick={onClose}
              color="inherit"
              variant="outlined"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              sx={{
                borderColor: alpha(theme.palette.divider, 0.3),
                '&:hover': {
                  borderColor: theme.palette.divider,
                },
                flex: isMobile ? 1 : 'none',
              }}
            >
              Cancel
            </ActionButton>
            <ActionButton
              type="submit"
              color="primary"
              variant="contained"
              disabled={loading || !formik.dirty}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={formik.handleSubmit}
              sx={{
                animation: formik.dirty && !loading ? `${pulseAnimation} 2s infinite` : 'none',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                flex: isMobile ? 1 : 'none',
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <EditIcon fontSize={isMobile ? "small" : "medium"} />
                  <span>Save</span>
                </Stack>
              )}
            </ActionButton>
          </DialogActions>
        </motion.div>
      </StyledDialog>
    </LocalizationProvider>
  );
};

export default React.memo(UserEditModal);