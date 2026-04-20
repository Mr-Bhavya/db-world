package com.db.dbworld.app.pm.mapper;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.HostDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

import java.util.List;

@Mapper(componentModel = "spring")
public interface PasswordManagerMapper {

    PasswordManagerDto toDto(PasswordManagerEntity entity);

    CredentialDto toDto(CredentialEntity entity);

    HostDto toDto(HostEntity entity);

    List<PasswordManagerDto> toDtoList(List<PasswordManagerEntity> entities);

    CredentialEntity toEntity(CredentialDto dto);

    void updateEntityFromDto(CredentialDto dto, @MappingTarget CredentialEntity entity);
}
