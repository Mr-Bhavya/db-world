package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.LoginRequest;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.LoginDataDto;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.security.JwtHelper;
import com.db.dbworld.services.Impl.UserDetailImpl;
import com.db.dbworld.services.LoginDataService;
import com.db.dbworld.services.UserService;
import jakarta.validation.Valid;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

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
    private JwtHelper helper;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtHelper jwtHelper;

    @Autowired
    private LoginDataService loginDataService;

    @Autowired
    private ModelMapper modelMapper;

    @PostMapping("/register")
    public ApiResponse<String> registerNewUser(@Valid @RequestBody UserDto userDto) {
        List<UserDto> newUserDtoList = this.userService.createUser(Collections.singletonList(userDto));
        log.info("New User registered. Details: {} ", newUserDtoList.get(0).toString());
        return new ApiResponse<>(HttpStatus.CREATED, true, newUserDtoList.get(0).toString());
    }


    @PostMapping("/login")
    public ApiResponse<ResponsePayloads.LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest, @RequestHeader HttpHeaders httpHeaders) {

        this.doAuthenticate(loginRequest.getEmail(), loginRequest.getPassword());

        UserDetails userDetails = this.userDetailsService.loadUserByUsername(loginRequest.getEmail());
        String token = this.helper.generateToken(userDetails.getUsername());
        //Update login details in userAppData
        if (token != null) {
            this.updateUserLoginDetail((UserDetailImpl) userDetails, httpHeaders.get("user-agent").get(0));
        }
        ResponsePayloads.LoginResponse loginResponse = new ResponsePayloads.LoginResponse(token, (UserDetailImpl) userDetails);
        return new ApiResponse<>(HttpStatus.OK, true, loginResponse);
    }

    private void doAuthenticate(String email, String password) {
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(email, password);
        try {
            authenticationManager.authenticate(authentication);
        }
        catch (BadCredentialsException ex){
            throw new BadCredentialsException("Invalid username and password.");
        }
        catch (AuthenticationException ex){
            throw new BadCredentialsException(ex.getMessage());
        }
    }

    private void updateUserLoginDetail(UserDetailImpl userDetails, String userAgent){
        LoginDataDto newLoginData = this.loginDataService.addAgentByUserId(userAgent, userDetails.getUserId());
        Integer totalNumberOfLogin = this.loginDataService.totalNumberOfLogin(userDetails.getUserId());
        log.info("***** User [{}] is logged in using [{}]. Total No Of Login: {} *****", userDetails.getUsername(), userAgent, totalNumberOfLogin);
    }

}
