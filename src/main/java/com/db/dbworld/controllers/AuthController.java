package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.JwtRequest;
import com.db.dbworld.payloads.JwtResponse;
import com.db.dbworld.payloads.UserDto;
import com.db.dbworld.security.JwtHelper;
import com.db.dbworld.services.UserService;
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

    private Logger logger = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/register")
    public ResponseEntity<JwtResponse> registerNewUser(@RequestBody UserDto userDto) {

        return null;
    }


    @PostMapping("/login")
    public ApiResponse login(@RequestBody JwtRequest request) {

        this.doAuthenticate(request.getEmail(), request.getPassword());

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.getEmail());
        String token = this.helper.generateToken(userDetails.getUsername());

//        JwtResponse response = JwtResponse.builder().token(token)
//                .user(userDetails).build();

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
