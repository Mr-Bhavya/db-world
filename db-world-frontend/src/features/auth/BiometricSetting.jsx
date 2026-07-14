import React, { useEffect, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import {
  isBiometricAvailable, isBiometricEnabled, enableBiometric, disableBiometric,
} from '@platform/android/biometric';

/**
 * Profile action to turn fingerprint/face unlock on or off. Renders nothing unless the device has
 * biometrics available (so users without hardware/enrollment never see a dead control).
 */
export default function BiometricSetting() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(isBiometricEnabled());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isBiometricAvailable().then(({ available: a }) => { if (!cancelled) setAvailable(a); });
    return () => { cancelled = true; };
  }, []);

  if (!available) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disableBiometric();
        setEnabled(false);
        enqueueSnackbar('Biometric unlock disabled', { variant: 'success' });
      } else {
        await enableBiometric();
        setEnabled(true);
        enqueueSnackbar('Fingerprint/face unlock enabled', { variant: 'success' });
      }
    } catch (_e) {
      enqueueSnackbar(enabled ? 'Could not disable biometric unlock' : 'Could not enable biometric unlock',
        { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      fullWidth
      startIcon={busy ? <CircularProgress size={16} sx={{ color: T.teal }} /> : <FingerprintIcon />}
      onClick={toggle}
      disabled={busy}
      sx={{
        py: 1.3,
        border: `1px solid ${T.glassBorder}`,
        color: T.textMuted, borderRadius: 2, textTransform: 'none', fontWeight: 500,
        '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg },
      }}
    >
      {enabled ? 'Disable fingerprint/face unlock' : 'Enable fingerprint/face unlock'}
    </Button>
  );
}
