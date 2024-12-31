package com.db.dbworld.services;

import com.db.dbworld.payloads.pm.CredentialDto;
import com.db.dbworld.payloads.pm.PasswordManagerDto;

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
