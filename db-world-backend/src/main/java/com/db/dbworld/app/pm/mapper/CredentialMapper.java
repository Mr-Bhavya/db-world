package com.db.dbworld.app.pm.mapper;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.payloads.RequestPayloads;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface CredentialMapper {

    CredentialDto fromAddCredential(RequestPayloads.AddCredential source);

    // The controller normalises url (null = unchanged); the service applies it, not the mapper.
    CredentialDto fromUpdateCredential(RequestPayloads.UpdateCredential source);
}
