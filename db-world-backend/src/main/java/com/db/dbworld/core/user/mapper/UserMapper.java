package com.db.dbworld.core.user.mapper;


import com.db.dbworld.core.user.dto.*;
import com.db.dbworld.core.user.entity.UserEntity;
import org.mapstruct.*;

// unmappedTargetPolicy=IGNORE — UserEntity has many fields that are populated
// by the persistence layer (audit dates, refresh tokens, password manager
// entries) or computed (age, login counts) and never come from request DTOs.
// Listing them all as @Mapping(ignore=true) adds 10+ lines per method without
// changing behavior.
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface UserMapper {

    // ✅ Entity → Response DTO
    // hasPassword/googleLinked are derived, not fields: UserEntity exposes them as
    // hasPassword()/hasGoogleLinked(), which are not JavaBean accessors, so MapStruct cannot
    // discover them by name and needs the expression spelled out.
    @Mapping(source = "role", target = "userRole")
    @Mapping(target = "hasPassword", expression = "java(entity.hasPassword())")
    @Mapping(target = "googleLinked", expression = "java(entity.hasGoogleLinked())")
    UserDto toDto(UserEntity entity);

    // ✅ Create Request → Entity
    @Mapping(target = "userId", ignore = true)
    @Mapping(target = "role", ignore = true) // set manually
    @Mapping(target = "password", ignore = true) // encode manually
    UserEntity toEntity(CreateUserRequest request);

    // ✅ Update Request → Entity (partial update)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "password", ignore = true) // encoded manually in service
    void updateUserFromRequest(UpdateUserRequest request, @MappingTarget UserEntity entity);
}
