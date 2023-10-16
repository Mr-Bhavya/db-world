package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.UserRepository;
import com.db.dbworld.entities.UserEntity;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.UserDto;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import org.modelmapper.ModelMapper;
import org.modelmapper.TypeMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ModelMapper modelMapper;

    @Override
    public UserDto createUser(UserDto userDto) {
        UserEntity userEntity = modelMapper.map(userDto, UserEntity.class);
        UserEntity createdUser = this.userRepository.save(userEntity);
        return modelMapper.map(createdUser, UserDto.class);
    }

    /**
     * @param userDto
     * @return
     */
    @Override
    public UserDto registerUser(UserDto userDto) {
        //set user role to viewer
        userDto.setUserRole(DbWorldConstants.VIEWER);

        UserEntity userEntity = modelMapper.map(userDto, UserEntity.class);
        UserEntity createdUser = this.userRepository.save(userEntity);
        return modelMapper.map(createdUser, UserDto.class);
    }

    @Override
    public List<UserDto> getAllUsers() {
        List<UserEntity> userEntityList = this.userRepository.findAll();
        return userEntityList.stream().map(userEntity -> modelMapper.map(userEntity, UserDto.class)).collect(Collectors.toList());
    }

    @Override
    public UserDto getUserById(String userId) {
        UserEntity userEntity = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", "userid", userId));

        //TODO
        TypeMap<UserEntity, UserDto> propertyMap = this.modelMapper.typeMap(UserEntity.class, UserDto.class);
        propertyMap.addMappings(mapping -> mapping.skip(UserDto::setUserRole));
        propertyMap.addMappings(mapping -> mapping.skip(UserDto::setUserCredential));
        propertyMap.addMappings(mapping -> mapping.map(
                UserEntity::getUserAppData,
                (userDto, o) -> {
                    System.out.println(o.toString());
                    UserEntity userEntityObj = (UserEntity) o;
                    userEntityObj.getUserAppData().setLoginDetails(null);
                    userDto.setUserAppData(userEntityObj.getUserAppData());
                })
        );

        UserDto userDto = new UserDto();
        propertyMap.map(userEntity, userDto);

        return userDto;
    }

    @Override
    public UserDto getUserByEmail(String email) {
        UserEntity userEntity = this.userRepository.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException("user", "email", email));
        return this.modelMapper.map(userEntity, UserDto.class);
    }

    @Override
    public UserDto updateUser(UserDto userDto, String userId) {
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", "userid", userId));

        userEntity.setFirstName(userDto.getFirstName());
        userEntity.setLastName(userDto.getLastName());
        userEntity.setDob(userDto.getDob());
        userEntity.setEmail(userDto.getEmail());
        userEntity.setGender(userDto.getGender());
        userEntity.setMobileNo(userDto.getMobileNo());
        userEntity.setPassword(userDto.getPassword());

        UserEntity updatedUserEntity = this.userRepository.save(userEntity);
        userDto = this.modelMapper.map(updatedUserEntity, UserDto.class);

        return userDto;
    }

    @Override
    public void deleteUserById(String userId) {
        this.userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "userid", userId)); //It will check user is available or not with userId
        this.userRepository.deleteById(userId);
    }

    @Override
    public List<UserDto> searchUser(String key) {
        return null;
    }
}
