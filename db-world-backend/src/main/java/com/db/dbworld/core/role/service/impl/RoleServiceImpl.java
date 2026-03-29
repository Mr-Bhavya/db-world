package com.db.dbworld.core.role.service.impl;

import com.db.dbworld.core.role.dto.RoleDto;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.user.dto.UserDto;
import com.db.dbworld.core.role.service.RoleService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RoleServiceImpl implements RoleService {

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private ModelMapper modelMapper;

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
        List<RoleEntity> userRoleEntityList = this.userRoleRepository.findAll();
        return userRoleEntityList.stream().map(
                userRoleEntity -> this.modelMapper.map(userRoleEntity, RoleDto.class)
        ).toList();
    }

    @Override
    public RoleDto getRoleById(String roleId) {
        return this.modelMapper.map(userRoleRepository.findById(Integer.valueOf(roleId)).orElseThrow(
                ()-> new ResourceNotFoundException("Role", "id", roleId)
        ), RoleDto.class);
    }

    @Override
    public RoleDto getRoleByName(String roleName) {
        return this.modelMapper.map(userRoleRepository.findByName(Role.fromString(roleName)), RoleDto.class);
    }

    @Override
    public void deleteRole(String roleId) {

    }
}
