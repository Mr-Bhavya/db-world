package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.LoginDataRepository;
import com.db.dbworld.dao.user.UserRepository;
import com.db.dbworld.dao.user.UserRoleRepository;
import com.db.dbworld.entities.dbcinema.user.UserSearchProjection;
import com.db.dbworld.entities.user.LoginDataEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.entities.user.UserRoleEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.auth.RoleService;
import com.db.dbworld.services.user.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@CacheConfig(cacheNames = "User")
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private LoginDataRepository loginDataRepository;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private JwtDecoder jwtDecoder;

    @Autowired
    private RoleService roleService;

    @Override
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_USER_KEY_GENERATOR)
    public UserEntity getUserFromToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username;

        if (authentication == null) {
            throw new DbWorldException("Unauthenticated access");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof UserDetails userDetails) {
            username = userDetails.getUsername();
        } else if (principal instanceof Jwt jwt) {
            username = jwt.getSubject(); // or jwt.getClaim("sub")
        } else if (principal instanceof String str) {
            username = str; // Sometimes principal is a String username
        } else {
            throw new DbWorldException("Unknown principal type: " + principal.getClass());
        }

        return this.userRepository.findByEmail(username)
                .orElseThrow(() -> new ResourceNotFoundException("user", "email", username));
    }

    @Override
    public String getUserFromToken(String token) {
        try {
            Jwt jwt =  jwtDecoder.decode(token);
            return jwt.getSubject(); // or jwt.getClaimAsString("email")
        } catch (JwtException e) {
            throw new DbWorldException("Invalid JWT token: " + e.getMessage());
        }
    }

    @Override
    public Long getUserIdFromToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaim("userId");
        }
        throw new IllegalStateException("Invalid authentication token");
    }

    @Override
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public List<UserDto> getAllUsers() {
        List<UserEntity> userEntities = this.userRepository.findAll();
        return userEntities.stream().map(userEntity -> {
                    try {
                        Pageable pageable = PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "lastLoginDate"));
                        List<LoginDataEntity> loginDataEntities = this.loginDataRepository
                                .findByUserUserId(userEntity.getUserId(), pageable);

                        pageable = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "time"));
//                        List<UserCinemaDataEntity> userCinemaDataEntities = userCinemaDataRepository.findAllByUserUserId(userEntity.getUserId(), pageable);

                        loginDataRepository.totalNumberOfLogin(userEntity.getUserId());

                        UserDto userDto = this.modelMapper.map(userEntity, UserDto.class);
                        userDto.setLoginData(
                                loginDataEntities.stream().map(loginDataEntity -> this.modelMapper.map(
                                        loginDataEntity, UserDto.LoginData.class
                                )).toList()
                        );

                        userDto.setNoOfLogin(loginDataRepository.totalNumberOfLogin(userEntity.getUserId()));
                        return userDto;
                    } catch (Exception ex) {
                        log.warn(ex.getMessage());
                        return this.modelMapper.map(userEntity, UserDto.class);
                    }
                }
        ).collect(Collectors.toList());
    }

    @Override
    public List<UserSearchProjection> searchUsersByQuery(String query, int limit) {
        return userRepository.searchUsers(query, limit);
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
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
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
            updateUserFields(userEntity, userDto);
            return this.modelMapper.map(this.userRepository.save(userEntity), UserDto.class);
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Transactional
    @Override
    public UserDto updateUserWithRole(UserDto userDto, Long userId) {
        // 1. Input validation
        Objects.requireNonNull(userDto, "UserDto cannot be null");

        // 2. Fetch existing user
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "userId", userId));

        try {
            // 3. Update basic user fields
            updateUserFields(userEntity, userDto);

            // 4. Handle role update only if provided
            if (userDto.getUserRole() != null) {
                updateUserRole(userEntity, userDto.getUserRole());
            }

            // 5. Save and return
            UserEntity updatedUser = userRepository.save(userEntity);
            return modelMapper.map(updatedUser, UserDto.class);

        } catch (ResourceNotFoundException ex) {
            throw ex; // Re-throw specific exceptions
        } catch (Exception ex) {
            throw new DbWorldException("Failed to update user: " + ex.getMessage(), ex);
        }
    }

    private void updateUserFields(UserEntity userEntity, UserDto userDto) {
        userEntity.setFirstName(userDto.getFirstName());
        userEntity.setLastName(userDto.getLastName());
        userEntity.setEmail(userDto.getEmail());
        userEntity.setGender(userDto.getGender());
        userEntity.setMobileNo(userDto.getMobileNo());
        userEntity.setDob(userDto.getDob());

        // Only update password if provided and not empty
        if (StringUtils.hasText(userDto.getPassword())) {
            userEntity.setPassword(userDto.getPassword());
        }
    }

    private void updateUserRole(UserEntity userEntity, UserDto.UserRole roleDto) {
        // Validate role ID
        if (!StringUtils.hasText(roleDto.getId())) {
            throw new IllegalArgumentException("Role ID cannot be null or empty");
        }

        // Verify role exists
        UserDto.UserRole existingRole = roleService.getRoleByName(roleDto.getName());
        if (existingRole == null) {
            throw new ResourceNotFoundException("Role", "name", roleDto.getName());
        }

        // Only update if role is different
        if (userEntity.getRole() == null ||
                userEntity.getRole().getId() != (Integer.parseInt(existingRole.getId()))) {

            UserRoleEntity roleEntity = modelMapper.map(existingRole, UserRoleEntity.class);
            userEntity.setRole(roleEntity);
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
    public UserDto getUserDtoByEmail(String email) {
        return this.modelMapper.map(getUserEntityByEmail(email), UserDto.class);
    }

    @Override
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public UserEntity getUserEntityByEmail(String email) {
        return this.userRepository.findByEmail(email).orElseThrow(
                () -> new ResourceNotFoundException("User", "email", email)
        );
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
        userEntity.setRole(userRoleEntity);
        userEntity = this.userRepository.save(userEntity);
        return this.modelMapper.map(userEntity.getRole(), UserDto.UserRole.class);
    }

    @Override
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_USER_KEY_GENERATOR)
    public UserDto.UserRole getRoleForUser() {
        Long userId = getUserIdFromToken();
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(
                () -> new ResourceNotFoundException("User", "userId", userId)
        );
        return this.modelMapper.map(userEntity.getRole(), UserDto.UserRole.class);
    }

    @Override
    public void updateDob(Date dob) {
        try {
            UserEntity userEntity = getUserFromToken();
            userEntity.setDob(dob);
            userRepository.save(userEntity);
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public UserDto updateRoleByUserId(String userId) {
        return null;
    }

}
