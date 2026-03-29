package com.db.dbworld.core.role.init;

import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Log4j2
@Component
@Order(1)
@RequiredArgsConstructor
public class RoleDataInitializer implements ApplicationRunner {

    private final UserRoleRepository roleRepository;

    @Override
    public void run(ApplicationArguments args) {
        for (Role role : Role.values()) {
            if (roleRepository.findByName(role) == null) {
                RoleEntity entity = new RoleEntity();
                entity.setName(role);
                roleRepository.save(entity);
                log.info("Created role: {}", role);
            }
        }
    }
}
