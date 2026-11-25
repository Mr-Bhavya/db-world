package com.db.dbworld.app.media.aria2;

import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;

public final class Aria2Progress {

    private Aria2Progress() {}

    public static ProgressSnapshot from(Aria2StatusParam status) {
        long total = status.getTotalLength() != null ? status.getTotalLength() : 0;
        long completed = status.getCompletedLength() != null ? status.getCompletedLength() : 0;
        long speed = status.getDownloadSpeed() != null ? status.getDownloadSpeed() : 0;
        long eta = speed > 0 && total > completed ? (total - completed) / speed : 0;
        String phase = switch (status.getStatus() != null ? status.getStatus() : "") {
            case "waiting" -> "aria2-waiting";
            case "paused" -> "aria2-paused";
            default -> "downloading";
        };
        return new ProgressSnapshot(completed, total, speed, eta, phase);
    }
}
