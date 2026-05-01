package com.db.dbworld.entities.dbcinema.user;

public interface UserSearchProjection {
    Long getUserId();
    String getFirstName();
    String getLastName();
    String getEmail();

    default String getFullName() {
        return getFirstName() + " " + getLastName();
    }
}