package com.db.dbworld.services.Impl;

import com.db.dbworld.entities.user.UserRoleEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserDetailImpl implements UserDetails {
    private Long userId;
    private String firstName;
    private String lastName;
    private String age;
    @JsonFormat(pattern="yyyy-MM-dd")
    private Date dob;
    private String gender;
    private Long mobileNo;
    private String email;
    private String password;
    private UserRoleEntity role;

    /**
     * @return
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        if(role == null){
            throw new DbWorldException(HttpStatus.FORBIDDEN, "You don't have any role. first please assign to you role from administrator.");
        }
        authorities.add(new SimpleGrantedAuthority(role.getName()));
        return authorities;
    }

    /**
     * @return
     */
    @Override
    public String getPassword() {
        return this.password;
    }

    /**
     * @return
     */
    @Override
    public String getUsername() {
        return this.email;
    }

    /**
     * @return
     */
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    /**
     * @return
     */
    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    /**
     * @return
     */
    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    /**
     * @return
     */
    @Override
    public boolean isEnabled() {
        return true;
    }
}
