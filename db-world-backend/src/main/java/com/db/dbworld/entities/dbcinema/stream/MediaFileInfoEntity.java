package com.db.dbworld.entities.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "MEDIA_FILE_INFO", schema = "db-world", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"db_cinema_record", "filePath", "fileSize"})
})
public class MediaFileInfoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "db_cinema_record")
    private DBCinemaRecordsEntity dbCinemaRecord;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String fileName;

    @Column(nullable = false)
    private Long fileSize;

    @JsonProperty("@ref")
    @Column(nullable = false, length = 764)
    private String filePath;

    @JsonProperty("track")
    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "mediaFileInfo", referencedColumnName = "id")
    private List<TrackInfoEntity> trackInfos;

//    @PostConstruct
    public MediaFileInfoEntity initialize(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        if (this.filePath != null) {
            String[] filePathArray = filePath.replace("\\","/").split("/");
            this.fileName = filePathArray[filePathArray.length - 1];
            trackInfos.forEach(trackInfoEntity -> {
                if(trackInfoEntity instanceof GeneralInfoEntity generalInfoEntity){
                    this.fileSize = generalInfoEntity.getFileSize();
                }
            });
        }
        this.dbCinemaRecord = dbCinemaRecordsEntity;
        return this;
    }

}
