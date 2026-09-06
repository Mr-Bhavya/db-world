package com.db.dbworld.core.user.dto;

import com.db.dbworld.core.role.dto.RoleDto;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.io.Serializable;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserDto {

    private Long userId;
    private String firstName;
    private String lastName;
    private int age;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date dob;

    private String gender;
    private Long mobileNo;
    private String email;

    private RoleDto userRole;

    private boolean enabled;
    private boolean accountNonLocked;

    /** Google profile picture, cached at sign-in so the avatar renders without a second call. */
    private String avatarUrl;
    private boolean emailVerified;

    /** True when a local password exists. False means the account can only sign in with Google. */
    private boolean hasPassword;
    /** True when a Google identity is linked. */
    private boolean googleLinked;

    /** Set while the account sits in its deletion grace window; null otherwise. */
    private java.time.Instant deletedAt;
    /** When the data will actually be erased. Null unless {@link #deletedAt} is set. */
    private java.time.Instant purgeAfter;

    private Date creationDate;
    private Date lastModifiedDate;

    private Long noOfLogin;

    private List<LoginData> loginData;
    private CinemaData cinemaData;

    @Getter
    @Setter
    public static class LoginData {
        private Date lastLoginDate;
        private String loginAgent;
    }

    @Getter
    @Setter
    public static class CinemaData {
        private Map<String, List<String>> events;
    }
}