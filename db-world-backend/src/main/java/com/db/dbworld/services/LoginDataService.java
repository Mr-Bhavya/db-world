package com.db.dbworld.services;


import com.db.dbworld.payloads.user.LoginDataDto;

public interface LoginDataService {
    LoginDataDto addAgentByUserId(String agent, Long userId);
    Integer totalNumberOfLogin(Long userId);
}
