package com.db.dbworld.entities;

import com.db.dbworld.utils.DbWorldConstants;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Getter
@Setter
@Document(collection = "users")
public class UserEntity {
    @Id
    private String userId;
    private String firstName;
    private String lastName;
    private String age;
    private String dob;
    private String gender;
    private Long mobileNo;
    private String email;
    private String password;
    private String userRole;
    private UserAppData userAppData;
    private List<UserCredential> userCredential;

    @Data
    public class UserAppData {
        private Long noOfLogin;
        private List<LoginDetails> loginDetails;

        @Data
        public class LoginDetails {
            private String timeStamp;
            private String userAgent;
        }
    }

    @Data
    public class UserCredential {
        private String host;
        private String credentials;
    }

    @Override
    public String toString() {
        return "Users{" +
                "userId='" + userId + '\'' +
                ", firstName='" + firstName + '\'' +
                ", lastName='" + lastName + '\'' +
                ", age='" + age + '\'' +
                ", gender='" + gender + '\'' +
                ", mobileNo='" + mobileNo + '\'' +
                ", email='" + email + '\'' +
                ", password='" + password + '\'' +
                ", userAppData=" + userAppData +
                '}';
    }
}
