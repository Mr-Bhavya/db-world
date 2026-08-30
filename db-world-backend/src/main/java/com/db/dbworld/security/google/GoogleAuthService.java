package com.db.dbworld.security.google;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.security.auth.AuthenticationService;
import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.dto.SessionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Turns a verified Google identity into a DB World session.
 *
 * <p>Google is only an identity provider here — it proves who someone is, and then the normal
 * session machinery takes over via {@link AuthenticationService#issueSession}. Nothing about
 * the token model changes: a Google sign-in produces exactly the same access token and
 * rotating refresh token as a password sign-in.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class GoogleAuthService {

    private final GoogleIdTokenVerifier verifier;
    private final UserRepository userRepository;
    private final UserRoleRepository roleRepository;
    private final AuthenticationService authenticationService;
    private final PasswordEncoder passwordEncoder;

    /** Verifies the ID token, resolves it to an account, and starts a session. */
    @Transactional
    public AuthToken signIn(final String idToken, final SessionContext context) {
        final GoogleIdentity identity = verifier.verify(idToken);
        final UserEntity user = resolveAccount(identity);

        if (!user.isEnabled()) {
            log.warn("Google sign-in rejected: account disabled for [{}]", user.getEmail());
            throw new DisabledException("Account is disabled");
        }
        if (!user.isAccountNonLocked()) {
            log.warn("Google sign-in rejected: account locked for [{}]", user.getEmail());
            throw new LockedException("Account is locked");
        }

        final AuthToken tokens = authenticationService.issueSession(user, context);
        authenticationService.recordLogin(user, context.userAgent());
        return tokens;
    }

    /**
     * Finds the account this Google identity belongs to, linking or creating as needed.
     *
     * <p>Matching is by {@code sub} first and email only as a fallback, because {@code sub} is
     * the stable identifier — an email address can be changed on the Google side, and matching
     * on it alone would strand the user with a second account.
     */
    private UserEntity resolveAccount(final GoogleIdentity identity) {
        final Optional<UserEntity> bySub = userRepository.findByGoogleSub(identity.subject());
        if (bySub.isPresent()) {
            return refreshProfile(bySub.get(), identity);
        }

        final Optional<UserEntity> byEmail = userRepository.findByEmail(identity.email());
        if (byEmail.isPresent()) {
            final UserEntity existing = byEmail.get();
            if (existing.hasGoogleLinked()) {
                // The email matches but is already tied to a different Google account. Linking
                // anyway would hand this account to whoever holds the newer Google identity.
                log.error("Google sign-in refused for [{}]: already linked to a different Google account",
                        existing.getEmail());
                throw new DbWorldException(HttpStatus.CONFLICT,
                        "This email is already linked to a different Google account. "
                                + "Sign in with your password instead.");
            }
            requireLinkIsSafe(existing);

            log.info("Linking Google identity to existing account [{}]", existing.getEmail());
            existing.setGoogleSub(identity.subject());
            existing.setEmailVerified(true);
            return refreshProfile(existing, identity);
        }

        return createAccount(identity);
    }

    /**
     * Refuses to silently absorb an account whose email nobody ever proved.
     *
     * <p>Google verifying the address proves the CALLER owns the mailbox. It says nothing about
     * the local account that happens to share the address — and registration does not verify
     * emails, so anyone can create one against an address they do not own. Linking on the
     * strength of a matching string alone gives this attack:
     *
     * <ol>
     *   <li>Attacker registers with victim@example.com and a password they choose.</li>
     *   <li>The victim later signs in with Google.</li>
     *   <li>Google is linked to the attacker's account, and the victim lands inside it —
     *       then files documents in a wallet and passwords in a vault the attacker can open.</li>
     * </ol>
     *
     * <p>So a local account is only absorbed silently when it has nothing to hijack (no
     * password) or its address has actually been proven. Otherwise the caller has to present
     * the password, via {@link #linkWithPassword}. A password-less account is safe because there
     * is no credential for anyone else to already hold.
     */
    private void requireLinkIsSafe(final UserEntity existing) {
        if (!existing.hasPassword() || existing.isEmailVerified()) {
            return;
        }
        log.warn("Refusing to auto-link Google to [{}]: the account has a password and its "
                + "email was never verified", existing.getEmail());
        throw new DbWorldException(HttpStatus.CONFLICT,
                "An account already exists for this email. Enter its password once to connect "
                        + "Google, or reset the password if it is not yours.");
    }

    /**
     * Completes the link that {@link #requireLinkIsSafe} held back, given the account password.
     *
     * <p>Knowing the password proves the caller owns the local account; the Google token proves
     * they own the mailbox. Both sides are now established, which is exactly the evidence
     * verification would have provided up front.
     */
    @Transactional
    public AuthToken linkWithPassword(final String idToken, final String password,
                                      final SessionContext context) {
        final GoogleIdentity identity = verifier.verify(idToken);

        final UserEntity user = userRepository.findByEmail(identity.email())
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND,
                        "No account exists for this email"));

        if (user.hasGoogleLinked()) {
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "This account is already linked to a Google account");
        }
        if (!user.hasPassword() || password == null
                || !passwordEncoder.matches(password, user.getPassword())) {
            log.warn("Google link refused for [{}]: password did not match", user.getEmail());
            throw new BadCredentialsException("Incorrect password");
        }
        if (!user.isEnabled() && !user.isPendingDeletion()) {
            throw new DisabledException("Account is disabled");
        }
        if (!user.isAccountNonLocked()) {
            throw new LockedException("Account is locked");
        }

        user.setGoogleSub(identity.subject());
        user.setEmailVerified(true);
        final UserEntity linked = refreshProfile(user, identity);
        log.warn("Google linked to [{}] after password confirmation", linked.getEmail());

        final AuthToken tokens = authenticationService.issueSession(linked, context);
        authenticationService.recordLogin(linked, context.userAgent());
        return tokens;
    }

    /** Creates a Google-only account: no password, VIEWER role, mailbox already proven. */
    private UserEntity createAccount(final GoogleIdentity identity) {
        final RoleEntity viewer = roleRepository.findByName(Role.VIEWER);
        if (viewer == null) {
            log.error("Google sign-up failed: default VIEWER role missing — initialization broken");
            throw new DbWorldException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Sign-up is unavailable right now");
        }

        final UserEntity user = new UserEntity();
        user.setEmail(identity.email());
        user.setGoogleSub(identity.subject());
        user.setEmailVerified(true);
        user.setRole(viewer);
        // Deliberately left null: this account has no password credential. Every password
        // check must treat null as "no local credential" rather than encoding an empty string,
        // which would create a guessable password.
        user.setPassword(null);
        applyNames(user, identity);
        user.setAvatarUrl(identity.pictureUrl());

        final UserEntity saved = userRepository.save(user);
        log.info("Created account [{}] (id={}) from Google sign-in", saved.getEmail(), saved.getUserId());
        return saved;
    }

    /**
     * Keeps the locally cached Google profile fields current, and restores an account that is
     * sitting in its deletion grace window — signing back in is the documented way to undo a
     * deletion, so it has to work through Google too, not just through a password.
     */
    private UserEntity refreshProfile(final UserEntity user, final GoogleIdentity identity) {
        if (user.isPendingDeletion()) {
            log.warn("Account [{}] restored from pending deletion via Google sign-in", user.getEmail());
            user.setDeletedAt(null);
            user.setPurgeAfter(null);
            user.setEnabled(true);
        }
        if (identity.pictureUrl() != null && !identity.pictureUrl().equals(user.getAvatarUrl())) {
            user.setAvatarUrl(identity.pictureUrl());
        }
        if (isBlank(user.getFirstName()) || isBlank(user.getLastName())) {
            applyNames(user, identity);
        }
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    /**
     * Fills in names from the token. Google may send only {@code name}, so it is split as a
     * fallback, and the columns cap at 20 characters.
     */
    private void applyNames(final UserEntity user, final GoogleIdentity identity) {
        String first = identity.givenName();
        String last = identity.familyName();

        if (isBlank(first) && !isBlank(identity.name())) {
            final String[] parts = identity.name().trim().split("\\s+", 2);
            first = parts[0];
            if (isBlank(last) && parts.length > 1) {
                last = parts[1];
            }
        }
        if (isBlank(first)) {
            first = identity.email().split("@")[0];
        }
        if (isBlank(last)) {
            last = "-"; // the column is NOT NULL-ish in practice and the UI renders "First Last"
        }

        user.setFirstName(truncate(first, 20));
        user.setLastName(truncate(last, 20));
    }

    private static boolean isBlank(final String value) {
        return value == null || value.isBlank();
    }

    private static String truncate(final String value, final int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
