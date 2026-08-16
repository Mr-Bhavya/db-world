package com.db.dbworld.app.pm.mapper;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.payloads.RequestPayloads;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface CredentialMapper {

    CredentialDto fromAddCredential(RequestPayloads.AddCredential source);

    // url is not part of the edit payload — it is set at add time and preserved
    // downstream by PasswordManagerMapper.updateEntityFromDto, which ignores it too.
    @Mapping(target = "url", ignore = true)
    CredentialDto fromUpdateCredential(RequestPayloads.UpdateCredential source);
}
