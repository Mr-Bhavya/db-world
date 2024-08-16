package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.UserRoleRepository;
import com.db.dbworld.entities.user.UserRoleEntity;
import com.db.dbworld.exceptions.DuplicateResourceException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.RoleService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Configurable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RoleServiceImpl implements RoleService {

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private MongoOperations mongoOperations;

    @Autowired
    private ModelMapper modelMapper;

    @Override
    public UserDto.UserRole addRole(UserDto.UserRole userRole) {
        try {
            UserRoleEntity userRoleEntity = this.modelMapper.map(userRole, UserRoleEntity.class);
            UserRoleEntity updatedUserRoleEntity = this.userRoleRepository.save(userRoleEntity);
            return this.modelMapper.map(updatedUserRoleEntity, UserDto.UserRole.class);
        }catch (DuplicateKeyException ex){
            throw new DuplicateResourceException("Role", "role name", userRole.getName());
        }
    }

    @Override
    public UserDto.UserRole updateRole(UserDto.UserRole userRole) {
        boolean isRoleExists  = this.userRoleRepository.existsById(userRole.getId());
        if (!isRoleExists){
            throw new ResourceNotFoundException("UserRole", "roleId", userRole.getId());
        }
        UserRoleEntity updatedUserRoleEntity = this.userRoleRepository.save(this.modelMapper.map(userRole, UserRoleEntity.class));
        return this.modelMapper.map(updatedUserRoleEntity, UserDto.UserRole.class);
    }

    @Override
    public List<UserDto.UserRole> getRoles() {
        List<UserRoleEntity> userRoleEntityList = this.userRoleRepository.findAll();
        return userRoleEntityList.stream().map(userRoleEntity -> this.modelMapper.map(userRoleEntity, UserDto.UserRole.class)).toList();
    }

    @Override
    public UserDto.UserRole getRoleById(String roleId) {
//        UserRoleEntity userRoleEntity = this.userRoleRepository.findById(roleId)
//                .orElseThrow(()->new ResourceNotFoundException("UserRole", "roleId", roleId));
        UserRoleEntity userRoleEntity = mongoOperations.findOne(new Query(Criteria.where("id").is(roleId)),UserRoleEntity.class);
        if(userRoleEntity == null){
            throw new ResourceNotFoundException("UserRole", "roleId", roleId);
        }
        return this.modelMapper.map(userRoleEntity, UserDto.UserRole.class);
    }

    @Override
    public UserDto.UserRole getRoleByName(String roleName) {
        Query query = new Query(Criteria.where("name").is(roleName));
        UserRoleEntity userRoleEntity = this.mongoOperations.findOne(query, UserRoleEntity.class);
        return this.modelMapper.map(userRoleEntity, UserDto.UserRole.class);
    }

    @Override
    public void deleteRole(String roleId) {
        boolean isRoleExists  = this.userRoleRepository.existsById(roleId);
        if (!isRoleExists){
            throw new ResourceNotFoundException("UserRole", "roleId", roleId);
        }
        this.userRoleRepository.deleteById(roleId);
    }
}
