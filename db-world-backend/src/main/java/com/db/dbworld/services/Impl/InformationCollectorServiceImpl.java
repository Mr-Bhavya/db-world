package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.UserCinemaDataRepository;
import com.db.dbworld.entities.user.UserCinemaDataEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.user.UserCinemaDataDto;
import com.db.dbworld.services.InformationCollectorService;
import com.db.dbworld.services.user.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class InformationCollectorServiceImpl implements InformationCollectorService {

    @Autowired
    private UserService userService;

    @Autowired
    private UserCinemaDataRepository userCinemaDataRepository;

    @Override
    public void saveUserEventInfo(UserCinemaDataDto userCinemaDataDto) {
        try{
            UserEntity userEntity = userService.getUserFromToken();
            UserCinemaDataEntity userCinemaDataEntity = new UserCinemaDataEntity();
            userCinemaDataEntity.setUser(userEntity);
            userCinemaDataEntity.setEvent(userCinemaDataDto.getEvent());
            userCinemaDataEntity.setValue(userCinemaDataDto.getValue());
            userCinemaDataRepository.save(userCinemaDataEntity);
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }
}
