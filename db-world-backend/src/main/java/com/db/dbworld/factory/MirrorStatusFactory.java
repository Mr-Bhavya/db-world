package com.db.dbworld.factory;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import org.springframework.stereotype.Component;

@Component
public class MirrorStatusFactory {

    private final DbWorldRuntimeProperties runtime;

    public MirrorStatusFactory(DbWorldRuntimeProperties runtime) {
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