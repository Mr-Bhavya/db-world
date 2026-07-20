package com.db.dbworld.audit.activity.service.impl;

import com.db.dbworld.audit.activity.dto.LoginDataDto;
import com.db.dbworld.audit.activity.entity.LoginDataEntity;
import com.db.dbworld.audit.activity.mapper.LoginDataMapper;
import com.db.dbworld.audit.activity.repository.LoginDataRepository;
import com.db.dbworld.audit.activity.service.LoginDataService;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Log4j2
@Service
@Transactional
@RequiredArgsConstructor
public class LoginDataServiceImpl implements LoginDataService {

    private final LoginDataRepository loginDataRepository;
    private final UserRepository      userRepository;
    private final LoginDataMapper     loginDataMapper;

    @Override
    public LoginDataDto addAgentByUserId(String agent, Long userId) {
        log.debug("addAgentByUserId called: userId={} agent={}", userId, agent);
        if (agent == null || agent.isBlank()) {
            log.warn("addAgentByUserId: user-agent missing for userId={}", userId);
        }

        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> {
                    log.warn("addAgentByUserId: user not found for userId={}", userId);
                    return new ResourceNotFoundException("user", "userId", userId.toString());
                });

        LoginDataEntity loginDataEntity = new LoginDataEntity();
        loginDataEntity.setUser(userEntity);
        loginDataEntity.setLoginAgent(agent);

        LoginDataEntity saved = loginDataRepository.save(loginDataEntity);
        log.info("Login agent recorded for user [{}] (agent={})", userEntity.getEmail(), agent);
        return loginDataMapper.toDto(saved);
    }

    @Override
    public Long totalNumberOfLogin(Long userId) {
        return loginDataRepository.totalNumberOfLogin(userId);
    }

    @Override
    public List<LoginDataDto> getLoginHistory(Long userId) {
        log.debug("getLoginHistory called for userId={}", userId);
        return loginDataRepository.getLoginDataFromUserId(userId)
                .stream()
                .map(loginDataMapper::toDto)
                .collect(Collectors.toList());
    }
}
