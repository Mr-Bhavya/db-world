package com.db.dbworld.core.user.service.impl;

import com.db.dbworld.audit.activity.entity.LoginDataEntity;
import com.db.dbworld.audit.activity.repository.LoginDataRepository;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import com.db.dbworld.core.user.dto.*;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.mapper.UserMapper;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.core.user.service.UserService;

import com.db.dbworld.config.AppConstants;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.Set;

@Log4j2
@Service
@Transactional
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UserRoleRepository roleRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final UserContext userContext;
    private final LoginDataRepository loginDataRepository;

    // ==============================
    // âœ… CREATE USER
    // ==============================
    @Override
    public UserDto createUser(CreateUserRequest request) {

        UserEntity entity = userMapper.toEntity(request);

        entity.setPassword(passwordEncoder.encode(request.getPassword()));

        RoleEntity role;
        if (request.getRoleId() != null) {
            role = roleRepository.findById(Math.toIntExact(request.getRoleId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Role", "id", request.getRoleId()));
        } else {
            role = roleRepository.findByName(Role.VIEWER);
            if (role == null) {
                throw new ResourceNotFoundException("Role", "name", Role.VIEWER.name());
            }
        }

        entity.setRole(role);

        return userMapper.toDto(userRepository.save(entity));
    }

    @Override
    public List<UserDto> createUsers(List<CreateUserRequest> requests) {

        if (requests == null || requests.isEmpty()) {
            return List.of();
        }

        return requests.stream()
                .map(this::createUser)
                .toList();
    }

    // ==============================
    // âœ… GET USER
    // ==============================
    @Override
    public UserDto getUserDtoById(Long userId) {
        return userMapper.toDto(getUserEntityById(userId));
    }

    @Override
    public UserEntity getUserEntityById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }

    @Override
    public List<UserDto> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable)
                .stream()
                .map(entity -> {
                    UserDto dto = userMapper.toDto(entity);
                    Long uid = entity.getUserId();
                    dto.setNoOfLogin(loginDataRepository.totalNumberOfLogin(uid));
                    dto.setLoginData(loginDataRepository.getLoginDataFromUserId(uid)
                            .stream()
                            .map(ld -> {
                                UserDto.LoginData entry = new UserDto.LoginData();
                                entry.setLastLoginDate(ld.getLastLoginDate());
                                entry.setLoginAgent(ld.getLoginAgent());
                                return entry;
                            })
                            .toList());
                    return dto;
                })
                .toList();
    }

    @Override
    public Map<String, Object> getPagedUsers(String search, String role, int page, int size, String sortBy, String sortDir) {
        Set<String> VALID_SORT = Set.of("userId", "firstName", "lastName", "email", "creationDate");
        String safeSort = VALID_SORT.contains(sortBy) ? sortBy : "userId";
        Sort.Direction dir = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(dir, safeSort));

        Page<UserEntity> entityPage = userRepository.findAll((root, query1, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                preds.add(cb.or(
                    cb.like(cb.lower(root.get("firstName")), like),
                    cb.like(cb.lower(root.get("lastName")), like),
                    cb.like(cb.lower(root.get("email")), like)
                ));
            }
            if (role != null && !role.isBlank() && !role.equalsIgnoreCase("ALL")) {
                try {
                    Role r = Role.valueOf(role.toUpperCase());
                    preds.add(cb.equal(root.get("role").get("name"), r));
                } catch (IllegalArgumentException ignored) {}
            }
            return preds.isEmpty() ? cb.conjunction() : cb.and(preds.toArray(Predicate[]::new));
        }, pageable);

        List<UserDto> content = entityPage.getContent().stream()
            .map(entity -> {
                UserDto dto = userMapper.toDto(entity);
                Long uid = entity.getUserId();
                dto.setNoOfLogin(loginDataRepository.totalNumberOfLogin(uid));
                dto.setLoginData(loginDataRepository.getLoginDataFromUserId(uid)
                    .stream()
                    .map(ld -> {
                        UserDto.LoginData entry = new UserDto.LoginData();
                        entry.setLastLoginDate(ld.getLastLoginDate());
                        entry.setLoginAgent(ld.getLoginAgent());
                        return entry;
                    })
                    .toList());
                return dto;
            })
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("content",       content);
        result.put("totalElements", entityPage.getTotalElements());
        result.put("totalPages",    entityPage.getTotalPages());
        result.put("page",          entityPage.getNumber());
        result.put("size",          entityPage.getSize());
        result.put("last",          entityPage.isLast());
        return result;
    }

    @Override
    public List<UserSearchResponse> searchUsers(String query, int limit) {

        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }

        return userRepository.searchUsers(query.trim(), PageRequest.of(0, limit))
                .stream()
                .map(p -> new UserSearchResponse(
                        p.getUserId(),
                        p.getFirstName() + " " + p.getLastName(),
                        p.getEmail()
                ))
                .toList();
    }

    // ==============================
    // âœ… UPDATE USER (NO PASSWORD)
    // ==============================
    @Override
    public UserDto updateUser(UpdateUserRequest request, Long userId) {

        UserEntity entity = getUserEntityById(userId);

        userMapper.updateUserFromRequest(request, entity);

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            entity.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        return userMapper.toDto(userRepository.save(entity));
    }

    // ==============================
    // âœ… CHANGE PASSWORD
    // ==============================
    @Override
    public void changePassword(ChangePasswordRequest request) {

        UserEntity user = getCurrentUser();

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new DbWorldException("Invalid old password");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));

        userRepository.save(user);
    }

    // ==============================
    // âœ… PROFILE
    // ==============================
    @Override
    public UserDto getUserProfile() {
        return userMapper.toDto(getCurrentUser());
    }

    // ==============================
    // âœ… ROLE
    // ==============================
    @Override
    public String getRoleForUser() {
        return getCurrentUser().getRole().getName().name();
    }

    @Override
    public UserDto updateUserRole(Long userId, Long roleId) {

        UserEntity user = getUserEntityById(userId);

        RoleEntity role = roleRepository.findById(Math.toIntExact(roleId))
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        // avoid unnecessary DB update
        if (user.getRole() != null && user.getRole().getId() == role.getId()) {
            return userMapper.toDto(user);
        }

        user.setRole(role);

        return userMapper.toDto(userRepository.save(user));
    }

    // ==============================
    // âœ… DELETE
    // ==============================
    @Override
    public void deleteUserById(Long userId) {

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (userId.equals(userContext.userId())) {
            throw new DbWorldException("You cannot delete yourself");
        }

        if (user.getRole().getName() == Role.ADMIN) {

            long adminCount = userRepository.countByRoleName(Role.ADMIN);

            if (adminCount <= 1) {
                throw new DbWorldException("Cannot delete the last admin user");
            }
        }

        userRepository.delete(user);

        log.warn("User [{}] deleted by [{}]", userId, userContext.userId());
    }

    // ==============================
    // âœ… EMAIL LOOKUP
    // ==============================
    @Override
    public UserDto getUserDtoByEmail(String email) {
        return userMapper.toDto(getUserEntityByEmail(email));
    }

    @Override
    public UserEntity getUserEntityByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    // ==============================
    // âœ… UPDATE DOB
    // ==============================
    @Override
    public void updateDob(Date dob) {
        UserEntity user = getCurrentUser();
        user.setDob(dob);
        userRepository.save(user);
    }

    // ==============================
    // ðŸ”’ INTERNAL
    // ==============================
    private UserEntity getCurrentUser() {
        return getUserEntityById(userContext.userId());
    }
}