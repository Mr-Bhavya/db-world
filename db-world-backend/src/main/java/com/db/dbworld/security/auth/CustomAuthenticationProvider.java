package com.db.dbworld.security.auth;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.security.auth.userdetails.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Log4j2
@Component
@RequiredArgsConstructor
public class CustomAuthenticationProvider implements AuthenticationProvider {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {

        String email = authentication.getName();
        String rawPassword = authentication.getCredentials().toString();

        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    log.warn("Login attempt rejected: no user found for email={}", email);
                    return new BadCredentialsException("Invalid email or password");
                });

        String storedPassword = user.getPassword();

        if (!isEncoded(storedPassword)) {
            // 🔥 OLD plaintext password

            if (!storedPassword.equals(rawPassword)) {
                log.warn("Login attempt rejected: plaintext password mismatch for email={}", email);
                throw new BadCredentialsException("Invalid email or password");
            }

            // ✅ MIGRATE
            String encoded = passwordEncoder.encode(rawPassword);
            user.setPassword(encoded);
            userRepository.save(user);
            log.info("Migrated legacy plaintext password to bcrypt for user [{}]", email);

        } else {
            // ✅ NORMAL FLOW

            if (!passwordEncoder.matches(rawPassword, storedPassword)) {
                log.warn("Login attempt rejected: bcrypt mismatch for email={}", email);
                throw new BadCredentialsException("Invalid email or password");
            }
        }

        // Build authenticated user
        UserDetailsImpl userDetails = new UserDetailsImpl(
                user.getUserId(),
                user.getEmail(),
                user.getPassword(),
                user.getRole().getName().name(),
                user.isAccountNonLocked(),
                user.isEnabled()
        );

        return new UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                userDetails.getAuthorities()
        );
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }

    private boolean isEncoded(String password) {
        return password != null && (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$"));
    }
}