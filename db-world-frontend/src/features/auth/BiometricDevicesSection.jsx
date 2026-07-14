import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { formatDistanceToNow } from 'date-fns';
import { listDevices, revokeDevice } from '@features/auth/api/biometricApi';

/**
 * Lists the current user's enrolled biometric (fingerprint/face) devices with a per-device revoke.
 * Works on any platform (the enrollments are server-side records), so a user can drop a lost phone's
 * device from the web too. Renders nothing while loading or when there are no enrolled devices.
 */
export default function BiometricDevicesSection() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [devices, setDevices] = useState(null); // null = loading
  const [revoking, setRevoking] = useState(null);

  const load = useCallback(() => {
    listDevices()
      .then((d) => setDevices(Array.isArray(d) ? d : []))
      .catch(() => setDevices([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (deviceId) => {
    setRevoking(deviceId);
    try {
      await revokeDevice(deviceId);
      setDevices((prev) => (prev || []).filter((x) => x.deviceId !== deviceId));
      enqueueSnackbar('Device removed', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to remove device', { variant: 'error' });
    } finally {
      setRevoking(null);
    }
  };

  if (!devices || devices.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.textFaint, mb: 1 }}>
        Biometric devices
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {devices.map((d) => (
          <Box key={d.deviceId} sx={{
            px: 2, py: 1.25, borderRadius: 2, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`,
            display: 'flex', gap: 1.5, alignItems: 'center',
          }}>
            <FingerprintIcon sx={{ fontSize: 20, color: T.teal, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: T.text }}>
                {d.deviceLabel || 'Device'}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: T.textMuted }}>
                {d.lastUsed ? `Last unlock ${formatDistanceToNow(new Date(d.lastUsed), { addSuffix: true })}` : 'Not used yet'}
              </Typography>
            </Box>
            <IconButton size="small" disabled={revoking === d.deviceId} onClick={() => revoke(d.deviceId)}
              aria-label="Remove device" sx={{ color: T.error }}>
              {revoking === d.deviceId ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
