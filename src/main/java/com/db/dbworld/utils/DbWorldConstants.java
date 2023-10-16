package com.db.dbworld.utils;

public class DbWorldConstants {

    public static final String OWNER = "OWNER";
    public static final String ADMIN = "ADMIN";
    public static final String VIEWER = "VIEWER";
    public static final String [] AUTHENTICATED_APIS = new String[]{
            "/api/user/**",
    };
    public static final String [] PUBLIC_APIS = new String []{
            "/api/auth/**",
            "/api/user/userbyemail"
    };
}
