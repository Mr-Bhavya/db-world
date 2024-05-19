package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.RoleService;
import com.db.dbworld.utils.DbWorldConstants;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/role")
@EnableMethodSecurity(prePostEnabled = true)
public class UserRoleController {

    @Autowired
    private RoleService roleService;

    @Autowired
    private ModelMapper modelMapper;

    @PostMapping("/")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    private ApiResponse addNewUserRole(@RequestBody RequestPayloads.AddUserRole userRole) {
        UserDto.UserRole newUserRole = roleService.addRole(this.modelMapper.map(userRole, UserDto.UserRole.class));
        return new ApiResponse(HttpStatus.CREATED, true, newUserRole);
    }

    @PutMapping("/")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    private ApiResponse updateUserRole(@RequestBody UserDto.UserRole userRole) {
        UserDto.UserRole updatedRole = roleService.updateRole(userRole);
        return new ApiResponse(HttpStatus.OK, true, updatedRole);
    }

    @GetMapping("/")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    private ApiResponse getAllUserRole() {
        List<UserDto.UserRole> roles = roleService.getRoles();
        return new ApiResponse(HttpStatus.OK, true, roles);
    }

    @GetMapping("/{roleId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    private ApiResponse getRoleById(@PathVariable String roleId) {
        UserDto.UserRole role = roleService.getRoleById(roleId);
        return new ApiResponse(HttpStatus.OK, true, role);
    }

    @GetMapping("/{roleName}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    private ApiResponse getRoleByName(@PathVariable String roleName) {
        UserDto.UserRole role = roleService.getRoleByName(roleName);
        return new ApiResponse(HttpStatus.OK, true, role);
    }

    @DeleteMapping("/{roleId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    private ApiResponse deleteRoleById(@PathVariable String roleId) {
        roleService.deleteRole(roleId);
        return new ApiResponse(HttpStatus.OK, true, "Role with Id - "+roleId+" is deleted.");
    }

}
