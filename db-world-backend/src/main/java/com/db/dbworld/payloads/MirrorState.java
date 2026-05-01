package com.db.dbworld.payloads;

public enum MirrorState {
    DOWNLOAD, EXTRACT, MERGE, FFMPEG, COMPLETE, FAILED, CANCELLED, PAUSE, RESUME, SUCCESS
}
