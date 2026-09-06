import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Android as AndroidIcon,
  Close as CloseIcon,
  Computer as ComputerIcon,
  PhoneIphone as IphoneIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import { notify } from '@shared/notify';
import { getMySessions, revokeAllMySessions, revokeMySession } from './api/accountApi';

const PLATFORM_ICON = {
  ANDROID: AndroidIcon,
  IOS: IphoneIcon,
  WEB: ComputerIcon,
};

/**
 * Turns a User-Agent into something a person can recognise their own device by.
 *
 * Deliberately crude — the goal is only "is this me or someone else", so browser and OS is
 * enough. Order matters: Edge and Opera both claim to be Chrome, and Chrome claims to be Safari.
 */
function describeDevice(userAgent, platform) {
  if (platform === 'ANDROID') return 'DB World app (Android)';
  if (platform === 'IOS') return 'DB World app (iPhone)';
  if (!userAgent) return 'Unknown device';

  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
      : /OPR\//.test(userAgent) ? 'Opera'
      : /Firefox\//.test(userAgent) ? 'Firefox'
      : /Chrome\//.test(userAgent) ? 'Chrome'
      : /Safari\//.test(userAgent) ? 'Safari'
      : 'Browser';

  const os =
    /Windows/.test(userAgent) ? 'Windows'
      : /Android/.test(userAgent) ? 'Android'
      : /iPhone|iPad/.test(userAgent) ? 'iOS'
      : /Mac OS X/.test(userAgent) ? 'macOS'
      : /Linux/.test(userAgent) ? 'Linux'
      : '';

  return os ? `${browser} on ${os}` : browser;
}

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

/**
 * Shows every device signed into this account, with a way to sign each one out.
 *
 * This is the user-facing half of refresh-token rotation: rotation makes a stolen token
 * detectable, and this makes it actionable without needing an admin.
 */
export default function ActiveSessionsDialog({ open, onClose }) {
  const T = useT();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getMySessions()
      .then(setData)
      .catch(() => notify.error('Failed to load your sessions.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleRevoke = useCallback(async (familyId) => {
    setBusyId(familyId);
    try {
      await revokeMySession(familyId);
      notify.success('Signed out of that device.');
      load();
    } catch {
      notify.error('Could not sign that device out.');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const handleRevokeAll = useCallback(async () => {
    setBusyId('all');
    try {
      // keepCurrent: signing the user out of the tab they are looking at would be a surprising
      // outcome for a button labelled "other devices".
      const result = await revokeAllMySessions(true);
      notify.success(`Signed out of ${result?.revoked ?? 0} other devices.`);
      load();
    } catch {
      notify.error('Could not sign out the other devices.');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const sessions = (data?.sessions ?? []).filter((s) => s.active);
  const currentId = data?.currentSessionId;
  const others = sessions.filter((s) => s.id !== currentId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography sx={{ fontWeight: 700, color: T.text, fontSize: '1rem' }}>
          Where you&apos;re signed in
        </Typography>
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
            No active sessions found.
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
              {sessions.map((session) => {
                const isCurrent = session.id === currentId;
                const Icon = PLATFORM_ICON[session.platform] ?? ComputerIcon;
                return (
                  <Box
                    key={session.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px solid ${isCurrent ? T.teal : T.glassBorder}`,
                      bgcolor: isCurrent ? T.tealBg : 'transparent',
                    }}
                  >
                    <Icon sx={{ color: isCurrent ? T.teal : T.textMuted }} />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ color: T.text, fontWeight: 600, fontSize: '0.875rem' }}>
                          {describeDevice(session.userAgent, session.platform)}
                        </Typography>
                        {isCurrent && (
                          <Chip
                            label="This device"
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem', bgcolor: T.teal, color: '#000', fontWeight: 700 }}
                          />
                        )}
                      </Box>
                      <Typography sx={{ color: T.textMuted, fontSize: '0.75rem' }}>
                        {session.ipAddress ? `${session.ipAddress} · ` : ''}
                        Last used {formatWhen(session.lastUsed)}
                      </Typography>
                    </Box>

                    {!isCurrent && (
                      <IconButton
                        size="small"
                        disabled={busyId === session.id}
                        onClick={() => handleRevoke(session.id)}
                        aria-label="Sign out of this device"
                        sx={{ color: T.textMuted, '&:hover': { color: T.red ?? '#ef4444' } }}
                      >
                        {busyId === session.id
                          ? <CircularProgress size={16} sx={{ color: T.textMuted }} />
                          : <LogoutIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </Box>
                );
              })}
            </Box>

            {others.length > 0 && (
              <Button
                fullWidth
                onClick={handleRevokeAll}
                disabled={busyId === 'all'}
                sx={{
                  mt: 2.5,
                  py: 1.1,
                  border: `1px solid ${T.glassBorder}`,
                  borderRadius: 1.7,
                  color: T.textMuted,
                  textTransform: 'none',
                  fontWeight: 650,
                  '&:hover': { borderColor: T.red ?? '#ef4444', color: T.red ?? '#ef4444' },
                }}
              >
                {busyId === 'all'
                  ? <CircularProgress size={18} sx={{ color: T.textMuted }} />
                  : `Sign out of ${others.length} other device${others.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
