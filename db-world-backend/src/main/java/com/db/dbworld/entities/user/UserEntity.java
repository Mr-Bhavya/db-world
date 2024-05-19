package com.db.dbworld.entities.user;

import com.db.dbworld.annotation.CascadeSave;
import lombok.Getter;
import lombok.Setter;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.List;

@Getter
@Setter
@Document(collection = "USERS")
public class UserEntity {
    @Id
    private ObjectId userId;
    private String firstName;
    private String lastName;
    private int age;
    private String dob;
    private String gender;
    private Long mobileNo;
    @Indexed(unique = true)
    private String email;
    private String password;

    @DocumentReference
    private UserRoleEntity userRole;

    @Field("userAppData")
    @DocumentReference
    private UserAppDataEntity userAppData;

    @DBRef
    @CascadeSave
    private List<PasswordManagerCredential> passwordManager;

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
