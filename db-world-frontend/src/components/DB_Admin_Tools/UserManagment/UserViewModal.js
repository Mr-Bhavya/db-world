import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Divider,
  Avatar,
  Box,
  Chip,
  Stack,
  useMediaQuery,
  useTheme,
  Slide,
  InputAdornment,
  IconButton,
  TextField,
} from '@mui/material';
import {
  Email,
  Phone,
  Cake,
  Event,
  Male,
  Female,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const UserViewModal = ({ user, open, onClose }) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [showPassword, setShowPassword] = useState(false);

  const recentLogins = useMemo(() => user?.loginData?.slice(0, 5) || [], [user]);
  const fullName = useMemo(
    () => (user ? `${user.firstName} ${user.lastName}` : ''),
    [user]
  );
  const initials = useMemo(
    () => (user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : ''),
    [user]
  );
  const dobFormatted = useMemo(
    () => (user ? new Date(user.dob).toLocaleDateString() : ''),
    [user]
  );

  if (!user) return null;

  const handleClose = () => {
    onClose?.();
  };

  const GenderIcon = user.gender === 'Male' ? Male : Female;
  const genderIconColor = user.gender === 'Male' ? 'primary' : 'secondary';

  const calculateAgeFromDob = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };


  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={Transition}
      scroll="paper"
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Avatar sx={{ width: 56, height: 56 }}>{initials}</Avatar>
          <Box flexGrow={1}>
            <Typography variant="h5" component="div">
              {fullName}
            </Typography>
          </Box>
          <Chip
            label={user.userRole?.name || 'User'}
            color={user.userRole?.name === 'Admin' ? 'primary' : 'default'}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={4}>
          {/* Personal Information */}
          <Section title="Personal Information">
            <Stack direction={isSmallScreen ? 'column' : 'row'} spacing={4}>
              <InfoItem icon={<Cake color="action" />}>
                 {`${dobFormatted} (Age: ${user.age > 0 ? user.age : calculateAgeFromDob(user.dob) ?? 'N/A'})`}
              </InfoItem>
              <InfoItem icon={<GenderIcon color={genderIconColor} />}>
                {user.gender}
              </InfoItem>
            </Stack>
          </Section>

          {/* Contact Information */}
          <Section title="Contact Information">
            <Stack spacing={2}>
              <InfoItem icon={<Email color="action" />}>
                {user.email}
              </InfoItem>
              <InfoItem icon={<Phone color="action" />}>
                {user.mobileNo || 'Not provided'}
              </InfoItem>
            </Stack>
          </Section>

          {/* Security Information */}
          <Section title="Security Information">
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={user.password || '********'}
              variant="outlined"
              size="small"
              disabled
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 300 }}
            />
          </Section>

          {/* Activity Information */}
          {recentLogins.length > 0 && (
            <Section title="Activity Information">
              <Stack spacing={1}>
                {recentLogins.map((login, index) => (
                  <InfoItem key={index} icon={<Event color="action" />}>
                    {`Login ${index + 1}: ${new Date(login.lastLoginDate).toLocaleString()}`}
                  </InfoItem>
                ))}
                <Typography variant="body2" color="text.secondary">
                  {`Total Logins: ${user.noOfLogin || recentLogins.length}`}
                </Typography>
              </Stack>
            </Section>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="primary" variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Helper components for better readability and reusability
const Section = ({ title, children }) => (
  <Box>
    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
      {title}
    </Typography>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Box>
);

const InfoItem = ({ icon, children }) => (
  <Box display="flex" alignItems="center" gap={1}>
    {icon}
    <Typography component="span">{children}</Typography>
  </Box>
);

export default React.memo(UserViewModal);