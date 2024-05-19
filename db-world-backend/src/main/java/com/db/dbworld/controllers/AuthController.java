package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.LoginRequest;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.security.JwtHelper;
import com.db.dbworld.services.Impl.UserDetailImpl;
import com.db.dbworld.services.UserService;
import jakarta.validation.Valid;
import lombok.extern.log4j.Log4j2;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

import java.util.ArrayList;
import java.util.List;

@Log4j2
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

    @Autowired
    private JwtHelper jwtHelper;

    private final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/register")
    public ApiResponse registerNewUser(@Valid @RequestBody UserDto userDto) {
        UserDto newUserDto = this.userService.createUser(userDto);
        log.info("New User registered. Details: ", newUserDto.toString());
        return new ApiResponse(HttpStatus.CREATED, true, newUserDto.toString());
    }


    @PostMapping("/login")
    public ApiResponse login(@Valid @RequestBody LoginRequest loginRequest, @RequestHeader HttpHeaders httpHeaders) {

        this.doAuthenticate(loginRequest.getEmail(), loginRequest.getPassword());

        UserDetails userDetails = this.userDetailsService.loadUserByUsername(loginRequest.getEmail());
        String token = this.helper.generateToken(userDetails.getUsername());
        //Update login details in userAppData
        if (token != null) {
            this.updateUserLoginDetail((UserDetailImpl) userDetails, httpHeaders.get("user-agent").get(0));
        }
        ResponsePayloads.LoginResponse loginResponse = new ResponsePayloads.LoginResponse(token, (UserDetailImpl) userDetails);
        return new ApiResponse(HttpStatus.OK, true, loginResponse);
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
        UserDto.UserAppData userAppData = this.userService.getUserAppDataByUserId((userDetails).getUserId());

        UserDto.UserAppData newUserAppData = userAppData == null ? new UserDto.UserAppData() : userAppData;

        List<UserDto.UserAppData.LoginDetails> loginDetails = userAppData.getLoginDetails() == null ? new ArrayList<>() : userAppData.getLoginDetails();

        UserDto.UserAppData.LoginDetails newLogin = new UserDto.UserAppData.LoginDetails();
        newLogin.setTimeStamp(System.currentTimeMillis());
        newLogin.setUserAgent(userAgent);

        loginDetails.add(newLogin);

        newUserAppData.setNoOfLogin(userAppData.getNoOfLogin() == null ? 1 : userAppData.getNoOfLogin() + 1);
        newUserAppData.setLoginDetails(loginDetails);

        this.userService.updateUserAppDataByUserId(userDetails.getUserId(), newUserAppData);
        log.info("***** User {} is logged in using {} *****", userDetails.getUsername(), userAgent);
    }


}
