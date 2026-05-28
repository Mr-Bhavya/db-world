package com.db.dbworld.app.admin.analytics.dto;

import java.sql.Date;

public interface DailyActivityProjection {
    Date getDate();
    Long getStreams();
    Long getDownloads();
    Long getBytesTransferred();
}
