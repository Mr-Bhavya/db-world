import { Drawer, Box, Typography, Chip, IconButton, Skeleton, Avatar, Button, CircularProgress, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import WcIcon from '@mui/icons-material/Wc';
import CakeIcon from '@mui/icons-material/Cake';
import LoginIcon from '@mui/icons-material/Login';
import BadgeIcon from '@mui/icons-material/Badge';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DevicesIcon from '@mui/icons-material/Devices';
import KeyIcon from '@mui/icons-material/VpnKey';
import LogoutIcon from '@mui/icons-material/Logout';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Autorenew';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useUserStore } from '../stores/useUserStore';
import { getUserById, getUserSessions, revokeUserSessions, setUserStatus } from '../api/adminApi';
import { useT } from '@shared/theme';
import { ROLE_COLORS } from './constants';
import { canonicalGender } from './formFields';
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

const SectionLabel = ({ children, action }) => {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2.5, mb: 1.5 }}>
      <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: T.textFaint }}>{children}</Typography>
      {action}
    </Box>
  );
};

export default function UserDetailDrawer() {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { drawerUserId, closeDrawer, openModal } = useUserStore();
  const open = Boolean(drawerUserId);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', drawerUserId],
    queryFn:  () => getUserById(drawerUserId),
    enabled:  open,
  });

  const { data: sessions } = useQuery({
    queryKey: ['userSessions', drawerUserId],
    queryFn:  () => getUserSessions(drawerUserId),
    enabled:  open,
  });

  const { mutate: revoke, isPending: revoking } = useMutation({
    mutationFn: () => revokeUserSessions(drawerUserId),
    onSuccess: (res) => {
      enqueueSnackbar(res?.message ?? 'Sessions revoked', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['userSessions', drawerUserId] });
    },
    onError: () => enqueueSnackbar('Failed to revoke sessions', { variant: 'error' }),
  });

  const { mutate: toggleStatus, isPending: togglingStatus } = useMutation({
    mutationFn: (enabled) => setUserStatus(drawerUserId, enabled),
    onSuccess: (res) => {
      enqueueSnackbar(res?.message ?? 'Status updated', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['user', drawerUserId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userSessions', drawerUserId] });
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to update status', { variant: 'error' }),
  });

  const role = user?.userRole?.name ?? 'VIEWER';
  const activeCount = sessions?.activeCount ?? 0;
  const loginHistory = sessions?.loginHistory ?? [];
  const isEnabled = user?.enabled !== false;
  const statusChip = user?.enabled === false
    ? { label: 'Disabled', color: '#ef4444' }
    : { label: 'Active', color: '#10b981' };

  const handleRevoke = () => {
    if (window.confirm('Revoke all sessions? The user will be logged out on every device.')) revoke();
  };

  const handleToggleStatus = () => {
    if (isEnabled && !window.confirm('Disable this user? They will be logged out and cannot sign in.')) return;
    toggleStatus(!isEnabled);
  };

  return (
    <Drawer anchor="right" open={open} onClose={closeDrawer}
      PaperProps={{ sx: { width: { xs: '100vw', sm: 440 }, bgcolor: T.sidebar, borderLeft: `1px solid ${T.glassBorder}`, color: T.textPrimary } }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: `1px solid ${T.border}` }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>User Details</Typography>
        <Box>
          {user && (
            <Tooltip title={isEnabled ? 'Disable user' : 'Enable user'}>
              <span>
                <IconButton onClick={handleToggleStatus} disabled={togglingStatus}
                  sx={{ color: isEnabled ? '#f59e0b' : '#10b981', mr: 0.5 }}>
                  {togglingStatus ? <CircularProgress size={16} /> : (isEnabled ? <BlockIcon sx={{ fontSize: 18 }} /> : <LockOpenIcon sx={{ fontSize: 18 }} />)}
                </IconButton>
              </span>
            </Tooltip>
          )}
          {drawerUserId && (
            <Tooltip title="Edit user">
              <IconButton onClick={() => openModal('edit', drawerUserId)} sx={{ color: T.textMuted, mr: 0.5 }}>
                <EditIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={closeDrawer} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
        </Box>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1, gap: 1 }}>
              <Avatar sx={{ width: 72, height: 72, bgcolor: T.teal, fontSize: 28, fontWeight: 700, border: `3px solid ${T.glassBorder}` }}>
                {(user.firstName?.[0] ?? '?').toUpperCase()}
              </Avatar>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: T.textPrimary }}>{user.firstName} {user.lastName}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip label={role} size="small" sx={{ bgcolor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}40`, fontWeight: 700 }} />
                <Chip label={statusChip.label} size="small" sx={{ bgcolor: `${statusChip.color}20`, color: statusChip.color, border: `1px solid ${statusChip.color}40`, fontWeight: 700 }} />
                {user.noOfLogin != null && (
                  <Chip label={`${user.noOfLogin} logins`} size="small" sx={{ bgcolor: T.tealBg, color: T.teal, border: `1px solid ${T.glassBorderHover}`, fontWeight: 600 }} />
                )}
                <Chip label={`${activeCount} active`} size="small" sx={{ bgcolor: `${activeCount ? '#10b981' : T.textFaint}18`, color: activeCount ? '#10b981' : T.textMuted, border: `1px solid ${activeCount ? '#10b98140' : T.border}`, fontWeight: 600 }} />
              </Box>
            </Box>

            {/* Profile */}
            <SectionLabel>Profile</SectionLabel>
            <InfoRow icon={BadgeIcon}         label="User ID"  value={`#${user.userId}`} />
            <InfoRow icon={EmailIcon}         label="Email"    value={user.email} />
            <InfoRow icon={PhoneIcon}         label="Mobile"   value={user.mobileNo} />
            <InfoRow icon={WcIcon}            label="Gender"   value={canonicalGender(user.gender) || user.gender} />
            <InfoRow icon={CakeIcon}          label="DOB"      value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : null} />
            <InfoRow icon={CalendarTodayIcon} label="Joined"   value={user.creationDate ? format(new Date(user.creationDate), 'dd MMM yyyy') : null} />

            {/* Active sessions */}
            <SectionLabel action={
              activeCount > 0 && (
                <Button size="small" onClick={handleRevoke} disabled={revoking}
                  startIcon={revoking ? <CircularProgress size={12} color="inherit" /> : <LogoutIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'none', minWidth: 0, '&:hover': { bgcolor: '#ef444418' } }}>
                  Revoke all
                </Button>
              )
            }>
              Active sessions ({activeCount})
            </SectionLabel>
            {sessions?.sessions?.filter(s => s.active).length ? (
              sessions.sessions.filter(s => s.active).map((s, i) => (
                <Box key={s.id ?? i} sx={{ display: 'flex', gap: 1.5, py: 1, borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
                  <KeyIcon sx={{ fontSize: 14, color: T.teal, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, color: T.textPrimary }}>
                      Issued {s.created ? formatDistanceToNow(new Date(s.created), { addSuffix: true }) : '—'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <RefreshIcon sx={{ fontSize: 12, color: T.textFaint }} />
                      <Typography sx={{ fontSize: 11, color: T.textFaint }}>
                        {(s.refreshCount ?? 0)} access-token refresh{(s.refreshCount ?? 0) === 1 ? '' : 'es'}
                        {s.lastUsed ? ` · last ${formatDistanceToNow(new Date(s.lastUsed), { addSuffix: true })}` : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>
                      Expires {s.expiry ? format(new Date(s.expiry), 'dd MMM yyyy, HH:mm') : '—'}
                    </Typography>
                  </Box>
                </Box>
              ))
            ) : (
              <Typography sx={{ fontSize: 12, color: T.textFaint, py: 1 }}>No active sessions.</Typography>
            )}

            {/* Biometric devices */}
            {(sessions?.biometricDevices?.length ?? 0) > 0 && (
              <>
                <SectionLabel>Biometric devices ({sessions.biometricDevices.length})</SectionLabel>
                {sessions.biometricDevices.map((d, i) => (
                  <Box key={d.deviceId ?? i} sx={{ display: 'flex', gap: 1.5, py: 1, borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
                    <FingerprintIcon sx={{ fontSize: 15, color: d.active ? T.teal : T.textFaint, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, color: T.textPrimary }}>
                        {d.deviceLabel || 'Device'}{d.active ? '' : ' (expired)'}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>
                        Enrolled {d.created ? formatDistanceToNow(new Date(d.created), { addSuffix: true }) : '—'}
                        {d.lastUsed ? ` · last unlock ${formatDistanceToNow(new Date(d.lastUsed), { addSuffix: true })}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </>
            )}

            {/* Login history */}
            {loginHistory.length > 0 && (
              <>
                <SectionLabel>Login history (last {Math.min(loginHistory.length, 8)})</SectionLabel>
                {loginHistory.slice(0, 8).map((l, i) => {
                  const { browser, device } = parseAgent(l.agent);
                  const date = l.date ? new Date(l.date) : null;
                  return (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, py: 1.25, borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                      <LoginIcon sx={{ fontSize: 14, color: T.teal, mt: 0.25, flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
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
