package com.db.dbworld.services;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import com.db.dbworld.entities.user.UserEntity;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

@RequiredArgsConstructor
public class JwtService {

    private final String issuer;

    private final Duration ttl;

    private final JwtEncoder jwtEncoder;

    public String generateToken(final UserEntity user) {
        final var issuedAt = Instant.now();

        List<String> roles = user.getRole() != null
                ? List.of(user.getRole().getName()) // adjust based on your setup
                : List.of();

        // Add roles to JWT claims
        final var claimsSet = JwtClaimsSet.builder()
                .subject(user.getEmail())
                .issuer(issuer)
                .issuedAt(issuedAt)
                .expiresAt(issuedAt.plus(ttl))
                .claim("userId", user.getUserId())
                .claim("roles", roles)
                .build();

        return jwtEncoder.encode(JwtEncoderParameters.from(claimsSet)).getTokenValue();
    }


    //retrieve username from jwt token
    public String getUsernameFromToken(String token) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication.getPrincipal() instanceof Jwt jwt) {
//            String email = jwt.getClaimAsString("sub");
//            String role = jwt.getClaimAsString("role");
//            String custom = jwt.getClaimAsString("customClaim");
            return jwt.getClaimAsString("sub"); // or "username" or "email"
        }
        return null;
    }

}
