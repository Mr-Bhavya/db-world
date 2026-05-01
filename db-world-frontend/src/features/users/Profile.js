import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar, Box, Button, Chip, CircularProgress, Container,
  Dialog, DialogContent, DialogTitle, Divider,
  IconButton, InputAdornment, TextField, Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Cake as CakeIcon,
  Person as PersonIcon,
  Login as LoginIcon,
  Wc as GenderIcon,
  ArrowBack as BackIcon,
  Shield as RoleIcon,
  Lock as LockIcon,
  Close as CloseIcon,
  Visibility, VisibilityOff,
  Devices as DevicesIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import Constants from '@shared/constants';
import { getUserDetail, changePassword, getLoginHistory } from '@shared/services/ApiServices';
import { toast } from '@shared/components/ui/Toast';
import { useT, getFieldSx, getGlowProps } from '@shared/theme';

// ── UA parser (no deps) ───────────────────────────────────────────────────────
function parseAgent(ua) {
  if (!ua) return { browser: 'Unknown', device: 'Unknown' };
  let browser = 'Unknown';
  let device  = 'Desktop';
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';
  else if (/Tablet/i.test(ua)) device = 'Tablet';
  if      (/Edg\//i.test(ua))     browser = 'Edge';
  else if (/OPR\//i.test(ua))     browser = 'Opera';
  else if (/Chrome\//i.test(ua))  browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua))  browser = 'Safari';
  return { browser, device };
}

function formatLoginDate(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Info row ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value, onClick }) => {
  const T = useT();
  const isClickable = !!onClick;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: 2.5, py: 1.75, borderRadius: 2,
        bgcolor: T.glass, border: `1px solid ${T.glassBorder}`,
        transition: 'border-color 0.2s, background 0.2s',
        cursor: isClickable ? 'pointer' : 'default',
        '&:hover': isClickable
          ? { borderColor: T.teal, bgcolor: T.tealBg }
          : { borderColor: T.teal },
      }}
    >
      <Box sx={{
        width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
        bgcolor: T.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon sx={{ fontSize: 18, color: T.teal }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
          {label}
        </Typography>
        <Typography sx={{
          fontSize: '0.9rem', color: value ? T.text : T.textFaint,
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontStyle: value ? 'normal' : 'italic',
        }}>
          {value || 'Not set'}
        </Typography>
      </Box>
      {isClickable && (
        <Typography sx={{ fontSize: '0.75rem', color: T.teal, fontWeight: 600, flexShrink: 0 }}>
          View →
        </Typography>
      )}
    </Box>
  );
};

// ── Section label ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: '0.68rem', fontWeight: 700, color: T.textFaint,
      textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1,
    }}>
      {children}
    </Typography>
  );
};

