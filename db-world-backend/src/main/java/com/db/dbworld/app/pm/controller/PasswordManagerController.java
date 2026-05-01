package com.db.dbworld.app.pm.controller;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.mapper.CredentialMapper;
import com.db.dbworld.app.pm.service.PasswordManagerService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.*;

@Log4j2
@RestController
@RequestMapping("/api/pm")
@RequiredArgsConstructor
public class PasswordManagerController {

    private final PasswordManagerService passwordManagerService;
    private final CredentialMapper       credentialMapper;

    @GetMapping("/")
    @AnyRole
    public ApiResponse<List<ResponsePayloads.PasswordManagerResponse>> getPasswordManagerByUser() {
        List<ResponsePayloads.PasswordManagerResponse> responses = passwordManagerService
                .getPasswordManagerByUser().stream().map(dto -> {
                    ResponsePayloads.PasswordManagerResponse r = new ResponsePayloads.PasswordManagerResponse();
                    r.setId(dto.getId());
                    r.setHost(dto.getHost().getName());
                    r.setCredentials(dto.getCredentials());
                    return r;
                }).toList();
        return ApiResponse.success(responses);
    }

    @PostMapping("/")
    @AnyRole
    public ApiResponse<Void> addCredentialByUser(@RequestBody RequestPayloads.AddCredential addCredential) {
        try {
            String host = new URL(addCredential.getUrl().toLowerCase()).getHost();
            CredentialDto credential = credentialMapper.fromAddCredential(addCredential);
            passwordManagerService.addCredential(host, credential);
            return ApiResponse.success("Credential is added.");
        } catch (MalformedURLException ex) {
            throw new DbWorldException("Invalid URL format: " + ex.getMessage());
        }
    }

    @PostMapping("/credentials")
    @AnyRole
    public ApiResponse<Map<String, Object>> addCredentialsByUser(
            @RequestBody List<RequestPayloads.AddCredential> addCredentials) {
        Map<String, String> failed  = new HashMap<>();
        List<String>        success = new ArrayList<>();
        addCredentials.forEach(c -> {
            try {
                String host = new URL(c.getUrl().toLowerCase()).getHost();
                CredentialDto credential = credentialMapper.fromAddCredential(c);
                passwordManagerService.addCredential(host, credential);
                success.add(c.getUrl() + " / " + c.getUsername());
            } catch (Exception ex) {
                failed.put(c.toString(), ex.getMessage());
                log.error("Failed to add credential {} : {}", c, ex.getMessage());
            }
        });
        return ApiResponse.success(Map.of("success", success, "failed", failed));
    }

    @PutMapping("/{pmId}")
    @AnyRole
    public ApiResponse<PasswordManagerDto> updateCredentialByPmId(
            @Valid @NotEmpty @PathVariable String pmId,
            @RequestBody @Valid RequestPayloads.UpdateCredential updateCredential) {
        CredentialDto credential = credentialMapper.fromUpdateCredential(updateCredential);
        return ApiResponse.success("Credential is updated.",
                passwordManagerService.updateCredential(pmId, credential));
    }

    @DeleteMapping("/{pmId}")
    @AnyRole
    public ApiResponse<Void> deletePasswordMangerById(@Valid @NotEmpty @PathVariable String pmId) {
        passwordManagerService.deletePasswordManagerById(pmId);
        return ApiResponse.success("Deleted Successfully.");
    }

    @DeleteMapping("/credential/{credentialId}")
    @AnyRole
    public ApiResponse<Void> deleteCredentialById(@Valid @NotEmpty @PathVariable String credentialId) {
        passwordManagerService.deleteCredentialById(credentialId);
        return ApiResponse.success("Deleted Successfully.");
    }

    @GetMapping("/host")
    @AnyRole
    public ApiResponse<List<String>> getAllHost() {
        return ApiResponse.success(passwordManagerService.getAllHosts());
    }
}
