package com.db.dbworld.entities.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user")
    private UserEntity user;

    private String method;
    private String uri;
    @Lob
    private String query;
    @Lob
    private String requestBody;
    private String ip;
    private String userAgent;
    private int status;
    private long duration;
    private String requestId;
    private LocalDateTime timestamp;

    // This will be serialized as "username" in the JSON
    @JsonProperty("username")
    public String getUsername() {
        return user != null ? user.getEmail() : "Anonymous";
    }

    // Add this to expose user ID if needed
    @JsonProperty("userId")
    public Long getUserId() {
        return user != null ? user.getUserId() : null;
    }
}
