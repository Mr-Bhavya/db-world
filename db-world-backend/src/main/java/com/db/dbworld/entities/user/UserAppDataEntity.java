package com.db.dbworld.entities.user;

import lombok.Getter;
import lombok.Setter;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Document(collection = "USER_APP_DATA")
public class UserAppDataEntity {

    @Id
    private ObjectId id;
    @DocumentReference(lazy = true)
    @Indexed(unique = true)
    private UserEntity user;
    private Long noOfLogin;
    private List<LoginDetails> loginDetails;
    private CinemaRecord cinemaRecord;

    @Getter
    @Setter
    public static class CinemaRecord{
        private String id;
        private ArrayList<String> like;
        private ArrayList<String> disLike;
        private ArrayList<String> rate;
        private ArrayList<String> watchList;
        private String[] searchHistory;
        private String[] watched;
    }

    public UserAppDataEntity(){
        this.noOfLogin = 0L;
        this.loginDetails = new ArrayList<>();
    }

    @Getter
    @Setter
    public static class LoginDetails {
        private long timeStamp;
        private String userAgent;
    }
}
