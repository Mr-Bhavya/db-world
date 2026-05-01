package com.db.dbworld.security.auth.userdetails;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {

        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new UsernameNotFoundException("User not found with email: " + email)
                );

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