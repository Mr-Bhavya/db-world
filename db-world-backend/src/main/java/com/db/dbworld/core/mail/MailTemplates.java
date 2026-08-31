package com.db.dbworld.core.mail;

/**
 * The transactional emails, as plain text blocks.
 *
 * <p>No template engine: there are two of them, they take one variable each, and a dependency
 * plus a resource-loading path would be more machinery than the content justifies.
 *
 * <p>Everything interpolated here is a URL this server built, never user input — a display name
 * in a subject line is the classic way an HTML email becomes an injection vector.
 */
public final class MailTemplates {

    private MailTemplates() {
    }

    /**
     * Wordmark rather than an image.
     *
     * <p>A logo needs an absolute hosted URL, and most clients block remote images by default —
     * so an image-led header renders as a broken-image icon above the copy for a large share of
     * recipients, on exactly the emails where looking legitimate matters most. Text always
     * renders.
     *
     * <p>Set in the same letterspaced uppercase register as the app's lock screen, and kept to
     * 12px with a hairline under it: this is a letterhead, not a banner. The teal is the brand's
     * one colour and it does not compete with the button, which is far larger and lower down.
     */
    private static final String WORDMARK = """
              <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;
                          text-transform:uppercase;color:#0f766e;margin:0 0 22px;
                          padding-bottom:14px;border-bottom:1px solid #e8e8e6">
                DB World
              </div>
            """;

    private static final String SHELL = """
            <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                        max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
            """ + WORDMARK + """
              <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">%s</h1>
              <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 24px">%s</p>
              <a href="%s" style="display:inline-block;background:#0f766e;color:#fff;
                 text-decoration:none;font-weight:600;font-size:15px;
                 padding:12px 24px;border-radius:8px">%s</a>
              <p style="font-size:13px;line-height:1.6;color:#777;margin:24px 0 0">
                This link expires in %s. If the button does not work, paste this into your browser:<br>
                <span style="color:#0f766e;word-break:break-all">%s</span>
              </p>
              <p style="font-size:13px;line-height:1.6;color:#777;margin:16px 0 0">%s</p>
            </div>
            """;

    public static String verifyEmailSubject() {
        return "Confirm your DB World email address";
    }

    public static String verifyEmail(final String link) {
        return SHELL.formatted(
                "Confirm your email address",
                "Tap the button to confirm this address belongs to you. Until you do, some "
                        + "features stay locked and signing in with Google will ask for your password.",
                link,
                "Confirm email",
                "24 hours",
                link,
                "If you did not create a DB World account, ignore this email — nothing will happen.");
    }

    public static String resetPasswordSubject() {
        return "Reset your DB World password";
    }

    public static String resetPassword(final String link) {
        return SHELL.formatted(
                "Reset your password",
                "Tap the button to choose a new password. Doing so signs you out on every "
                        + "device, so anyone who should not be signed in will be removed.",
                link,
                "Choose a new password",
                "1 hour",
                link,
                "If you did not ask to reset your password, ignore this email — your current "
                        + "password still works, and no one can use this link without your mailbox.");
    }
}
