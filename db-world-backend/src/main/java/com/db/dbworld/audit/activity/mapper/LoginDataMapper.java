package com.db.dbworld.audit.activity.mapper;

import com.db.dbworld.audit.activity.dto.LoginDataDto;
import com.db.dbworld.audit.activity.entity.LoginDataEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface LoginDataMapper {

    @Mapping(target = "userDto", ignore = true)
    LoginDataDto toDto(LoginDataEntity entity);
}
