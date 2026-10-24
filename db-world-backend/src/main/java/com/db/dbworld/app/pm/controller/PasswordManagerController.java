package com.db.dbworld.app.pm.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.PasswordHistoryDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.mapper.CredentialMapper;
import com.db.dbworld.app.pm.service.PasswordManagerService;
import com.db.dbworld.app.pm.util.SiteUrl;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.annotations.AnyRole;
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
        return ApiResponse.success(toResponses(passwordManagerService.getPasswordManagerByUser()));
    }

    private static List<ResponsePayloads.PasswordManagerResponse> toResponses(List<PasswordManagerDto> dtos) {
        return dtos.stream().map(dto -> {
            ResponsePayloads.PasswordManagerResponse r = new ResponsePayloads.PasswordManagerResponse();
            r.setId(dto.getId());
            // An entry with no website has no host: label its group with its own name.
            r.setHost(dto.getHost() != null ? dto.getHost().getName() : siteLessLabel(dto));
            r.setCredentials(dto.getCredentials());
            return r;
        }).toList();
    }

    @PostMapping("/")
    @AnyRole
    public ApiResponse<Void> addCredentialByUser(@RequestBody RequestPayloads.AddCredential addCredential) {
        try {
            String host = SiteUrl.hostOf(addCredential.getUrl());
            CredentialDto credential = credentialMapper.fromAddCredential(addCredential);
            credential.setUrl(SiteUrl.stored(addCredential.getUrl()));
            passwordManagerService.addCredential(host, credential);
            return ApiResponse.success("Credential is added.");
        } catch (MalformedURLException ex) {
            log.warn("Rejected addCredential: malformed url={}", addCredential.getUrl(), ex);
            throw new DbWorldException("Invalid URL format: " + ex.getMessage());
        }
    }

    private static String siteLessLabel(PasswordManagerDto dto) {
        return dto.getCredentials() == null ? "Untitled" : dto.getCredentials().stream()
                .map(CredentialDto::getName)
                .filter(n -> n != null && !n.isBlank())
                .findFirst().orElse("Untitled");
    }

    @PostMapping("/credentials")
    @AnyRole
    public ApiResponse<Map<String, Object>> addCredentialsByUser(
            @RequestBody List<RequestPayloads.AddCredential> addCredentials) {
        log.info("Bulk addCredentials: count={}", addCredentials.size());
        Map<String, String> failed  = new HashMap<>();
        List<String>        success = new ArrayList<>();
        addCredentials.forEach(c -> {
            try {
                String host = SiteUrl.hostOf(c.getUrl());
                CredentialDto credential = credentialMapper.fromAddCredential(c);
                credential.setUrl(SiteUrl.stored(c.getUrl()));
                passwordManagerService.addCredential(host, credential);
                success.add(c.getUrl() + " / " + c.getUsername());
            } catch (Exception ex) {
                // Log url + username only — c.toString() may include the password.
                failed.put(c.getUrl() + " / " + c.getUsername(), ex.getMessage());
                log.error("Failed to add credential: url={}, username={}, reason={}",
                        c.getUrl(), c.getUsername(), ex.getMessage(), ex);
            }
        });
        log.info("Bulk addCredentials complete: success={}, failed={}", success.size(), failed.size());
        return ApiResponse.success(Map.of("success", success, "failed", failed));
    }

    @PutMapping("/{pmId}")
    @AnyRole
    public ApiResponse<PasswordManagerDto> updateCredentialByPmId(
            @Valid @NotEmpty @PathVariable String pmId,
            @RequestBody @Valid RequestPayloads.UpdateCredential updateCredential) {
        CredentialDto credential = credentialMapper.fromUpdateCredential(updateCredential);
        credential.setUrl(updateCredential.getUrl() == null ? null
                : Objects.requireNonNullElse(SiteUrl.stored(updateCredential.getUrl()), ""));
        return ApiResponse.success("Credential is updated.",
                passwordManagerService.updateCredential(pmId, credential));
    }

    // Both deletes move to Trash; the entries are removed for good 30 days later (TrashPurgeJob).
    @DeleteMapping("/{pmId}")
    @AnyRole
    public ApiResponse<Void> deletePasswordMangerById(@Valid @NotEmpty @PathVariable String pmId) {
        passwordManagerService.trashPasswordManager(pmId);
        return ApiResponse.success("Moved to Trash.");
    }

    @DeleteMapping("/credential/{credentialId}")
    @AnyRole
    public ApiResponse<Void> deleteCredentialById(@Valid @NotEmpty @PathVariable String credentialId) {
        passwordManagerService.trashCredential(credentialId);
        return ApiResponse.success("Moved to Trash.");
    }

    @GetMapping("/credential/{credentialId}/history")
    @AnyRole
    public ApiResponse<List<PasswordHistoryDto>> getPasswordHistory(@Valid @NotEmpty @PathVariable String credentialId) {
        return ApiResponse.success(passwordManagerService.getHistory(credentialId));
    }

    @PostMapping("/credential/{credentialId}/history/{historyId}/restore")
    @AnyRole
    public ApiResponse<Void> restorePassword(@Valid @NotEmpty @PathVariable String credentialId,
                                             @Valid @NotEmpty @PathVariable String historyId) {
        passwordManagerService.restorePassword(credentialId, historyId);
        return ApiResponse.success("Password restored.");
    }

    @GetMapping("/trash")
    @AnyRole
    public ApiResponse<List<ResponsePayloads.PasswordManagerResponse>> getTrash() {
        return ApiResponse.success(toResponses(passwordManagerService.listTrash()));
    }

    @PostMapping("/trash/{credentialId}/restore")
    @AnyRole
    public ApiResponse<Void> restoreFromTrash(@Valid @NotEmpty @PathVariable String credentialId) {
        passwordManagerService.restore(credentialId);
        return ApiResponse.success("Restored.");
    }

    @DeleteMapping("/trash/{credentialId}")
    @AnyRole
    public ApiResponse<Void> purgeFromTrash(@Valid @NotEmpty @PathVariable String credentialId) {
        passwordManagerService.purge(credentialId);
        return ApiResponse.success("Deleted forever.");
    }

    @GetMapping("/host")
    @AnyRole
    public ApiResponse<List<String>> getAllHost() {
        return ApiResponse.success(passwordManagerService.getAllHosts());
    }
}
