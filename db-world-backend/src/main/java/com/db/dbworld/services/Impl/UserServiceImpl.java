package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.LoginDataRepository;
import com.db.dbworld.dao.user.UserRepository;
import com.db.dbworld.dao.user.UserRoleRepository;
import com.db.dbworld.entities.user.LoginDataEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.entities.user.UserRoleEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.UserService;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Slf4j
@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private LoginDataRepository loginDataRepository;

    @Override
    public UserEntity getUserFromToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetails user = (UserDetails) authentication.getPrincipal();
        return this.userRepository.findByEmail(user.getUsername()).orElseThrow(
                ()->new ResourceNotFoundException("user", "email", user.getUsername())
        );
//        try{
//
//        }catch (Exception ex){
//            throw new AuthenticationServiceException("Token is not valid");
//        }
    }

    @Override
    public Long getUserIdFromToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailImpl user = (UserDetailImpl) authentication.getPrincipal();
        return user.getUserId();
//        try {
//
//        }catch (Exception ex){
//            throw new AuthenticationServiceException("Token is not valid");
//        }
    }

    @Override
    public List<UserDto> getAllUsers() {
        List<UserEntity> userEntities = this.userRepository.findAll();
        return userEntities.stream().map(userEntity -> {
                    try {
                        Pageable pageable = PageRequest.of(0,5, Sort.by(Sort.Direction.DESC, "lastLoginDate"));
                        List<LoginDataEntity> loginDataEntities = this.loginDataRepository
                                .findByUserUserId(userEntity.getUserId(), pageable);
                        UserDto userDto = this.modelMapper.map(userEntity, UserDto.class);
                        userDto.setLoginData(
                                loginDataEntities.stream().map(loginDataEntity -> this.modelMapper.map(
                                        loginDataEntity, UserDto.LoginData.class
                                )).toList()
                        );
                        return userDto;
                    } catch (Exception ex) {
                        log.warn(ex.getMessage());
                        return this.modelMapper.map(userEntity, UserDto.class);
                    }
                }
        ).toList();
    }

    @Override
    public List<UserDto> createUser(List<UserDto> userDtoList) {
        int viewerRoleId = 3;
        UserRoleEntity userRoleEntity = this.userRoleRepository.findById(viewerRoleId).orElseThrow(
                () -> new ResourceNotFoundException("User Role", "id", String.valueOf(viewerRoleId))
        );
        List<UserEntity> userEntities = new ArrayList<>();

        userDtoList.forEach(userDto -> {
            UserEntity userEntity = new UserEntity();
            userEntity.setFirstName(userDto.getFirstName());
            userEntity.setLastName(userDto.getLastName());
            userEntity.setDob(userDto.getDob());
            userEntity.setGender(userDto.getGender());
            userEntity.setMobileNo(userDto.getMobileNo());
            userEntity.setEmail(userDto.getEmail().toLowerCase());
            userEntity.setPassword(userDto.getPassword());
            userEntity.setRole(userRoleEntity);
            userEntities.add(userEntity);
        });
        List<UserEntity> newUsers = this.userRepository.saveAll(userEntities);
        return newUsers.stream().map(userEntity -> this.modelMapper.map(userEntity, UserDto.class)).toList();
    }

    @Override
    public UserDto registerUser(UserDto userDto) {
        return null;
    }

    @Override
    public UserDto getUserDtoById(Long id) {
        UserEntity userEntity = getUserEntityById(id);
        return this.modelMapper.map(userEntity, UserDto.class);
    }

    @Override
    public UserEntity getUserEntityById(Long id) {
        return this.userRepository.findById(id).orElseThrow(
                () -> new ResourceNotFoundException("User", "userid", id.toString())
        );
    }

    @Override
    public UserDto getUserProfile() {
        return this.modelMapper.map(getUserFromToken(), UserDto.class);
    }

    @Override
    public long getUserIdByUsername(String username) {
        UserEntity userEntity = this.userRepository.findByEmail(username).orElseThrow(
                () -> new ResourceNotFoundException("User", "username", username)
        );
        return this.modelMapper.map(userEntity, UserDto.class).getUserId();
    }

    @Override
    public UserDto updateUser(UserDto userDto, Long userId) {
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(
                () -> new ResourceNotFoundException("User", "userId", userId)
        );
        try {
            userEntity.setFirstName(userDto.getFirstName());
            userEntity.setLastName(userDto.getLastName());
            userEntity.setEmail(userDto.getEmail());
            userEntity.setGender(userDto.getGender());
            userEntity.setMobileNo(userDto.getMobileNo());
            userEntity.setDob(userDto.getDob());
            userEntity.setPassword(userDto.getPassword());
            return this.modelMapper.map(this.userRepository.save(userEntity), UserDto.class);
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public void deleteUserById(Long id) {
        boolean isUserExists = this.userRepository.existsById(id);
        if (isUserExists) {
            this.userRepository.deleteById(id);
        } else {
            throw new ResourceNotFoundException("User", "userid", id.toString());
        }
    }

    @Override
    public UserDto getUserByEmail(String email) {
        UserEntity userEntity = this.userRepository.findByEmail(email).orElseThrow(
                () -> new ResourceNotFoundException("User", "email", email)
        );
        return this.modelMapper.map(userEntity, UserDto.class);
    }

    @Override
    public List<UserDto> searchUser(String key) {
        return List.of();
    }

    @Override
    public UserDto.UserRole addUpdateUserRoleByUserId(Long userId, UserDto.UserRole role) {
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(
                () -> new ResourceNotFoundException("User", "userId", userId)
        );
        UserRoleEntity userRoleEntity = this.userRoleRepository.findByName(role.getName());
        if(userRoleEntity == null){

        }
        userEntity.setRole(userRoleEntity);
        userEntity = this.userRepository.save(userEntity);
        return this.modelMapper.map(userEntity.getRole(), UserDto.UserRole.class);
    }

    @Override
    public UserDto.UserRole getRoleByUserId(Long userId, String tokenUserName) {
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(
                () -> new ResourceNotFoundException("User", "userId", userId.toString())
        );
        return this.modelMapper.map(userEntity.getRole(), UserDto.UserRole.class);
    }

    @Override
    public void updateDob(Date dob) {
        try{
            UserEntity userEntity = getUserFromToken();
            userEntity.setDob(dob);
            userRepository.save(userEntity);
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public UserDto updateRoleByUserId(String userId) {
        return null;
    }

    @Override
    public void deleteUserAppDataById(String id) {

    }

    @Override
    public void deleteUserAppDataByUserId(String userId) {

    }


}
