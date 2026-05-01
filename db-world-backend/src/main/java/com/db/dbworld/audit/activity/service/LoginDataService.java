package com.db.dbworld.audit.activity.service;


import com.db.dbworld.audit.activity.dto.LoginDataDto;

import java.util.List;

public interface LoginDataService {
    LoginDataDto addAgentByUserId(String agent, Long userId);
    Long totalNumberOfLogin(Long userId);
    List<LoginDataDto> getLoginHistory(Long userId);
}
