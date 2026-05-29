package com.db.dbworld.security.auth.userdetails;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Log4j2
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        log.debug("loadUserByUsername called for email={}", email);

        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    log.warn("UserDetailsService lookup failed: no user with email={}", email);
                    return new UsernameNotFoundException("User not found with email: " + email);
                });

        return new UserDetailsImpl(
                user.getUserId(),
                user.getEmail(),
                user.getPassword(),
                user.getRole().getName().name(),
                user.isAccountNonLocked(),
                user.isEnabled()
        );
    }
}