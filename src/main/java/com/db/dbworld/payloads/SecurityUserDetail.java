package com.db.dbworld.payloads;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

public class SecurityUserDetail implements UserDetails {
    /**
     * @return
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return null;
    }

    /**
     * @return
     */
    @Override
    public String getPassword() {
        return null;
    }

    /**
     * @return
     */
    @Override
    public String getUsername() {
        return null;
    }

    /**
     * @return
     */
    @Override
    public boolean isAccountNonExpired() {
        return false;
    }

    /**
     * @return
     */
    @Override
    public boolean isAccountNonLocked() {
        return false;
    }

    /**
     * @return
     */
    @Override
    public boolean isCredentialsNonExpired() {
        return false;
    }

    /**
     * @return
     */
    @Override
    public boolean isEnabled() {
        return false;
    }
}
