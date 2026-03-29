package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;

import java.util.List;

public interface PasswordManagerService {

    void addCredential(String host, CredentialDto credential);

    List<PasswordManagerDto> getPasswordManagerByUser();

    void deletePasswordManagerById(String pmId);

    PasswordManagerDto updateCredential(String pmId, CredentialDto credential);

    CredentialDto getCredentialById(String credential);

    void deleteCredentialById(String credentialId);

    List<String> getAllHosts();

}
