import { Drawer, Box, Typography, Chip, Divider, IconButton, Skeleton, Avatar } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import WcIcon from '@mui/icons-material/Wc';
import CakeIcon from '@mui/icons-material/Cake';
import LoginIcon from '@mui/icons-material/Login';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DevicesIcon from '@mui/icons-material/Devices';
import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '../stores/useUserStore';
import { getUserById } from '../api/adminApi';
import { useT } from '@shared/theme';
import { ROLE_COLORS } from './constants';
import { format, formatDistanceToNow } from 'date-fns';

function parseAgent(ua) {
  if (!ua) return { browser: 'Unknown', device: 'Unknown' };
  let browser = 'Unknown';
  if      (/Edg\//.test(ua))     browser = 'Edge';
  else if (/OPR\//.test(ua))     browser = 'Opera';
  else if (/Chrome\//.test(ua))  browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua))  browser = 'Safari';
  let device = 'Desktop';
  if      (/iPhone/.test(ua))   device = 'iPhone';
  else if (/iPad/.test(ua))     device = 'iPad';
  else if (/Android/.test(ua))  device = 'Android';
  return { browser, device };
}

const InfoRow = ({ icon: Icon, label, value }) => {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: `1px solid ${T.border}` }}>
      <Icon sx={{ fontSize: 15, color: T.teal, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12, color: T.textMuted, minWidth: 72, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: T.textPrimary, textAlign: 'right', flex: 1, wordBreak: 'break-all' }}>{value ?? '—'}</Typography>
    </Box>
  );
};

export default function UserDetailDrawer() {
  const T = useT();
  const { drawerUserId, closeDrawer, openModal: _openModal } = useUserStore();
  const open = Boolean(drawerUserId);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', drawerUserId],
    queryFn:  () => getUserById(drawerUserId),
    enabled:  open,
  });

  const role = user?.userRole?.roleName ?? 'VIEWER';

  return (
    <Drawer anchor="right" open={open} onClose={closeDrawer}
      PaperProps={{ sx: { width: { xs: '100vw', sm: 420 }, bgcolor: T.sidebar, borderLeft: `1px solid ${T.glassBorder}`, color: T.textPrimary } }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: `1px solid ${T.border}` }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>User Details</Typography>
        <IconButton onClick={closeDrawer} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Skeleton variant="circular" width={64} height={64} sx={{ bgcolor: T.glass, mx: 'auto' }} />
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={36} sx={{ bgcolor: T.glass }} />)}
          </Box>
        ) : user && (
          <>
            {/* Avatar + role */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 1 }}>
              <Avatar sx={{ width: 72, height: 72, bgcolor: T.teal, fontSize: 28, fontWeight: 700, border: `3px solid ${T.glassBorder}` }}>
                {(user.firstName?.[0] ?? '?').toUpperCase()}
              </Avatar>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: T.textPrimary }}>{user.firstName} {user.lastName}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip label={role} size="small" sx={{ bgcolor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}40`, fontWeight: 700 }} />
                {user.noOfLogin != null && (
                  <Chip label={`${user.noOfLogin} logins`} size="small" sx={{ bgcolor: T.tealBg, color: T.teal, border: `1px solid ${T.glassBorderHover}`, fontWeight: 600 }} />
                )}
              </Box>
            </Box>

            {/* Profile section */}
            <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: T.textFaint, mb: 1 }}>Profile</Typography>
            <InfoRow icon={EmailIcon}         label="Email"    value={user.email} />
            <InfoRow icon={PhoneIcon}         label="Mobile"   value={user.mobileNo} />
            <InfoRow icon={WcIcon}            label="Gender"   value={user.gender} />
            <InfoRow icon={CakeIcon}          label="DOB"      value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : null} />
            <InfoRow icon={CalendarTodayIcon} label="Joined"   value={user.creationDate ? format(new Date(user.creationDate), 'dd MMM yyyy') : null} />

            {/* Login history */}
            {user.loginData?.length > 0 && (
              <>
                <Divider sx={{ my: 2.5, borderColor: T.border }} />
                <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: T.textFaint, mb: 1.5 }}>
                  Login History (last {Math.min(user.loginData.length, 5)})
                </Typography>
                {user.loginData.slice(0, 5).map((l, i) => {
                  const { browser, device } = parseAgent(l.loginAgent);
                  const date = l.lastLoginDate ? new Date(l.lastLoginDate) : null;
                  return (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, py: 1.25, borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                      <LoginIcon sx={{ fontSize: 14, color: T.teal, mt: 0.25, flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            <DevicesIcon sx={{ fontSize: 13, color: T.textMuted }} />
                            <Typography sx={{ fontSize: 12, color: T.textPrimary }}>{browser}</Typography>
                            <Typography sx={{ fontSize: 12, color: T.textMuted }}>· {device}</Typography>
                          </Box>
                          {date && (
                            <Typography sx={{ fontSize: 11, color: T.textFaint, flexShrink: 0 }}>
                              {formatDistanceToNow(date, { addSuffix: true })}
                            </Typography>
                          )}
                        </Box>
                        {date && (
                          <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>
                            {format(date, 'dd MMM yyyy, HH:mm')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
