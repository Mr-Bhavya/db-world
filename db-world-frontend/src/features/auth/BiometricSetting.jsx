import React, { useEffect, useState } from 'react';
import { Box, Switch, Typography, CircularProgress } from '@mui/material';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { haptic } from '@shared/platform/platform';
import {
  isBiometricAvailable, isBiometricEnabled, enableBiometric, disableBiometric,
} from '@platform/android/biometric';

/**
 * Profile setting row to turn fingerprint/face unlock on or off. Renders nothing unless the device
 * has biometrics available (so users without hardware/enrollment never see a dead control).
 */
export default function BiometricSetting() {
  const T = useT();
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
        notify.success('Biometric unlock disabled');
      } else {
        await enableBiometric();
        setEnabled(true);
        haptic.success();
        notify.success('Fingerprint/face unlock enabled');
      }
    } catch (_e) {
      notify.error(enabled ? 'Could not disable biometric unlock' : 'Could not enable biometric unlock');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      onClick={() => { if (!busy) toggle(); }}
      role="switch"
      aria-checked={enabled}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.4, borderRadius: 2,
        bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, cursor: busy ? 'default' : 'pointer',
        transition: 'border-color 0.2s, background-color 0.2s',
        '&:hover': { borderColor: T.glassBorderHover },
      }}
    >
      <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: T.tealBg, color: T.teal, flexShrink: 0 }}>
        <FingerprintRoundedIcon sx={{ fontSize: 22 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.text }}>Fingerprint / face unlock</Typography>
        <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
          {enabled ? 'Enabled on this device' : 'Unlock without typing your password'}
        </Typography>
      </Box>
      {busy ? (
        <CircularProgress size={20} sx={{ color: T.teal, mr: 1.2 }} />
      ) : (
        <Switch
          checked={enabled}
          onClick={(e) => e.stopPropagation()}
          onChange={toggle}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': { color: T.teal },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: T.teal, opacity: 0.55 },
          }}
        />
      )}
    </Box>
  );
}
