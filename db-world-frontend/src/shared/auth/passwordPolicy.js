/**
 * Minimum password length, mirroring the backend's `@Size(min = 8, max = 100)` on
 * CreateUserRequest / ChangePasswordRequest / AdminPasswordRequest / UpdateUserRequest.
 *
 * It was 6 on both sides, against a login endpoint with no rate limiting at all — the weakest
 * link on the web side. 8 is the NIST SP 800-63B floor; `LoginRateLimiter` closes the other half.
 *
 * Lives here because the same number was written out by hand in five unrelated places (the
 * register form, the profile change-password form, the reset-password page and two admin Zod
 * schemas). The server is the real authority, and the client cannot import a Java annotation — but
 * at least the client can now disagree with the server in exactly ONE place instead of five, and a
 * mismatch shows up as a server error where a helpful inline message should have been.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Shared copy so every field says the same thing. */
export const MIN_PASSWORD_MESSAGE = `Min ${MIN_PASSWORD_LENGTH} characters`;
