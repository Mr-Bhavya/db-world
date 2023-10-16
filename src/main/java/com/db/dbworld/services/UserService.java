package com.db.dbworld.services;

import com.db.dbworld.payloads.UserDto;

import java.util.List;

public interface UserService {

    List<UserDto> getAllUsers();

    UserDto createUser(UserDto userDto);

    UserDto registerUser(UserDto userDto);

    UserDto getUserById(String id);

    UserDto updateUser(UserDto userDto, String userId);

    void deleteUserById(String id);

    UserDto getUserByEmail(String email);

    List<UserDto> searchUser(String key);

}
