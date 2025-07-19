package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.UserRoleRepository;
import com.db.dbworld.entities.user.UserRoleEntity;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.RoleService;
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
    public UserDto.UserRole addRole(UserDto.UserRole userRole) {
        return null;
    }

    @Override
    public UserDto.UserRole updateRole(UserDto.UserRole userRole) {
        return null;
    }

    @Override
    public List<UserDto.UserRole> getRoles() {
        List<UserRoleEntity> userRoleEntityList = this.userRoleRepository.findAll();
        return userRoleEntityList.stream().map(
                userRoleEntity -> this.modelMapper.map(userRoleEntity, UserDto.UserRole.class)
        ).toList();
    }

    @Override
    public UserDto.UserRole getRoleById(String roleId) {
        return this.modelMapper.map(userRoleRepository.findById(Integer.valueOf(roleId)).orElseThrow(
                ()-> new ResourceNotFoundException("Role", "id", roleId)
        ), UserDto.UserRole.class);
    }

    @Override
    public UserDto.UserRole getRoleByName(String roleName) {
        return this.modelMapper.map(userRoleRepository.findByName(roleName), UserDto.UserRole.class);
    }

    @Override
    public void deleteRole(String roleId) {

    }
}
