package com.db.dbworld.app.pm.mapper;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.payloads.RequestPayloads;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CredentialMapper {

    CredentialDto fromAddCredential(RequestPayloads.AddCredential source);

    CredentialDto fromUpdateCredential(RequestPayloads.UpdateCredential source);
}
