package com.db.dbworld.payloads;

import lombok.*;
import org.springframework.security.core.userdetails.UserDetails;

@Getter
@Setter
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private UserDetails user;
}
