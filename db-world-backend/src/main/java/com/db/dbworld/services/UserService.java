package com.db.dbworld.services;

import com.db.dbworld.payloads.Credential;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;

import java.util.List;

public interface UserService {

    List<UserDto> getAllUsers();

    UserDto createUser(UserDto userDto);

    UserDto registerUser(UserDto userDto);

    UserDto getUserById(String id);

    String getUserIdByUsername(String username); //username = email

    UserDto updateUser(UserDto userDto, String userId);

    void deleteUserById(String id);

    UserDto getUserByEmail(String email);

    List<UserDto> searchUser(String key);

    List<UserDto.PasswordManagerCredential> getCredentialByUserId(String userId);

    UserDto.UserRole addUpdateUserRoleByUserId(String userId, UserDto.UserRole role);

    UserDto.UserRole getRoleByUserId(String userId, String tokenUserName);

    UserDto updateRoleByUserId(String userId);

    UserDto.UserAppData getUserAppDataByUserId(String userId);

    UserDto.UserAppData updateUserAppDataByUserId(String userId, UserDto.UserAppData userAppData);

    void deleteUserAppDataById(String id);

    void deleteUserAppDataByUserId(String userId);

    void addCredential(String userId, String host, Credential credential);

    List<ResponsePayloads.PasswordManagerCredential> getCredentials(String userId);

    Credential getCredentialById(String userId, long credential);

    void updateCredential(String userId, String host, Credential credential);

    void deleteCredential(String userId, String passwordManagerId, long credentialId);
}
