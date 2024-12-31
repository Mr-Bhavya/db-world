package com.db.dbworld.entities.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false)
    private Long fileSize;

    @JsonProperty("@ref")
//    @JsonSerialize(using = NioPathSerializer.class)
//    @JsonAdapter(PathAdapter.class)
    @Column(nullable = false)
    private String filePath;

    @JsonProperty("track")
    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "mediaFileInfo", referencedColumnName = "id")
    private List<TrackInfoEntity> trackInfos;

//    @PostConstruct
    public MediaFileInfoEntity initialize(DBCinemaRecordsEntity dbCinemaRecordsEntity) throws IOException {
        if (this.filePath != null) {
            this.fileName = Path.of(this.filePath).getFileName().toString();
            this.fileSize = Files.size(Path.of(this.filePath));
        }
        this.dbCinemaRecord = dbCinemaRecordsEntity;
        return this;
    }

//    private GeneralInfo generalInfo;
//    private VideoInfo videoInfo;
//    private List<AudioInfo> audioInfo;
//    private List<TextInfo> textInfo;

}
