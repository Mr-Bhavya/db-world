package com.db.dbworld.audit.activity.service.impl;

import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.audit.activity.dto.LoginDataDto;
import com.db.dbworld.audit.activity.entity.LoginDataEntity;
import com.db.dbworld.audit.activity.repository.LoginDataRepository;
import com.db.dbworld.audit.activity.service.LoginDataService;
import jakarta.persistence.EntityManager;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LoginDataServiceImpl implements LoginDataService {

    @Autowired
    private LoginDataRepository loginDataRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private EntityManager entityManager;

    @Override
    public LoginDataDto addAgentByUserId(String agent, Long userId) {
//        LoginDataEntity loginDataEntity = this.modelMapper.map(loginDataDto, LoginDataEntity.class);
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(
                ()->new ResourceNotFoundException("user", "userId", userId.toString())
        );
//        entityManager.detach(userEntity); // to prevent update in database

        LoginDataEntity loginDataEntity = new LoginDataEntity();
        loginDataEntity.setUser(userEntity);
        loginDataEntity.setLoginAgent(agent);

        LoginDataEntity newLoginDataEntity = this.loginDataRepository.save(loginDataEntity);
        return this.modelMapper.map(newLoginDataEntity, LoginDataDto.class);
    }

    @Override
    public Long totalNumberOfLogin(Long userId) {
        return this.loginDataRepository.totalNumberOfLogin(userId);
    }

    @Override
    public java.util.List<LoginDataDto> getLoginHistory(Long userId) {
        return this.loginDataRepository.getLoginDataFromUserId(userId)
                .stream()
                .map(e -> this.modelMapper.map(e, LoginDataDto.class))
                .collect(java.util.stream.Collectors.toList());
    }
}
