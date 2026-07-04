package com.db.dbworld.audit.tracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "SEARCH_HISTORY", schema = "new_db_world",
    indexes = {
        @Index(name = "idx_sh_user_created", columnList = "user_id, created_at"),
        @Index(name = "idx_sh_query_norm",   columnList = "query_norm")
    })
public class SearchHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id") private Long userId;

    @Column(name = "query_raw", length = 256) private String queryRaw;
    @Column(name = "query_norm", length = 256) private String queryNorm;

    @Column(name = "result_count") private Integer resultCount;
    @Column(name = "opened_record_id") private Long openedRecordId;

    @Column(name = "channel", length = 12) private String channel;

    @Column(name = "created_at") private Instant createdAt;
}
