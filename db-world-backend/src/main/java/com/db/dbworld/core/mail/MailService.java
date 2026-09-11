package com.db.dbworld.core.mail;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Sends the handful of transactional emails the app needs.
 *
 * <p>Inactive until {@code spring.mail.host} is configured, mirroring how {@code FcmPushSender}
 * treats a missing service account: a developer without SMTP gets a logged link instead of a
 * startup failure. {@link #isActive()} lets callers tell the user honestly that the mail could
 * not be sent, rather than claiming to have sent it into a void.
 *
 * <p>Sending is {@code @Async} because SMTP can block for seconds against a slow relay, and no
 * user-facing request should wait on that — least of all password reset, whose response must be
 * identical whether or not the address exists (see {@code AccountRecoveryService}).
 */
@Log4j2
@Service
public class MailService {

    private final ObjectProvider<JavaMailSender> senderProvider;
    private final String from;
    private final String fromName;
    private final boolean configured;

    public MailService(final ObjectProvider<JavaMailSender> senderProvider,
                       @Value("${spring.mail.host:}") final String host,
                       @Value("${app.mail.from:no-reply@db-world.in}") final String from,
                       @Value("${app.mail.from-name:DB World}") final String fromName) {
        this.senderProvider = senderProvider;
        this.from = from;
        this.fromName = fromName;
        this.configured = host != null && !host.isBlank();

        if (configured) {
            log.info("Mail ACTIVE (from={} <{}>)", fromName, from);
        } else {
            log.warn("Mail INACTIVE — spring.mail.host is unset. Verification and password-reset "
                    + "links will be logged at WARN instead of sent.");
        }
    }

    /** True when SMTP is configured. Callers should surface a clear error rather than pretend. */
    public boolean isActive() {
        return configured && senderProvider.getIfAvailable() != null;
    }

    /**
     * Sends an HTML email. Never throws — a mail failure must not roll back the transaction that
     * issued the token, or the user would be left with a token they can never receive AND an
     * error, when the honest outcome is "we could not send it, try again".
     *
     * @return true if the message was handed to the SMTP server
     */
    @Async("taskExecutor")
    public void send(final String to, final String subject, final String htmlBody) {
        sendSync(to, subject, htmlBody);
    }

    /** Synchronous variant, for callers that need to know whether it worked. */
    public boolean sendSync(final String to, final String subject, final String htmlBody) {
        final JavaMailSender sender = senderProvider.getIfAvailable();
        if (!configured || sender == null) {
            // Deliberately loud and complete: on a dev box this log line IS the delivery
            // mechanism, so truncating it would make the flow untestable without SMTP.
            log.warn("Mail not configured — would have sent to [{}] subject [{}]:\n{}",
                    to, subject, htmlBody);
            return false;
        }
        try {
            final MimeMessage message = sender.createMimeMessage();
            final MimeMessageHelper helper =
                    new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            helper.setFrom(from, fromName);
            sender.send(message);
            log.info("Sent [{}] to [{}]", subject, to);
            return true;
        } catch (Exception e) {
            log.error("Failed to send [{}] to [{}]: {}", subject, to, e.toString());
            return false;
        }
    }
}
