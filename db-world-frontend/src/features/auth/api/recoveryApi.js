import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/auth';
const unwrap = (r) => r.data;

/**
 * Asks for a password-reset link.
 *
 * Resolves the same way whether or not the address has an account — the server deliberately
 * gives no signal, so the UI must not invent one either. Showing "no such user" here would
 * hand an attacker a way to enumerate who holds an account.
 */
export const forgotPassword = (email) =>
  axiosInstance.post(`${BASE}/forgot-password`, { email }).then(unwrap);

/** Sets a new password from an emailed link. Signs the account out on every device. */
export const resetPassword = (token, password) =>
  axiosInstance.post(`${BASE}/reset-password`, { token, password }).then(unwrap);

/** Redeems an email-verification link. Public — the recipient is not signed in yet. */
export const confirmEmail = (token) =>
  axiosInstance.post(`${BASE}/verify-email/confirm`, { token }).then(unwrap);

/** Sends the signed-in user a fresh verification link. */
export const resendVerification = () =>
  axiosInstance.post(`${BASE}/verify-email/resend`).then(unwrap);

/**
 * Connects Google to an existing password account whose email was never verified.
 *
 * Plain Google sign-in refuses that case with a 409: a matching email proves the caller owns
 * the mailbox, not the local account. The password supplies the missing half.
 */
export const linkGoogleWithPassword = (idToken, password) =>
  axiosInstance.post(`${BASE}/google/link`, { idToken, password }).then((r) => r.data?.data ?? r.data);
