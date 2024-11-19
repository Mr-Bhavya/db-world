package com.db.dbworld.payloads.user;

import com.db.dbworld.entities.user.UserEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;

import java.util.Date;

@Getter
@Setter
public class UserCinemaDataDto {

    private Long id;

    private String user;

    private String download_file;

    private String stream_file;

    private String search_keyword;

    private Date time;

}
