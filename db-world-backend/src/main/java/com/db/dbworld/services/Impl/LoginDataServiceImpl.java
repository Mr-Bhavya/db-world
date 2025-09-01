package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.LoginDataRepository;
import com.db.dbworld.dao.user.UserRepository;
import com.db.dbworld.entities.user.LoginDataEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.user.LoginDataDto;
import com.db.dbworld.services.auth.LoginDataService;
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
}
