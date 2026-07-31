package com.db.dbworld.app.pm.mapper;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.CustomFieldDto;
import com.db.dbworld.app.pm.dto.HostDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CustomFieldEntity;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.ReportingPolicy;

import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface PasswordManagerMapper {

    PasswordManagerDto toDto(PasswordManagerEntity entity);

    CredentialDto toDto(CredentialEntity entity);

    HostDto toDto(HostEntity entity);

    List<PasswordManagerDto> toDtoList(List<PasswordManagerEntity> entities);

    @Mapping(target = "passwordManager", ignore = true)
    CredentialEntity toEntity(CredentialDto dto);

    CustomFieldDto toDto(CustomFieldEntity entity);

    @Mapping(target = "credential", ignore = true)
    CustomFieldEntity toEntity(CustomFieldDto dto);

    // url is not part of the edit payload — preserve the value stored at add time.
    @Mapping(target = "url", ignore = true)
    void updateEntityFromDto(CredentialDto dto, @MappingTarget CredentialEntity entity);
}
