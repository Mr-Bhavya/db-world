//package com.db.dbworld.entities.dbcinema.user;
//
//import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
//import com.db.dbworld.core.user.entity.UserEntity;
//import jakarta.persistence.*;
//import lombok.Getter;
//import lombok.Setter;
//import org.hibernate.annotations.ColumnDefault;
//
//import java.io.Serializable;
//
//@Getter
//@Setter
//@Entity
//@Table(name = "USER_RECORD_DATA", schema = "db_world", uniqueConstraints = {
//        @UniqueConstraint(columnNames = {"user", "db_cinema_record"})
//})
//@SequenceGenerator(name="user_record_data_seq", initialValue=1, allocationSize=1)
//public class UserRecordDataEntity implements Serializable {
//    @Id
//    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator="user_record_data_seq")
//    private Long id;
//
//    @ManyToOne(fetch = FetchType.LAZY)
//    @JoinColumn(name = "user", nullable = false)
//    private UserEntity user;
//
//    @ManyToOne(fetch = FetchType.LAZY)
//    @JoinColumn(name = "db_cinema_record", nullable = false)
//    private DBCinemaRecordsEntity dbCinemaRecord;
//
//    @ColumnDefault("false")
//    @Column(nullable = false)
//    private boolean isLiked;
//
//    @ColumnDefault("false")
//    @Column(nullable = false)
//    private boolean isWatched;
//
//    @ColumnDefault("false")
//    @Column(nullable = false)
//    private boolean isWatchListed;
//}
