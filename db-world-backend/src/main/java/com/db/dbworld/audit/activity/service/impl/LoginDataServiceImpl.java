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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class LoginDataServiceImpl implements LoginDataService {

    private final LoginDataRepository loginDataRepository;
    private final UserRepository      userRepository;
    private final LoginDataMapper     loginDataMapper;

    @Override
    public LoginDataDto addAgentByUserId(String agent, Long userId) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("user", "userId", userId.toString()));

        LoginDataEntity loginDataEntity = new LoginDataEntity();
        loginDataEntity.setUser(userEntity);
        loginDataEntity.setLoginAgent(agent);

        return loginDataMapper.toDto(loginDataRepository.save(loginDataEntity));
    }

    @Override
    public Long totalNumberOfLogin(Long userId) {
        return loginDataRepository.totalNumberOfLogin(userId);
    }

    @Override
    public List<LoginDataDto> getLoginHistory(Long userId) {
        return loginDataRepository.getLoginDataFromUserId(userId)
                .stream()
                .map(loginDataMapper::toDto)
                .collect(Collectors.toList());
    }
}
