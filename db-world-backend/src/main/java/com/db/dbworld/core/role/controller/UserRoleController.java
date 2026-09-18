package com.db.dbworld.core.role.controller;

import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.core.role.dto.RoleDto;
import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.core.role.service.RoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/role")
public class UserRoleController {

    @Autowired private RoleService roleService;

    @AdminAccess
    @GetMapping("/")
    public ApiResponse<List<RoleDto>> getAllRoles() {
        return ApiResponse.success(roleService.getRoles());
    }
}