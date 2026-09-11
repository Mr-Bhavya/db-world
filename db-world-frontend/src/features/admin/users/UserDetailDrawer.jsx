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
import LockIcon from '@mui/icons-material/Lock';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestoreIcon from '@mui/icons-material/Restore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useUserStore } from '../stores/useUserStore';
import {
  getUserById,
  getUserSessions,
  purgeUser,
  restoreUser,
  revokeBiometricDevices,
  revokePushTokens,
  revokeUserSession,
  revokeUserSessions,
  setUserLocked,
  setUserStatus,
  unlinkGoogle,
} from '../api/adminApi';
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
      notify.success(res?.message ?? 'Sessions revoked');
      qc.invalidateQueries({ queryKey: ['userSessions', drawerUserId] });
    },
    onError: () => notify.error('Failed to revoke sessions'),
  });

  /** Every credential/state action refreshes the same three queries, so they share a handler. */
  const invalidateUser = () => {
    qc.invalidateQueries({ queryKey: ['user', drawerUserId] });
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['userSessions', drawerUserId] });
  };

  const adminAction = (mutationFn, successFallback) => ({
    mutationFn,
    onSuccess: (res) => {
      notify.success(res?.message ?? successFallback);
      invalidateUser();
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Action failed'),
  });

  const { mutate: revokeOne, isPending: revokingOne } = useMutation(
    adminAction((familyId) => revokeUserSession(drawerUserId, familyId), 'Session revoked'));

  const { mutate: toggleLock, isPending: togglingLock } = useMutation(
    adminAction((locked) => setUserLocked(drawerUserId, locked), 'Lock updated'));

  const { mutate: doUnlinkGoogle, isPending: unlinkingGoogle } = useMutation(
    adminAction(() => unlinkGoogle(drawerUserId), 'Google unlinked'));

  const { mutate: doRevokeBiometric, isPending: revokingBiometric } = useMutation(
    adminAction(() => revokeBiometricDevices(drawerUserId), 'Biometric devices revoked'));

  const { mutate: doRevokePush, isPending: revokingPush } = useMutation(
    adminAction(() => revokePushTokens(drawerUserId), 'Push registrations revoked'));

  const { mutate: doRestore, isPending: restoring } = useMutation(
    adminAction(() => restoreUser(drawerUserId), 'Account restored'));

  const { mutate: doPurge, isPending: purging } = useMutation(
    adminAction(() => purgeUser(drawerUserId), 'Account purged'));

  const { mutate: toggleStatus, isPending: togglingStatus } = useMutation({
    mutationFn: (enabled) => setUserStatus(drawerUserId, enabled),
    onSuccess: (res) => {
      notify.success(res?.message ?? 'Status updated');
      qc.invalidateQueries({ queryKey: ['user', drawerUserId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userSessions', drawerUserId] });
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to update status'),
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

  const isLocked = user?.accountNonLocked === false;
  const pendingDeletion = Boolean(user?.deletedAt);

  const handleToggleLock = () => {
    if (!isLocked && !window.confirm('Lock this account? Every session ends immediately.')) return;
    toggleLock(!isLocked);
  };

  const handleUnlinkGoogle = () => {
    if (window.confirm('Unlink Google from this account? Their Google sessions will end.')) doUnlinkGoogle();
  };

  const handlePurge = () => {
    // Two prompts on purpose. This is the only irreversible action in the drawer, and it wipes
    // a document wallet and a password vault with no grace window to undo it.
    if (!window.confirm('PERMANENTLY erase this account and all its data? This cannot be undone.')) return;
    if (!window.confirm(`Really purge ${user?.email}? There is no recovery.`)) return;
    doPurge();
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
          {user && (
            <Tooltip title={isLocked ? 'Unlock account' : 'Lock account'}>
              <span>
                <IconButton onClick={handleToggleLock} disabled={togglingLock}
                  sx={{ color: isLocked ? '#10b981' : '#f59e0b', mr: 0.5 }}>
                  {togglingLock ? <CircularProgress size={16} /> : (isLocked ? <LockOpenIcon sx={{ fontSize: 18 }} /> : <LockIcon sx={{ fontSize: 18 }} />)}
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
            {/* Pending deletion — shown first because it changes what every other control means */}
            {pendingDeletion && (
              <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, mb: 2, borderRadius: 2, border: '1px solid #f59e0b60', bgcolor: '#f59e0b14' }}>
                <WarningAmberIcon sx={{ fontSize: 20, color: '#f59e0b', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#f59e0b' }}>
                    Scheduled for deletion
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted, mt: 0.25 }}>
                    Data is erased {user.purgeAfter ? formatDistanceToNow(new Date(user.purgeAfter), { addSuffix: true }) : 'soon'}.
                    Signing in before then restores the account.
                  </Typography>
                  <Button size="small" onClick={() => doRestore()} disabled={restoring}
                    startIcon={restoring ? <CircularProgress size={12} color="inherit" /> : <RestoreIcon sx={{ fontSize: 14 }} />}
                    sx={{ mt: 0.75, fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'none', minWidth: 0, '&:hover': { bgcolor: '#10b98118' } }}>
                    Restore now
                  </Button>
                </Box>
              </Box>
            )}

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
                      {s.platform && s.platform !== 'WEB'
                        ? `DB World app (${s.platform === 'IOS' ? 'iOS' : 'Android'})`
                        : `${parseAgent(s.userAgent).browser} · ${parseAgent(s.userAgent).device}`}
                      {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>
                      Started {s.created ? formatDistanceToNow(new Date(s.created), { addSuffix: true }) : '—'}
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
                  <Tooltip title="Sign this device out">
                    <span>
                      <IconButton size="small" disabled={revokingOne} onClick={() => revokeOne(s.id)}
                        sx={{ color: T.textFaint, '&:hover': { color: '#ef4444' } }}>
                        <LogoutIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))
            ) : (
              <Typography sx={{ fontSize: 12, color: T.textFaint, py: 1 }}>No active sessions.</Typography>
            )}

            {/* Credential control — every other way into the account besides a password */}
            <SectionLabel>Credentials</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Chip
                  size="small"
                  label={user.googleLinked ? 'Google linked' : 'No Google'}
                  sx={{
                    height: 22, fontSize: 11, fontWeight: 600,
                    bgcolor: user.googleLinked ? '#4285F420' : T.glass,
                    color: user.googleLinked ? '#4285F4' : T.textMuted,
                    border: `1px solid ${user.googleLinked ? '#4285F440' : T.border}`,
                  }}
                />
                <Chip
                  size="small"
                  label={user.hasPassword ? 'Password set' : 'No password'}
                  sx={{
                    height: 22, fontSize: 11, fontWeight: 600,
                    bgcolor: user.hasPassword ? T.tealBg : '#f59e0b18',
                    color: user.hasPassword ? T.teal : '#f59e0b',
                    border: `1px solid ${user.hasPassword ? T.glassBorderHover : '#f59e0b40'}`,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                {user.googleLinked && (
                  <Button size="small" onClick={handleUnlinkGoogle} disabled={unlinkingGoogle || !user.hasPassword}
                    startIcon={<LinkOffIcon sx={{ fontSize: 14 }} />}
                    // Disabled without a password: unlinking would leave an account nobody,
                    // including its owner, could ever sign into again.
                    title={user.hasPassword ? 'Unlink Google' : 'Set a password first — Google is the only sign-in method'}
                    sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'none', border: `1px solid ${T.border}` }}>
                    Unlink Google
                  </Button>
                )}
                <Button size="small" onClick={() => doRevokeBiometric()} disabled={revokingBiometric}
                  startIcon={<FingerprintIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'none', border: `1px solid ${T.border}` }}>
                  Revoke biometrics
                </Button>
                <Button size="small" onClick={() => doRevokePush()} disabled={revokingPush}
                  startIcon={<NotificationsOffIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'none', border: `1px solid ${T.border}` }}>
                  Revoke push
                </Button>
                {pendingDeletion && (
                  <Button size="small" onClick={handlePurge} disabled={purging}
                    startIcon={purging ? <CircularProgress size={12} color="inherit" /> : <DeleteForeverIcon sx={{ fontSize: 14 }} />}
                    sx={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'none', border: '1px solid #ef444440' }}>
                    Purge now
                  </Button>
                )}
              </Box>
            </Box>

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
