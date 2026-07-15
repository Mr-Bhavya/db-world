/**
 * Platform + device context — single source of truth for "where are we running".
 *
 * Drives cross-platform UI decisions (toast anchor, native haptics, safe-area) so
 * individual components don't each re-implement `Capacitor.getPlatform()` checks.
 * Web-safe: haptics no-op off native, viewport helpers guard `window`.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Platform is fixed for the life of the process, so these are constants.
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
export const isAndroid = platform === 'android';
export const isIOS = platform === 'ios';

// Below this width we treat the screen as a phone (native or mobile web).
export const MOBILE_MAX_WIDTH = 600;

export const viewportWidth = () => (typeof window === 'undefined' ? 1024 : window.innerWidth);
export const isMobileViewport = () => viewportWidth() <= MOBILE_MAX_WIDTH;
export const isMobileWeb = () => !isNative && isMobileViewport();
export const isDesktop = () => !isNative && !isMobileViewport();

/**
 * Best toast anchor for the current device/screen. Phones (native or narrow web) get
 * top-center — the bottom edge is the Android gesture/nav zone and the on-screen
 * keyboard's home. Desktop/tablet web keeps the familiar bottom-right.
 */
export const toastAnchor = () =>
  (isNative || isMobileViewport())
    ? { vertical: 'top', horizontal: 'center' }
    : { vertical: 'bottom', horizontal: 'right' };

/** Native haptic feedback. Every method is a safe no-op on web. */
export const haptic = {
  success() { if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); },
  warning() { if (isNative) Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); },
  error()   { if (isNative) Haptics.notification({ type: NotificationType.Error }).catch(() => {}); },
  light()   { if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); },
  medium()  { if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); },
};
