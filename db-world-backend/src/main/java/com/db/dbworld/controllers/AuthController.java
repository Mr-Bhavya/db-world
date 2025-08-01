package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.LoginRequest;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.auth.AuthenticationService;
import com.db.dbworld.services.auth.LoginDataService;
import com.db.dbworld.services.user.UserService;
import jakarta.validation.Valid;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static com.db.dbworld.helpers.DbWorldRecords.AuthTokens.REFRESH_TOKEN_COOKIE_NAME;
import static com.db.dbworld.utils.CookieUtil.addCookie;
import static com.db.dbworld.utils.CookieUtil.removeCookie;
import static org.springframework.http.HttpHeaders.SET_COOKIE;

@Log4j2
@RestController
@CrossOrigin
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserService userService;

    @Autowired
    private LoginDataService loginDataService;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private AuthenticationService authenticationService;

    @PostMapping("/register")
    public ApiResponse<String> registerNewUser(@Valid @RequestBody UserDto userDto) {
        List<UserDto> newUserDtoList = this.userService.createUser(Collections.singletonList(userDto));
        log.info("New User registered. Details: {} ", newUserDtoList.get(0).toString());
        return new ApiResponse<>(HttpStatus.CREATED, true, newUserDtoList.get(0).toString());
    }


    @PostMapping("/login")
    public ResponseEntity<ApiResponse<ResponsePayloads.LoginResponse>> login(@Valid @RequestBody LoginRequest loginRequest, @RequestHeader HttpHeaders httpHeaders) {

        final var authTokens = authenticationService.authenticate(Objects.requireNonNull(httpHeaders.get("user-agent")).get(0), loginRequest.getEmail().toLowerCase(), loginRequest.getPassword());
        ResponsePayloads.LoginResponse loginResponse = new ResponsePayloads.LoginResponse(authTokens.accessToken(), authTokens.userEntity());
        return ResponseEntity.ok()
                .header(SET_COOKIE, addCookie(REFRESH_TOKEN_COOKIE_NAME, Objects.requireNonNull(authTokens).refreshToken(), authTokens.refreshTokenTtl()).toString())
                .body(new ApiResponse<>(HttpStatus.OK, true, "Login Success.", loginResponse));
    }

    @PostMapping("/refresh-token")
    public ApiResponse<HashMap<String, String>> refreshAccessToken(@CookieValue(REFRESH_TOKEN_COOKIE_NAME) final String refreshToken) {
        final var authTokens = authenticationService.refreshToken(refreshToken);
        HashMap<String, String> map = new HashMap<>();
        map.put("accessToken", authTokens.accessToken());
        return new ApiResponse<>(HttpStatus.OK, true, map);
    }

    @GetMapping("/verify")
    public ResponseEntity<Map<String, Object>> verifyToken(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String username = authentication.getName(); // from Jwt subject
        Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();

        Map<String, Object> response = new HashMap<>();
        response.put("username", username);
        response.put("roles", authorities.stream().map(GrantedAuthority::getAuthority).toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/log-out")
    public ResponseEntity<Void> revokeToken(@CookieValue(REFRESH_TOKEN_COOKIE_NAME) final String refreshToken) {
        authenticationService.revokeRefreshToken(refreshToken);
        return ResponseEntity.noContent()
                .header(SET_COOKIE, removeCookie(REFRESH_TOKEN_COOKIE_NAME).toString())
                .build();
    }

}
