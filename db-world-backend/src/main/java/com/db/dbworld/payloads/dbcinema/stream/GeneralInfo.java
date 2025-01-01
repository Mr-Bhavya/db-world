package com.db.dbworld.payloads.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GeneralInfo extends TrackInfo {

    @JsonProperty("UniqueID")
    private String uniqueID;

    @JsonProperty("VideoCount")
    private int videoCount;

    @JsonProperty("AudioCount")
    private int audioCount;

    @JsonProperty("TextCount")
    private int textCount;

    @JsonProperty("MenuCount")
    private int menuCount;

    @JsonProperty("FileExtension")
    private String fileExtension;

    @JsonProperty("Format")
    private String format;

    @JsonProperty("FormatVersion")
    private String formatVersion;

    @JsonProperty("FileSize")
    private long fileSize;

    @JsonProperty("Duration")
    private double duration;

    @JsonProperty("OverallBitRate")
    private long overallBitRate;

    @JsonProperty("FrameRate")
    private double frameRate;

    @JsonProperty("FrameCount")
    private int frameCount;

    @JsonProperty("StreamSize")
    private long streamSize;

    @JsonProperty("IsStreamable")
    private String isStreamable;

    @JsonProperty("Title")
    private String title;

    @JsonProperty("Movie")
    private String movie;

    @JsonProperty("EncodedDate")
    private String encodedDate;

    @JsonProperty("FileCreatedDate")
    private String fileCreatedDate;

    @JsonProperty("FileCreatedDateLocal")
    private String fileCreatedDateLocal;

    @JsonProperty("FileModifiedDate")
    private String fileModifiedDate;

    @JsonProperty("FileModifiedDateLocal")
    private String fileModifiedDateLocal;

    @JsonProperty("EncodedApplication")
    private String encodedApplication;

    @JsonProperty("EncodedLibrary")
    private String encodedLibrary;

    @JsonProperty("Cover")
    private String cover;

    @JsonProperty("Extra")
    private Extra extra;

    private String UniqueID;
    private int VideoCount;
    private int AudioCount;
    private int TextCount;
    private String FileExtension;
    private String Format;
    private String Format_Version;
    private long FileSize;
    private double Duration;
    private int OverallBitRate;
    private double FrameRate;
    private int FrameCount;
    private long StreamSize;
    private String IsStreamable;
    private String Title;
    private String Movie;
    private String Description;
    private String File_Created_Date;
    private String File_Created_Date_Local;
    private String File_Modified_Date;
    private String File_Modified_Date_Local;
    private String Encoded_Application;
    private String Encoded_Library;

    @Getter
    @Setter
    public static class Extra {

        @JsonProperty("Attachments")
        private String attachments;
    }
}

