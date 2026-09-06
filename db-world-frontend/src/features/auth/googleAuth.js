import { Capacitor, registerPlugin } from '@capacitor/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

/**
 * Google Sign-In.
 *
 * The client's only job is to obtain a Google ID token; the backend verifies it against Google's
 * JWKS and mints its own session. Nothing here is trusted server-side, so a compromised client
 * cannot forge an identity — it can only present a token Google actually signed for us.
 *
 * Two paths:
 *
 *   - Native (Android/iOS): the FirebaseAuthentication Capacitor plugin, which uses Credential
 *     Manager on Android and ASWebAuthenticationSession on iOS. Install with:
 *
 *       npm i @capacitor-firebase/authentication && npx cap sync
 *
 *   - Web: the Firebase JS SDK popup. `firebase` is already a dependency (FCM uses it), so this
 *     path works today with no new packages.
 *
 * Both reuse the Firebase app instance the messaging module already configures.
 */

const FirebaseAuthentication = registerPlugin('FirebaseAuthentication');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isNative = () => Capacitor.isNativePlatform?.() === true;
const hasNativePlugin = () =>
  isNative() && Capacitor.isPluginAvailable?.('FirebaseAuthentication') === true;

/** True when the Firebase web config needed for the popup flow is present in the bundle. */
const isFirebaseConfigured = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain);

/**
 * Whether this build can actually start a Google sign-in.
 *
 * Native without the plugin returns false rather than silently falling back to the web popup:
 * a popup inside a WebView is blocked by Google's embedded-browser policy (`disallowed_useragent`),
 * so offering the button there would only ever produce a confusing failure.
 */
export const canUseGoogleSignIn = () =>
  isNative() ? hasNativePlugin() : isFirebaseConfigured();

function firebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/** Obtains a Google ID token, or throws with a message worth showing the user. */
async function getGoogleIdToken() {
  if (hasNativePlugin()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result?.credential?.idToken;
    if (!idToken) throw new Error('Google did not return an ID token');
    return idToken;
  }

  if (isNative()) {
    throw new Error('Google Sign-In is not available in this build');
  }

  // Imported lazily so firebase/auth stays out of the bundle for everyone who never
  // presses the button.
  const { GoogleAuthProvider, getAuth, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  // Always ask which account, rather than silently reusing the last one — this app can hold
  // someone else's wallet and vault, so picking the wrong account must be a deliberate act.
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(getAuth(firebaseApp()), provider);
  const idToken = GoogleAuthProvider.credentialFromResult(credential)?.idToken;
  if (!idToken) throw new Error('Google did not return an ID token');
  return idToken;
}

/**
 * Runs the whole flow and returns the backend's login payload
 * (`{ token, refreshToken?, user }`), ready to hand to the auth context's `login`.
 */
export async function signInWithGoogle() {
  const idToken = await getGoogleIdToken();
  try {
    const res = await axiosInstance.post('/api/auth/google', { idToken });
    const payload = res.data?.data;
    if (!payload?.token || !payload?.user) {
      throw new Error('Unexpected response from server');
    }
    return payload;
  } catch (err) {
    // 409 means the server refused to auto-link: an account already holds this address with a
    // password, and the address was never verified, so a match alone does not prove ownership.
    // Attach the token — the caller can complete the link once it has the password, without
    // sending the visitor back through the Google popup a second time.
    if (err?.response?.status === 409) {
      err.needsPasswordLink = true;
      err.idToken = idToken;
    }
    throw err;
  }
}

/**
 * Reads the email out of a Google ID token WITHOUT verifying it.
 *
 * Display only — it decides what the link dialog says, never who anyone is. The server verifies
 * the signature and audience before trusting a single claim.
 */
export function peekEmailFromIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))?.email ?? null;
  } catch {
    return null;
  }
}

/** Asks the backend whether Google Sign-In is configured server-side. Never throws. */
export async function fetchGoogleEnabled() {
  try {
    const res = await axiosInstance.get('/api/auth/providers');
    return res.data?.data?.google === true;
  } catch {
    return false;
  }
}

/**
 * Turns a sign-in failure into something worth showing.
 * A cancelled popup is not an error the user needs told about, so it maps to null.
 */
export function describeGoogleError(err) {
  const code = err?.code ?? '';
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    err?.message?.includes('canceled') ||
    err?.message?.includes('cancelled')
  ) {
    return null;
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google sign-in window. Allow popups and try again.';
  }
  return (
    err?.response?.data?.message ||
    err?.message ||
    'Google sign-in failed. Please try again.'
  );
}
