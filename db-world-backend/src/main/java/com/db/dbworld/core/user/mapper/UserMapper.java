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
    @Mapping(source = "role", target = "userRole")
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
