package com.db.dbworld.core.role.service;

import com.db.dbworld.core.role.dto.RoleDto;
import com.db.dbworld.core.user.dto.UserDto;

import java.util.List;

public interface RoleService {
    RoleDto addRole(RoleDto userRole);

    RoleDto updateRole(RoleDto userRole);

    List<RoleDto> getRoles();

    RoleDto getRoleById(String roleId);

    RoleDto getRoleByName(String roleName);

    void deleteRole(String roleId);
}
