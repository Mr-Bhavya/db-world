package com.db.dbworld.core.role.service.impl;

import com.db.dbworld.core.role.dto.RoleDto;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.mapper.RoleMapper;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.role.service.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {

    private final UserRoleRepository userRoleRepository;
    private final RoleMapper         roleMapper;

    @Override
    public RoleDto addRole(RoleDto userRole) {
        return null;
    }

    @Override
    public RoleDto updateRole(RoleDto userRole) {
        return null;
    }

    @Override
    public List<RoleDto> getRoles() {
        return userRoleRepository.findAll().stream()
                .map(roleMapper::toDto)
                .toList();
    }

    @Override
    public RoleDto getRoleById(String roleId) {
        RoleEntity entity = userRoleRepository.findById(Integer.valueOf(roleId))
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));
        return roleMapper.toDto(entity);
    }

    @Override
    public RoleDto getRoleByName(String roleName) {
        return roleMapper.toDto(userRoleRepository.findByName(Role.fromString(roleName)));
    }

    @Override
    public void deleteRole(String roleId) {
    }
}
