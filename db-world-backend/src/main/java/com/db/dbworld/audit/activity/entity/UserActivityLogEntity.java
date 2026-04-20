package com.db.dbworld.audit.activity.entity;

import com.db.dbworld.core.user.entity.UserEntity;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_activity_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserActivityLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_email")
    private String userEmail;

    private String method;
    private String uri;
    @Lob
    @Column(columnDefinition = "TEXT")
    private String query;
    @Lob
    @Column(columnDefinition = "TEXT")
    private String requestBody;
    private String ip;
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String userAgent;
    private int status;
    private long duration;
    private String requestId;
    private LocalDateTime timestamp;

}
