// Feature flag for the native (SurfaceView+Compose) Android player. While it's being built,
// default OFF so the shipping TextureView path is unchanged. Flip via localStorage
// (dbworld.nativePlayer = '1') for on-device testing; hard-enable here when parity passes.
import { Capacitor } from '@capacitor/core';

export function isNativePlayerEnabled() {
  if (Capacitor.getPlatform() !== 'android') return false;
  try { return localStorage.getItem('dbworld.nativePlayer') === '1'; } catch { return false; }
}
