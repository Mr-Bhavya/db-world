package com.db.dbworld.entities.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@DiscriminatorValue("General")
public class GeneralInfoEntity extends TrackInfoEntity {

    @Column(name = "UniqueID")
    @JsonProperty("UniqueID")
    private String id;

    @Column(name = "VideoCount")
    @JsonProperty("VideoCount")
    private Integer videoCount;

    @Column(name = "AudioCount")
    @JsonProperty("AudioCount")
    private Integer audioCount;

    @Column(name = "TextCount")
    @JsonProperty("TextCount")
    private Integer textCount;

    @Column(name = "FileExtension")
    @JsonProperty("FileExtension")
    private String fileExtension;

    @Column(name = "Format")
    @JsonProperty("Format")
    private String format;

    @Column(name = "Format_Version")
    @JsonProperty("Format_Version")
    private String formatVersion;

    @Column(name = "FileSize")
    @JsonProperty("FileSize")
    private Long fileSize;

    @Column(name = "Duration")
    @JsonProperty("Duration")
    private Double duration;

    @Column(name = "OverallBitRate")
    @JsonProperty("OverallBitRate")
    private Integer overallBitRate;

    @Column(name = "FrameRate")
    @JsonProperty("FrameRate")
    private Double frameRate;

    @Column(name = "FrameCount")
    @JsonProperty("FrameCount")
    private Integer frameCount;

    @Column(name = "StreamSize")
    @JsonProperty("StreamSize")
    private Long streamSize;

    @Column(name = "IsStreamable")
    @JsonProperty("IsStreamable")
    private String isStreamable;

    @Column(name = "Title")
    @JsonProperty("Title")
    private String title;

    @Column(name = "Movie")
    @JsonProperty("Movie")
    private String movie;

    @Lob
    @Column(name = "Description", columnDefinition = "LONGTEXT")
    @JsonProperty("Description")
    private String description;

    @Column(name = "File_Created_Date")
    @JsonProperty("File_Created_Date")
    private String fileCreatedDate;

    @Column(name = "File_Created_Date_Local")
    @JsonProperty("File_Created_Date_Local")
    private String fileCreatedDateLocal;

    @Column(name = "File_Modified_Date")
    @JsonProperty("File_Modified_Date")
    private String fileModifiedDate;

    @Column(name = "File_Modified_Date_Local")
    @JsonProperty("File_Modified_Date_Local")
    private String fileModifiedDateLocal;

    @Column(name = "Encoded_Application")
    @JsonProperty("Encoded_Application")
    private String encodedApplication;

    @Column(name = "Encoded_Library")
    @JsonProperty("Encoded_Library")
    private String encodedLibrary;

}

