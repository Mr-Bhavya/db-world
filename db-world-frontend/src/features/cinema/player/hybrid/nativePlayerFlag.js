// Feature flag for the native (SurfaceView+Compose) Android player.
// DEFAULT ON for Android — the native player is used automatically. To fall back to the old
// TextureView player instantly (no rebuild), set localStorage `dbworld.nativePlayer` = '0'.
// (Web always uses the HTML5 player.)
import { Capacitor } from '@capacitor/core';

export function isNativePlayerEnabled() {
  if (Capacitor.getPlatform() !== 'android') return false;
  try { return localStorage.getItem('dbworld.nativePlayer') !== '0'; } catch { return true; }
}
