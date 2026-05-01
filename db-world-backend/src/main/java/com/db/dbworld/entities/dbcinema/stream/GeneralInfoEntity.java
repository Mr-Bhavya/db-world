//package com.db.dbworld.entities.dbcinema.stream;
//
//import com.fasterxml.jackson.annotation.JsonProperty;
//import jakarta.persistence.Column;
//import jakarta.persistence.DiscriminatorValue;
//import jakarta.persistence.Entity;
//import jakarta.persistence.Lob;
//import lombok.Getter;
//import lombok.Setter;
//
//@Getter
//@Setter
//@Entity
//@DiscriminatorValue("General")
//public class GeneralInfoEntity extends TrackInfoEntity {
//
//    @Column(name = "unique_id")
//    @JsonProperty("UniqueID")
//    private String id;
//
//    @Column(name = "video_count")
//    @JsonProperty("VideoCount")
//    private Integer videoCount;
//
//    @Column(name = "audio_count")
//    @JsonProperty("AudioCount")
//    private Integer audioCount;
//
//    @Column(name = "text_count")
//    @JsonProperty("TextCount")
//    private Integer textCount;
//
//    @Column(name = "file_extension")
//    @JsonProperty("FileExtension")
//    private String fileExtension;
//
//    @Column(name = "format")
//    @JsonProperty("Format")
//    private String format;
//
//    @Column(name = "format_version")
//    @JsonProperty("Format_Version")
//    private String formatVersion;
//
//    @Column(name = "file_size")
//    @JsonProperty("FileSize")
//    private Long fileSize;
//
//    @Column(name = "duration")
//    @JsonProperty("Duration")
//    private Double duration;
//
//    @Column(name = "overall_bit_rate")
//    @JsonProperty("OverallBitRate")
//    private Integer overallBitRate;
//
//    @Column(name = "frame_rate")
//    @JsonProperty("FrameRate")
//    private Double frameRate;
//
//    @Column(name = "frame_count")
//    @JsonProperty("FrameCount")
//    private Integer frameCount;
//
//    @Column(name = "stream_size")
//    @JsonProperty("StreamSize")
//    private Long streamSize;
//
//    @Column(name = "is_streamable")
//    @JsonProperty("IsStreamable")
//    private String isStreamable;
//
//    @Column(name = "title")
//    @JsonProperty("Title")
//    private String title;
//
//    @Column(name = "movie")
//    @JsonProperty("Movie")
//    private String movie;
//
//    @Lob
//    @Column(name = "description", columnDefinition = "LONGTEXT")
//    @JsonProperty("Description")
//    private String description;
//
//    @Column(name = "file_created_date")
//    @JsonProperty("File_Created_Date")
//    private String fileCreatedDate;
//
//    @Column(name = "file_created_date_local")
//    @JsonProperty("File_Created_Date_Local")
//    private String fileCreatedDateLocal;
//
//    @Column(name = "file_modified_date")
//    @JsonProperty("File_Modified_Date")
//    private String fileModifiedDate;
//
//    @Column(name = "file_modified_date_local")
//    @JsonProperty("File_Modified_Date_Local")
//    private String fileModifiedDateLocal;
//
//    @Column(name = "encoded_application")
//    @JsonProperty("Encoded_Application")
//    private String encodedApplication;
//
//    @Column(name = "encoded_library")
//    @JsonProperty("Encoded_Library")
//    private String encodedLibrary;
//
//    @Column(name = "encoded_date", columnDefinition = "TEXT")
//    @JsonProperty("Encoded_Date")
//    private String encodedDate;
//
//}