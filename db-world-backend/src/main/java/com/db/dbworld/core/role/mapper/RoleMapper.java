package com.db.dbworld.core.role.mapper;

import com.db.dbworld.core.role.dto.RoleDto;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RoleMapper {

    @Mapping(target = "name", expression = "java(entity.getName() != null ? entity.getName().name() : null)")
    RoleDto toDto(RoleEntity entity);

    @Mapping(target = "name", expression = "java(dto.getName() != null ? com.db.dbworld.core.role.enums.Role.fromString(dto.getName()) : null)")
    RoleEntity toEntity(RoleDto dto);
}
