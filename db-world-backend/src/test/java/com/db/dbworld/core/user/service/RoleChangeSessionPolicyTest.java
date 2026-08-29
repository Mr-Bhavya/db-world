package com.db.dbworld.core.user.service;

import com.db.dbworld.audit.activity.repository.LoginDataRepository;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.mapper.UserMapper;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.core.user.service.impl.UserServiceImpl;
import com.db.dbworld.security.auth.SessionRevocationService;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.repository.BiometricDeviceRepository;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The hybrid role-change policy: losing privileges ends every session immediately, gaining them
 * leaves the user signed in.
 *
 * <p>The downgrade half is the one that matters. Without it a demoted admin keeps admin
 * authority for the remaining life of the access token they are already holding, because that
 * token is stateless and carries the old role in its claims.
 */
class RoleChangeSessionPolicyTest {

    UserRepository userRepository;
    UserRoleRepository roleRepository;
    SessionRevocationService sessionRevocationService;
    UserServiceImpl service;

    UserEntity user;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        roleRepository = mock(UserRoleRepository.class);
        sessionRevocationService = mock(SessionRevocationService.class);

        service = new UserServiceImpl(
                userRepository,
                roleRepository,
                mock(UserMapper.class),
                mock(PasswordEncoder.class),
                mock(UserContext.class),
                mock(LoginDataRepository.class),
                mock(RefreshTokenRepository.class),
                mock(BiometricDeviceRepository.class),
                sessionRevocationService,
                mock(AccountDeletionService.class));

        user = new UserEntity();
        user.setUserId(4L);
        user.setEmail("user@example.com");
        when(userRepository.findById(4L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private RoleEntity role(int id, Role name) {
        RoleEntity entity = new RoleEntity();
        entity.setId(id);
        entity.setName(name);
        when(roleRepository.findById(id)).thenReturn(Optional.of(entity));
        return entity;
    }

    @Test
    void demotingAdminToViewerRevokesEverySession() {
        user.setRole(role(1, Role.ADMIN));
        role(2, Role.VIEWER);
        when(userRepository.countByRoleName(Role.ADMIN)).thenReturn(3L);

        service.updateUserRole(4L, 2L);

        verify(sessionRevocationService).revokeAll(4L, RevokeReason.ROLE_DOWNGRADE, null);
    }

    @Test
    void demotingOwnerToAdminRevokesEverySession() {
        user.setRole(role(1, Role.OWNER));
        role(2, Role.ADMIN);
        when(userRepository.countByRoleName(Role.OWNER)).thenReturn(2L);

        service.updateUserRole(4L, 2L);

        verify(sessionRevocationService).revokeAll(4L, RevokeReason.ROLE_DOWNGRADE, null);
    }

    /** Being promoted is not a security event — bouncing the user to login would be gratuitous. */
    @Test
    void promotingViewerToAdminKeepsSessionsAlive() {
        user.setRole(role(2, Role.VIEWER));
        role(1, Role.ADMIN);

        service.updateUserRole(4L, 1L);

        verify(sessionRevocationService, never()).revokeAll(anyLong(), any(), any());
        assertThat(user.getRole().getName()).isEqualTo(Role.ADMIN);
    }

    @Test
    void assigningTheSameRoleIsANoOp() {
        RoleEntity admin = role(1, Role.ADMIN);
        user.setRole(admin);

        service.updateUserRole(4L, 1L);

        verify(userRepository, never()).save(any());
        verify(sessionRevocationService, never()).revokeAll(anyLong(), any(), any());
    }

    /** Demoting the only admin would leave the console unreachable. */
    @Test
    void refusesToDemoteTheLastAdmin() {
        user.setRole(role(1, Role.ADMIN));
        role(2, Role.VIEWER);
        when(userRepository.countByRoleName(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service.updateUserRole(4L, 2L))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("last ADMIN");

        assertThat(user.getRole().getName()).isEqualTo(Role.ADMIN);
        verify(sessionRevocationService, never()).revokeAll(anyLong(), any(), any());
    }

    /** Promoting the last admin is fine — the count is unchanged or higher afterwards. */
    @Test
    void allowsPromotingTheOnlyAdminToOwner() {
        user.setRole(role(1, Role.ADMIN));
        role(3, Role.OWNER);
        when(userRepository.countByRoleName(Role.ADMIN)).thenReturn(1L);

        service.updateUserRole(4L, 3L);

        assertThat(user.getRole().getName()).isEqualTo(Role.OWNER);
        verify(sessionRevocationService, never()).revokeAll(anyLong(), any(), any());
    }
}
