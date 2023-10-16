package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.LoginRequest;
import com.db.dbworld.payloads.UserDto;
import com.db.dbworld.security.JwtHelper;
import com.db.dbworld.services.UserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtHelper helper;

    @Autowired
    private UserService userService;

    private final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/register")
    public ApiResponse registerNewUser(@Valid @RequestBody UserDto userDto) {
        UserDto newUserDto = this.userService.registerUser(userDto);
        return new ApiResponse(HttpStatus.CREATED, true, newUserDto);
    }


    @PostMapping("/login")
    public ApiResponse login(@Valid @RequestBody LoginRequest loginRequest) {

        this.doAuthenticate(loginRequest.getEmail(), loginRequest.getPassword());

        UserDetails userDetails = this.userDetailsService.loadUserByUsername(loginRequest.getEmail());
        String token = this.helper.generateToken(userDetails.getUsername());

        Map<String, Object> jwtResponse = new HashMap<>();
        jwtResponse.put("token", token);
        jwtResponse.put("user", userDetails);

        return new ApiResponse(HttpStatus.OK, true, jwtResponse);
    }

    private void doAuthenticate(String email, String password) {
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(email, password);
        try {
            authenticationManager.authenticate(authentication);
        }catch (BadCredentialsException ex){
            throw new BadCredentialsException("Invalid username and password.");
        }
    }


}
