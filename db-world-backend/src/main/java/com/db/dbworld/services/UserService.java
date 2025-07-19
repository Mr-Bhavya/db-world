package com.db.dbworld.services;

import com.db.dbworld.entities.dbcinema.user.UserSearchProjection;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.payloads.user.UserCinemaDataDto;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.utils.DbWorldConstants;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

public interface UserService {

    UserEntity getUserFromToken();

    String getUserFromToken(String token);

    Long getUserIdFromToken();

    List<UserDto> getAllUsers();

    List<UserSearchProjection> searchUsersByQuery(String query, int limit);

    List<UserDto> createUser(List<UserDto> userDtoList);

    UserDto registerUser(UserDto userDto);

    UserDto getUserDtoById(Long id);

    UserEntity getUserEntityById(Long id);

    UserDto getUserProfile();

    long getUserIdByUsername(String username); //username = email

    UserDto updateUser(UserDto userDto, Long userId);

    @Transactional
    UserDto updateUserWithRole(UserDto userDto, Long userId);

    void deleteUserById(Long id);

    UserDto getUserDtoByEmail(String email);

    UserEntity getUserEntityByEmail(String email);

    List<UserDto> searchUser(String key);

    UserDto.UserRole addUpdateUserRoleByUserId(Long userId, UserDto.UserRole role);
    
    UserDto.UserRole getRoleForUser();

    void updateDob(Date dob);

    UserDto updateRoleByUserId(String userId);

    UserCinemaDataDto updateUserCinemaData(UserCinemaDataDto userCinemaDataDto, String username);

}
