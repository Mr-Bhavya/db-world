package com.db.dbworld.utils;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class DbWorldUtils {

    @Autowired
    private PasswordEncoder passwordEncoder;
    private String encodePassword(String password){
        return passwordEncoder.encode(password);
    }

}
