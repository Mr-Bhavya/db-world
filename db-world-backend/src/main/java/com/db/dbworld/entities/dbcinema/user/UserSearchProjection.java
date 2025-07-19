package com.db.dbworld.entities.dbcinema.user;

public interface UserSearchProjection {
    String getFirstName();
    String getLastName();
    String getEmail();

    // This default method combines first and last name for display
    default String getFullName() {
        return getFirstName() + " " + getLastName();
    }
}