package com.db.dbworld.entities.dbcinema.user;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.user.UserEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "USER_WATCHLIST_RECORD", schema = "db_world", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user", "db_cinema_record"})
})
@SequenceGenerator(name="user_watchlist_record_seq", initialValue=1, allocationSize=1)
public class UserWatchlistRecordEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator="user_watchlist_record_seq")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "db_cinema_record")
    private DBCinemaRecordsEntity dbCinemaRecord;

    @Column(nullable = false)
    private boolean isWatchListed;
}
