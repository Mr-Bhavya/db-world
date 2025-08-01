package com.db.dbworld.services.auth;


import com.db.dbworld.payloads.user.LoginDataDto;

public interface LoginDataService {
    LoginDataDto addAgentByUserId(String agent, Long userId);
    Long totalNumberOfLogin(Long userId);
}
