package com.db.dbworld.hls;

class ProcessResult {
    final int exitCode;
    final String output;

    ProcessResult(int exitCode, String output) {
        this.exitCode = exitCode;
        this.output = output;
    }
}
