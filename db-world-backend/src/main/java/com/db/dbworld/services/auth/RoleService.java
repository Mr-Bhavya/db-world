package com.db.dbworld.services.auth;

import com.db.dbworld.payloads.user.UserDto;

import java.util.List;

public interface RoleService {
    UserDto.UserRole addRole(UserDto.UserRole userRole);

    UserDto.UserRole updateRole(UserDto.UserRole userRole);

    List<UserDto.UserRole> getRoles();

    UserDto.UserRole getRoleById(String roleId);

    UserDto.UserRole getRoleByName(String roleName);

    void deleteRole(String roleId);
}
