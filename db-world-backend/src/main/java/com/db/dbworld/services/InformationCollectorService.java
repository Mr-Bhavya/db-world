package com.db.dbworld.services;

import com.db.dbworld.payloads.user.UserCinemaDataDto;

public interface InformationCollectorService {
    void saveUserEventInfo(UserCinemaDataDto userCinemaDataDto);
}
