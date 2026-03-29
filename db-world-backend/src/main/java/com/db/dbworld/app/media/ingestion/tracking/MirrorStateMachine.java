package com.db.dbworld.app.media.ingestion.tracking;

public class MirrorStateMachine {
    public boolean isTerminal(MirrorStatus status) {
        return status == MirrorStatus.SUCCESS ||
                status == MirrorStatus.FAILED ||
                status == MirrorStatus.CANCELLED;
    }

    public boolean canTransition(MirrorStatus from, MirrorStatus to) {
        if (isTerminal(from)) return false;

        return switch (from) {
            case QUEUED -> to == MirrorStatus.STARTED || to == MirrorStatus.CANCELLED;

            case STARTED -> to == MirrorStatus.DOWNLOADING || to == MirrorStatus.FAILED;

            case DOWNLOADING -> to == MirrorStatus.PROCESSING ||
                    to == MirrorStatus.PAUSED ||
                    to == MirrorStatus.CANCELLED ||
                    to == MirrorStatus.FAILED;

            case PROCESSING -> to == MirrorStatus.SUCCESS ||
                    to == MirrorStatus.FAILED;

            case PAUSED -> to == MirrorStatus.DOWNLOADING ||
                    to == MirrorStatus.CANCELLED;

            default -> false;
        };
    }
}
