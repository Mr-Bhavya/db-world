package com.db.dbworld.services;

import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.payloads.user.UserDto;

import java.util.Date;
import java.util.List;

public interface UserService {

    UserEntity getUserFromToken();

    Long getUserIdFromToken();

    List<UserDto> getAllUsers();

    List<UserDto> createUser(List<UserDto> userDtoList);

    UserDto registerUser(UserDto userDto);

    UserDto getUserDtoById(Long id);

    UserEntity getUserEntityById(Long id);

    UserDto getUserProfile();

    long getUserIdByUsername(String username); //username = email

    UserDto updateUser(UserDto userDto, Long userId);

    void deleteUserById(Long id);

    UserDto getUserByEmail(String email);

    List<UserDto> searchUser(String key);

    List<UserDto.PasswordManagerCredential> getCredentialByUserId(String userId);

    UserDto.UserRole addUpdateUserRoleByUserId(Long userId, UserDto.UserRole role);

    UserDto.UserRole getRoleByUserId(Long userId, String tokenUserName);

    UserDto updateRoleByUserId(String userId);

    UserDto.UserAppData getUserAppDataByUserId(Long userId);

    UserDto.UserAppData updateUserAppDataByUserId(Long userId, UserDto.UserAppData userAppData);

    void deleteUserAppDataById(String id);

    void deleteUserAppDataByUserId(String userId);
    void updateDob(Date dob);
}
