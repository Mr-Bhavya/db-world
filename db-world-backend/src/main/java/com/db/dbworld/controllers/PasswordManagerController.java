package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.pm.CredentialDto;
import com.db.dbworld.payloads.pm.PasswordManagerDto;
import com.db.dbworld.services.pm.PasswordManagerService;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Log4j2
@CrossOrigin
@RestController
@RequestMapping("/api/pm")
public class PasswordManagerController {

    @Autowired
    private PasswordManagerService passwordManagerService;

    @Autowired
    private ModelMapper modelMapper;

    @GetMapping("/")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<ResponsePayloads.PasswordManagerResponse>> getPasswordManagerByUser(){
        List<PasswordManagerDto> passwordManagerDtos = this.passwordManagerService.getPasswordManagerByUser();

        List<ResponsePayloads.PasswordManagerResponse> passwordManagerResponses = passwordManagerDtos.stream().map(passwordManagerDto -> {
            ResponsePayloads.PasswordManagerResponse passwordManagerResponse = new ResponsePayloads.PasswordManagerResponse();
            passwordManagerResponse.setId(passwordManagerDto.getId());
            passwordManagerResponse.setHost(passwordManagerDto.getHost().getName());
            passwordManagerResponse.setCredentials(passwordManagerDto.getCredentials());
            return passwordManagerResponse;
        }).toList();

        return new ApiResponse<>(HttpStatus.OK, true, passwordManagerResponses);
    }

    @PostMapping("/")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> addCredentialByUser(
            @RequestBody RequestPayloads.AddCredential addCredential
    ){
        try {
            String host = new URL(addCredential.getUrl().toLowerCase()).getHost(); //lower case is required otherwise it differ the IV and give problem to decode.
            CredentialDto credential = modelMapper.map(addCredential, CredentialDto.class);
            passwordManagerService.addCredential(host, credential);
            return new ApiResponse<>(HttpStatus.CREATED, true, "Credential is added.");
        } catch (MalformedURLException ex) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @PostMapping("/credentials")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<Map<String, Object>> addCredentialsByUser(
            @RequestBody List<RequestPayloads.AddCredential> addCredentials
    ){
        Map<String, String> failedCredentials = new HashMap<>();
        List<String> successCredentials = new ArrayList<>();
        Map<String, Object> response = new HashMap<>();
        if(!addCredentials.isEmpty()){
            addCredentials.forEach(addCredential -> {
                try {
                    String host = new URL(addCredential.getUrl().toLowerCase()).getHost(); //lower case is required otherwise it differ the IV and give problem to decode.
                    CredentialDto credential = modelMapper.map(addCredential, CredentialDto.class);
                    passwordManagerService.addCredential(host, credential);
                    successCredentials.add(addCredential.toString());
                    log.info("Success: {}", addCredential.toString());
//                    successIds.add()
//                    return new ApiResponse<>(HttpStatus.CREATED, true, "Credential is added.");
                } catch (Exception ex) {
                    failedCredentials.put(addCredential.toString(), ex.getMessage());
                    log.error("Failed: {}, Error Message: {}", addCredential.toString(), ex.getMessage());
//                    throw new DbWorldException(HttpStatus.BAD_REQUEST, ex.getMessage());
                }
            });
        }
        response.put("success", successCredentials);
        response.put("failed", failedCredentials);
        return new ApiResponse<>(HttpStatus.CREATED, true, response);
    }

    @PutMapping("/{pmId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<PasswordManagerDto> updateCredentialByPmId(
            @Valid @NotEmpty @PathVariable String pmId,
            @RequestBody RequestPayloads.AddCredential addCredential
    ){
        try {
            String host = new URL(addCredential.getUrl().toLowerCase()).getHost(); //lower case is required otherwise it differ the IV and give problem to decode.
            CredentialDto credential = modelMapper.map(addCredential, CredentialDto.class);
            PasswordManagerDto passwordManagerDto = this.passwordManagerService.updateCredential(pmId, credential);
            return new ApiResponse<>(HttpStatus.OK, true, "Credential is updated.", passwordManagerDto);
        } catch (MalformedURLException ex) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @DeleteMapping("/{pmId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> deletePasswordMangerById(
            @Valid @NotEmpty @PathVariable String pmId
    ){
        this.passwordManagerService.deletePasswordManagerById(pmId);
        return new ApiResponse<>(HttpStatus.OK, true, "Deleted Successfully.");
    }

    @DeleteMapping("/credential/{credentialId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> deleteCredentialById(
            @Valid @NotEmpty @PathVariable String credentialId
    ){
        this.passwordManagerService.deleteCredentialById(credentialId);
        return new ApiResponse<>(HttpStatus.OK, true, "Deleted Successfully.");
    }

    @GetMapping("/host")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<String>> getAllHost(){
        return new ApiResponse<>(HttpStatus.OK, true, this.passwordManagerService.getAllHosts());
    }
}
