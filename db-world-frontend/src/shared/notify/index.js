/**
 * notify — the single, app-wide way to show a transient toast.
 *
 * Wraps notistack's standalone dispatchers so it works from anywhere (components,
 * hooks, services, axios interceptors) with no `useSnackbar()` hook. The look comes
 * from GlassSnackbar (see NotifyProvider); this module only decides *what* to show.
 *
 * Usage:
 *   notify.success('Saved')
 *   notify.error('Upload failed', { action: { label: 'Retry', onClick: retry } })
 *   const k = notify.loading('Uploading…'); …; notify.update(k, 'Done', { variant: 'success' })
 *   await notify.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Save failed' })
 */
import { enqueueSnackbar, closeSnackbar } from 'notistack';
import { haptic } from '@shared/platform/platform';
import { getActiveThemeMode } from '@shared/theme';

const DEFAULT_DURATION = 3500;

/**
 * @param {string} message
 * @param {object} [opts]
 * @param {'success'|'error'|'warning'|'info'|'default'|'loading'} [opts.variant]
 * @param {number} [opts.duration]  auto-dismiss ms (ignored when persist)
 * @param {boolean} [opts.persist]  keep until dismissed
 * @param {string} [opts.title]     bold heading above the message
 * @param {{label: string, onClick: Function}} [opts.action]  inline action button
 * @param {Function} [opts.onClose]
 * @returns {string|number} snackbar key (pass to notify.dismiss / notify.update)
 */
function show(message, { variant = 'default', duration, persist = false, title, action, onClose } = {}) {
  const autoHideDuration = persist ? null : (duration ?? DEFAULT_DURATION);
  return enqueueSnackbar(message, {
    variant,
    persist,
    autoHideDuration,
    onClose,
    title,
    toastAction: action,
    dbProgress: persist ? 0 : autoHideDuration,
    // Capture the theme of the surface firing the toast, so it matches even though the toast
    // host is mounted once at the (global-themed) root, outside the admin theme scope.
    dbMode: getActiveThemeMode(),
  });
}

export const notify = {
  success: (message, opts) => { haptic.success(); return show(message, { ...opts, variant: 'success' }); },
  error:   (message, opts) => { haptic.error();   return show(message, { ...opts, variant: 'error' }); },
  warning: (message, opts) => { haptic.warning(); return show(message, { ...opts, variant: 'warning' }); },
  info:    (message, opts) => show(message, { ...opts, variant: 'info' }),
  message: (message, opts) => show(message, { ...opts, variant: 'default' }),
  /** Persistent spinner toast; returns a key to dismiss/update when the work finishes. */
  loading: (message, opts) => show(message, { ...opts, variant: 'loading', persist: true }),
  dismiss: (key) => closeSnackbar(key),
  /** Replace a toast (e.g. a loading one) with a fresh message. */
  update:  (key, message, opts) => { closeSnackbar(key); return show(message, opts); },
  /** Show loading → success/error around a promise (or a () => promise). */
  promise: async (input, { loading = 'Working…', success = 'Done', error = 'Something went wrong' } = {}) => {
    const key = notify.loading(loading);
    try {
      const result = await (typeof input === 'function' ? input() : input);
      notify.dismiss(key);
      notify.success(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (e) {
      notify.dismiss(key);
      notify.error(typeof error === 'function' ? error(e) : error);
      throw e;
    }
  },
};

export default notify;
