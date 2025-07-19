import React, { useState, useMemo, forwardRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Divider, Avatar, MenuItem,
  FormControl, InputLabel, Select, FormHelperText,
  CircularProgress, Stack, IconButton, InputAdornment,
  useMediaQuery, useTheme
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { getAllUserRoles } from '../../ApiServices';
import Constants from '../../Constants';

const Transition = forwardRef(function Transition(props, ref) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      {...props}
    />
  );
});

const ROLES = [
  { id: 1, name: 'OWNER' },
  { id: 2, name: 'ADMIN' },
  { id: 3, name: 'VIEWER' }
];

const validationSchema = Yup.object({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  mobileNo: Yup.string().matches(/^[0-9]{10}$/, 'Invalid mobile number'),
  dob: Yup.date().required('Date of birth is required'),
  gender: Yup.string().required('Gender is required'),
  password: Yup.string().required('Password is required'),
  userRole: Yup.object().shape({
    id: Yup.number().required(),
    name: Yup.string().required()
  }).nullable().required('Role is required')
});

const UserEditModal = ({ user, open, onClose, onSave }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [allRoles, setAllRoles] = useState([]);
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
    `${formik.values.firstName?.[0] || ''}${formik.values.lastName?.[0] || ''}`,
    [formik.values.firstName, formik.values.lastName]
  );

  const fullName = useMemo(() =>
    `${user?.firstName || ''} ${user?.lastName || ''}`,
    [user?.firstName, user?.lastName]
  );

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={Transition}
      fullScreen={isMobile}
      sx={{
        '& .MuiDialog-paper': {
          maxHeight: isMobile ? '100vh' : '80vh',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ width: 56, height: 56 }}>
            {userInitials}
          </Avatar>
          <Typography variant="h5">
            Edit User: {fullName}
          </Typography>
        </Box>
      </DialogTitle>

      <form onSubmit={formik.handleSubmit}>
        <DialogContent dividers sx={{ overflowY: 'auto' }}>
          <Stack spacing={4}>

            {/* Basic Info Section */}
            <Section title="Basic Information">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                <FormField
                  formik={formik}
                  name="firstName"
                  label="First Name"
                  fullWidth
                />
                <FormField
                  formik={formik}
                  name="lastName"
                  label="Last Name"
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <DatePicker
                  label="Date of Birth"
                  value={formik.values.dob}
                  onChange={(value) => formik.setFieldValue('dob', value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      error={formik.touched.dob && Boolean(formik.errors.dob)}
                      helperText={formik.touched.dob && formik.errors.dob}
                    />
                  )}
                />
                <SelectField
                  formik={formik}
                  name="gender"
                  label="Gender"
                  value={formik.values.gender}
                  options={['Male', 'Female', 'Other']}
                />
              </Stack>
            </Section>

            {/* Contact Info Section */}
            <Section title="Contact Information">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormField
                  formik={formik}
                  name="email"
                  label="Email"
                  fullWidth
                />
                <FormField
                  formik={formik}
                  name="mobileNo"
                  label="Mobile Number"
                  fullWidth
                />
              </Stack>
            </Section>

            {/* Security Info Section */}
            <Section title="Security Information">
              <FormField
                formik={formik}
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={togglePasswordVisibility}
                        edge="end"
                        aria-label="toggle password visibility"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Section>

            {/* Role Info Section */}
            <Section title="Role Information">
              {loadingRoles ? (
                <CircularProgress size={24} />
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
                />
              )}
            </Section>
          </Stack>
        </DialogContent>

        <DialogActions sx={{
          position: isMobile ? 'sticky' : 'static',
          bottom: 0,
          backgroundColor: 'background.paper',
          zIndex: 1,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={loading || !formik.dirty}
          >
            {loading ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

// Reusable components (keep these the same as before)
const Section = ({ title, children }) => (
  <Box>
    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{title}</Typography>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Box>
);

const FormField = ({ formik, name, label, ...props }) => (
  <TextField
    label={label}
    name={name}
    value={formik.values[name]}
    onChange={formik.handleChange}
    error={formik.touched[name] && Boolean(formik.errors[name])}
    helperText={formik.touched[name] && formik.errors[name]}
    {...props}
  />
);

const SelectField = ({
  formik,
  name,
  label,
  options,
  optionKey = null,
  optionLabel = null,
  errorKey = null,
  ...props
}) => (
  <FormControl fullWidth error={formik.touched[name] && Boolean(formik.errors[name])}>
    <InputLabel>{label}</InputLabel>
    <Select
      label={label}
      {...props}
    >
      {options.map((option) => {
        const key = optionKey ? option[optionKey] : option;
        const label = optionLabel ? option[optionLabel] : option;
        return (
          <MenuItem key={key} value={key}>
            {label}
          </MenuItem>
        );
      })}
    </Select>
    <FormHelperText>
      {formik.touched[name] && (errorKey ? formik.errors[name]?.[errorKey] : formik.errors[name])}
    </FormHelperText>
  </FormControl>
);

export default React.memo(UserEditModal);