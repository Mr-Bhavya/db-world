package com.db.dbworld.entities.fileexplorer;


import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "FILE_EXPLORER", schema = "DB_WORLD")
public class FileEntity {


    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private String fileName;
    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String filePath;
    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String parentFolder;
    private String fileSize;
    private Date creationTime;
    private Date lastModifiedTime;
    private boolean isDirectory;

}
