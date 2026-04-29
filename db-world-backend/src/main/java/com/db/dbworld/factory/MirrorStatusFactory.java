package com.db.dbworld.factory;

import com.db.dbworld.config.AppProperties;
import com.db.dbworld.payloads.MirrorStatus;
import org.springframework.stereotype.Component;

@Component
public class MirrorStatusFactory {

    private final AppProperties runtime;

    public MirrorStatusFactory(AppProperties runtime) {
        this.runtime = runtime;
    }

    /**
     * Primary creation entry point
     */
    public MirrorStatus create(
            String folderName,
            String fileUrl,
            String fileName,
            Long fileSize,
            boolean extract
    ) {
        return new MirrorStatus(
                runtime,
                folderName,
                fileUrl,
                fileName,
                fileSize,
                extract
        );
    }

    /**
     * FileUrl with Auth
     */
    public MirrorStatus create(
            String folderName,
            String fileUrl,
            String fileName,
            Long fileSize,
            String username,
            String password,
            boolean extract
    ) {
        MirrorStatus status = new MirrorStatus(
                runtime,
                folderName,
                fileUrl,
                fileName,
                fileSize,
                extract
        );
        status.setUrlPassword(password);
        status.setUrlUsername(username);
        status.setUrlProtected(true);
        return status;
    }

    /**
     * Overload for optional params
     */
    public MirrorStatus create(
            String folderName,
            String fileUrl,
            String fileName,
            Long fileSize,
            boolean extract,
            String videoITag,
            String audioITag,
            boolean onlyAudio
    ) {
        MirrorStatus status = new MirrorStatus(
                runtime,
                folderName,
                fileUrl,
                fileName,
                fileSize,
                extract
        );
        status.setVideoITag(videoITag);
        status.setAudioITag(audioITag);
        status.setOnlyAudio(onlyAudio);
        return status;
    }
}