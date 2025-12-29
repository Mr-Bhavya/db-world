import React, { useState, useMemo, memo, useCallback } from 'react';
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
  Paper,
  Grid
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
  Person,
  Badge,
  CalendarMonth,
  Security,
  LaptopMac,
  Smartphone,
  TabletMac,
  DesktopMac
} from '@mui/icons-material';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Helper components
const Section = memo(({ title, children, icon }) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      {icon}
      <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>
        {title}
      </Typography>
    </Box>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Box>
));

Section.displayName = 'Section';

const InfoItem = memo(({ icon, label, value, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
    <Box sx={{ 
      color: 'primary.main', 
      display: 'flex', 
      alignItems: 'center',
      mt: 0.25 
    }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1 }}>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
          {label}
        </Typography>
      )}
      <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
        {value || children}
      </Typography>
    </Box>
  </Box>
));

InfoItem.displayName = 'InfoItem';

const LoginActivityItem = memo(({ login, index }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const formatDateTime = useCallback((dateString) => {
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? dateString :
        date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
    } catch {
      return dateString;
    }
  }, []);

  const getDeviceIcon = useCallback((userAgent) => {
    if (!userAgent) return <DesktopMac sx={{ fontSize: '1rem' }} />;
    
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
      return /tablet|ipad/.test(ua) 
        ? <TabletMac sx={{ fontSize: '1rem' }} />
        : <Smartphone sx={{ fontSize: '1rem' }} />;
    }
    return <LaptopMac sx={{ fontSize: '1rem' }} />;
  }, []);

  const getDeviceName = useCallback((userAgent) => {
    if (!userAgent) return 'Desktop';
    
    const ua = userAgent.toLowerCase();
    if (/mobile|android/.test(ua)) return 'Mobile';
    if (/iphone/.test(ua)) return 'iPhone';
    if (/ipad/.test(ua)) return 'iPad';
    if (/tablet/.test(ua)) return 'Tablet';
    if (/windows/.test(ua)) return 'Windows';
    if (/mac/.test(ua)) return 'Mac';
    if (/linux/.test(ua)) return 'Linux';
    
    return 'Desktop';
  }, []);

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 1.5, 
        mb: 1,
        borderLeft: `3px solid ${theme.palette.success.main}`,
        backgroundColor: theme.palette.background.default
      }}
    >
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getDeviceIcon(login.userAgent)}
            <Typography variant="caption" fontWeight={500}>
              {getDeviceName(login.userAgent)}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Login #{index + 1}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" align={isMobile ? 'left' : 'right'}>
            {formatDateTime(login.lastLoginDate)}
          </Typography>
          {login.ipAddress && (
            <Typography variant="caption" color="text.secondary" align={isMobile ? 'left' : 'right'}>
              IP: {login.ipAddress}
            </Typography>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
});

LoginActivityItem.displayName = 'LoginActivityItem';

