package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.core.user.dto.UserDto;
import com.db.dbworld.core.role.service.RoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@CrossOrigin
@RequestMapping("/api/role")
public class UserRoleController {

    @Autowired private RoleService roleService;

    @GetMapping("/")
    public ApiResponse<List<UserDto.UserRole>> getAllRoles() {
        return ApiResponse.success(roleService.getRoles());
    }
}