// ── Change Password Dialog ────────────────────────────────────────────────────
const ChangePasswordDialog = ({ open, onClose }) => {
  const T     = useT();
  const FIELD = getFieldSx(T);
  const [form,    setForm]    = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.oldPassword) e.oldPassword = 'Required';
    if (!form.newPassword || form.newPassword.length < 6) e.newPassword = 'Min 6 characters';
    if (form.newPassword !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword });
      toast.success('Password changed successfully!');
      onClose();
      setForm({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to change password.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, [name]: undefined }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '1rem' }}>Change Password</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: T.textMuted, '&:hover': { color: T.text } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            fullWidth label="Current password" name="oldPassword" type={showOld ? 'text' : 'password'}
            value={form.oldPassword} onChange={handleChange}
            error={!!errors.oldPassword} helperText={errors.oldPassword}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: T.textMuted }} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowOld(p => !p)} sx={{ color: T.textMuted }}>
                    {showOld ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={FIELD}
          />
          <TextField
            fullWidth label="New password" name="newPassword" type={showNew ? 'text' : 'password'}
            value={form.newPassword} onChange={handleChange}
            error={!!errors.newPassword} helperText={errors.newPassword || 'Minimum 6 characters'}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: T.textMuted }} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowNew(p => !p)} sx={{ color: T.textMuted }}>
                    {showNew ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={FIELD}
          />
          <TextField
            fullWidth label="Confirm new password" name="confirm" type="password"
            value={form.confirm} onChange={handleChange}
            error={!!errors.confirm} helperText={errors.confirm}
            InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: T.textMuted }} /></InputAdornment> }}
            sx={FIELD}
          />
          <Button
            fullWidth onClick={handleSubmit} disabled={loading}
            sx={{
              py: 1.3, bgcolor: T.teal, color: '#fff', fontWeight: 700,
              borderRadius: 1.5, textTransform: 'none',
              '&:hover': { bgcolor: T.tealHover },
              '&.Mui-disabled': { bgcolor: T.tealBg, color: T.textFaint },
            }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Update Password'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// ── Login History Dialog ──────────────────────────────────────────────────────
const LoginHistoryDialog = ({ open, onClose }) => {
  const T = useT();
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getLoginHistory()
      .then(res => setSessions(res?.data || []))
      .catch(() => toast.error('Failed to load login history.'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '1rem' }}>Login History</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: T.textMuted, '&:hover': { color: T.text } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: T.teal }} />
          </Box>
        ) : sessions.length === 0 ? (
          <Typography sx={{ color: T.textMuted, textAlign: 'center', py: 4, fontSize: '0.875rem' }}>
            No login history found.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
            {sessions.map((s, i) => {
              const { browser, device } = parseAgent(s.loginAgent);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Box sx={{
                    px: 2, py: 1.75, borderRadius: 2,
                    bgcolor: T.glass, border: `1px solid ${T.glassBorder}`,
                    display: 'flex', gap: 2, alignItems: 'flex-start',
                  }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                      bgcolor: T.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <DevicesIcon sx={{ fontSize: 18, color: T.teal }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: T.text }}>
                          {browser}
                        </Typography>
                        <Chip label={device} size="small" sx={{
                          height: 18, fontSize: '0.65rem', fontWeight: 600,
                          bgcolor: T.tealBg, color: T.teal, border: `1px solid ${T.tealBg}`,
                        }} />
                        {i === 0 && (
                          <Chip label="Latest" size="small" sx={{
                            height: 18, fontSize: '0.65rem', fontWeight: 600,
                            bgcolor: 'rgba(16,185,129,0.12)', color: T.success,
                          }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <TimeIcon sx={{ fontSize: 13, color: T.textFaint }} />
                        <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }}>
                          {formatLoginDate(s.lastLoginDate)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </motion.div>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const Profile = () => {
  const T        = useT();
  const GLOW     = getGlowProps(T);
  const navigate = useNavigate();
  const location = useLocation();

  const [userData,     setUserData]     = useState({});
  const [loading,      setLoading]      = useState(true);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getUserDetail();
        if (res.httpStatusCode === 200) {
          const user = res.data;
          if (user.dob) {
            user.dob = new Intl.DateTimeFormat('fr-ca', {
              year: 'numeric', month: '2-digit', day: '2-digit',
            }).format(new Date(user.dob)).split(' ')[0];
          }
          setUserData(user);
        } else if ([401, 403].includes(res.httpStatusCode)) {
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        }
      } catch {
        toast.error('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, location]);

  const initials = [userData.firstName, userData.lastName]
    .filter(Boolean).map(s => s[0].toUpperCase()).join('');
  const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: T.bg, color: T.text, position: 'relative' }}>
      <motion.div {...GLOW} />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 40px)' }, pb: 6, px: { xs: 2, sm: 3 } }}>

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <Button
            startIcon={<BackIcon />} onClick={() => navigate(-1)}
            sx={{ mb: 3, color: T.textMuted, textTransform: 'none', fontWeight: 500, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
          >
            Back
          </Button>
        </motion.div>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress sx={{ color: T.teal }} />
          </Box>
        ) : (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
            <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3, backdropFilter: 'blur(20px)', overflow: 'hidden' }}>

              {/* Avatar banner */}
              <Box sx={{
                background: `linear-gradient(135deg, ${T.tealBg} 0%, ${T.tealBgHover} 100%)`,
                borderBottom: `1px solid ${T.glassBorder}`,
                pt: 4, pb: 3,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
              }}>
                <Avatar sx={{
                  width: 88, height: 88, bgcolor: T.teal,
                  fontSize: '2rem', fontWeight: 700, color: '#fff',
                  border: `3px solid ${T.glassBorder}`,
                  boxShadow: `0 0 30px ${T.tealGlow}`,
                }}>
                  {initials || <PersonIcon sx={{ fontSize: 40 }} />}
                </Avatar>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: T.text, letterSpacing: '-0.01em' }}>
                    {fullName || 'Unknown User'}
                  </Typography>
                  {userData?.userRole?.name && (
                    <Chip
                      icon={<RoleIcon sx={{ fontSize: '14px !important', color: `${T.teal} !important` }} />}
                      label={userData.userRole.name}
                      size="small"
                      sx={{ mt: 0.75, bgcolor: T.tealBg, color: T.teal, fontWeight: 600, fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              </Box>

              {/* Info rows */}
              <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

                <SectionLabel>Personal details</SectionLabel>
                <InfoRow icon={EmailIcon}  label="Email"         value={userData.email} />
                <InfoRow icon={PhoneIcon}  label="Mobile"        value={userData.mobileNo} />
                <InfoRow icon={GenderIcon} label="Gender"        value={userData.gender} />
                <InfoRow icon={CakeIcon}   label="Date of birth" value={userData.dob} />

                <Divider sx={{ borderColor: T.border, my: 0.5 }} />

                <SectionLabel>Account</SectionLabel>
                <InfoRow
                  icon={LoginIcon}
                  label="Total logins"
                  value={String(userData.noOfLogin ?? 0)}
                  onClick={() => setShowHistory(true)}
                />

              </Box>

              {/* Actions */}
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2.5, sm: 3 }, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  fullWidth startIcon={<EditIcon />}
                  onClick={() => navigate(Constants.EDIT_USER_PROFILE_ROUTE, { state: { userData } })}
                  sx={{
                    py: 1.3, bgcolor: T.teal, color: '#fff', fontWeight: 700,
                    borderRadius: 2, textTransform: 'none', fontSize: '0.95rem',
                    '&:hover': { bgcolor: T.tealHover },
                  }}
                >
                  Edit Profile
                </Button>
                <Button
                  fullWidth startIcon={<LockIcon />}
                  onClick={() => setShowChangePw(true)}
                  sx={{
                    py: 1.3,
                    border: `1px solid ${T.glassBorder}`,
                    color: T.textMuted, borderRadius: 2, textTransform: 'none', fontWeight: 500,
                    '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg },
                  }}
                >
                  Change Password
                </Button>
              </Box>

            </Box>
          </motion.div>
        )}
      </Container>

      <ChangePasswordDialog open={showChangePw} onClose={() => setShowChangePw(false)} />
      <LoginHistoryDialog   open={showHistory}  onClose={() => setShowHistory(false)} />
    </Box>
  );
};

export default Profile;