const UserViewModal = ({ user, open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showPassword, setShowPassword] = useState(false);

  // Memoized calculations
  const userData = useMemo(() => {
    if (!user) return null;

    const fullName = `${user.firstName} ${user.lastName}`;
    const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();
    
    const calculateAge = (dob) => {
      if (!dob) return null;
      try {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      } catch {
        return null;
      }
    };

    const formatDob = (dob) => {
      if (!dob) return 'Not provided';
      try {
        return new Date(dob).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        return dob;
      }
    };

    const recentLogins = Array.isArray(user.loginData) ? user.loginData.slice(0, 5) : [];
    const age = user.age || calculateAge(user.dob);
    const dobFormatted = formatDob(user.dob);
    const totalLogins = user.noOfLogin || recentLogins.length;

    return {
      ...user,
      fullName,
      initials,
      age,
      dobFormatted,
      recentLogins,
      totalLogins,
      genderIcon: user.gender === 'Male' ? Male : Female,
      genderColor: user.gender === 'Male' ? 'primary' : 'secondary'
    };
  }, [user]);

  const handleClose = useCallback(() => {
    onClose?.();
    // Reset modal state
    setShowPassword(false);
  }, [onClose]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  if (!userData) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      TransitionComponent={Transition}
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          maxHeight: isMobile ? '100%' : '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: 'background.paper', 
        borderBottom: 1, 
        borderColor: 'divider',
        p: isMobile ? 2 : 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Avatar 
            sx={{ 
              width: isMobile ? 48 : 56, 
              height: isMobile ? 48 : 56,
              bgcolor: 'primary.main',
              fontSize: isMobile ? '1rem' : '1.25rem'
            }}
          >
            {userData.initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              component="div"
              sx={{ 
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {userData.fullName}
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                mt: 0.5
              }}
            >
              <Email sx={{ fontSize: '1rem' }} />
              {userData.email}
            </Typography>
          </Box>
          <Chip
            label={userData.userRole?.name || 'User'}
            color={userData.userRole?.name === 'Admin' ? 'primary' : 'default'}
            size={isMobile ? "small" : "medium"}
            sx={{ 
              height: 'fit-content',
              alignSelf: 'flex-start'
            }}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: isMobile ? 2 : 3 }}>
        <Stack spacing={isMobile ? 2 : 3}>
          {/* Personal Information */}
          <Section 
            title="Personal Information" 
            icon={<Person sx={{ color: 'primary.main', fontSize: '1.1rem' }} />}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <InfoItem
                  icon={<Cake sx={{ fontSize: '1.1rem' }} />}
                  label="Date of Birth"
                  value={`${userData.dobFormatted}${userData.age ? ` (Age: ${userData.age})` : ''}`}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoItem
                  icon={<userData.genderIcon sx={{ fontSize: '1.1rem' }} color={userData.genderColor} />}
                  label="Gender"
                  value={userData.gender || 'Not specified'}
                />
              </Grid>
            </Grid>
          </Section>

          {/* Contact Information */}
          <Section 
            title="Contact Information" 
            icon={<Badge sx={{ color: 'primary.main', fontSize: '1.1rem' }} />}
          >
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <InfoItem
                  icon={<Email sx={{ fontSize: '1.1rem' }} />}
                  label="Email Address"
                  value={userData.email}
                />
              </Grid>
              <Grid item xs={12}>
                <InfoItem
                  icon={<Phone sx={{ fontSize: '1.1rem' }} />}
                  label="Phone Number"
                  value={userData.mobileNo || 'Not provided'}
                />
              </Grid>
            </Grid>
          </Section>

          {/* Security Information */}
          <Section 
            title="Security Information" 
            icon={<Security sx={{ color: 'primary.main', fontSize: '1.1rem' }} />}
          >
            <Box sx={{ maxWidth: 400 }}>
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={userData.password || ''}
                variant="outlined"
                size="small"
                disabled
                fullWidth
                InputProps={{
                  sx: { 
                    bgcolor: 'background.default',
                    fontFamily: 'monospace'
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={togglePasswordVisibility}
                        edge="end"
                        size="small"
                        aria-label="toggle password visibility"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Section>

          {/* Activity Information */}
          {userData.recentLogins.length > 0 && (
            <Section 
              title="Activity Information" 
              icon={<CalendarMonth sx={{ color: 'primary.main', fontSize: '1.1rem' }} />}
            >
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Logins: <strong>{userData.totalLogins}</strong>
                </Typography>
              </Box>
              <Stack spacing={1}>
                {userData.recentLogins.map((login, index) => (
                  <LoginActivityItem 
                    key={`login-${index}`} 
                    login={login} 
                    index={index} 
                  />
                ))}
              </Stack>
            </Section>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ 
        p: isMobile ? 2 : 3, 
        bgcolor: 'background.default',
        borderTop: 1,
        borderColor: 'divider'
      }}>
        <Button 
          onClick={handleClose} 
          variant="contained" 
          fullWidth={isMobile}
          sx={{ 
            minWidth: isMobile ? 'auto' : 120,
            borderRadius: 2
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(UserViewModal);