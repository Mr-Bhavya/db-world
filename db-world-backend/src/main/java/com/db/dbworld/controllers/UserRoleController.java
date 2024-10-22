package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.RoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/role")
public class UserRoleController {

    @Autowired
    private RoleService roleService;

    @GetMapping("/")
    public ApiResponse<List<UserDto.UserRole>> getAllRoles(){
        List<UserDto.UserRole> userRoles = this.roleService.getRoles();
        return new ApiResponse<>(HttpStatus.OK, true, userRoles);
    }
}
