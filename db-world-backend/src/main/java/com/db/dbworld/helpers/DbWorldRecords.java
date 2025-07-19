package com.db.dbworld.helpers;

import com.db.dbworld.entities.user.UserEntity;

import java.time.Duration;

/**
 * Utility class containing record definitions for common data structures.
 * All records are immutable and include validation.
 */
public final class DbWorldRecords {

    /**
     * Immutable record representing file size information.
     * @param fileSize The size of the file in bytes (must be non-negative)
     */
    public static record FileSizeInfo(long fileSize) {
        public FileSizeInfo {
            if (fileSize < 0) {
                throw new IllegalArgumentException("File size cannot be negative");
            }
        }
    }

    /**
     * Immutable record representing range information for partial content requests.
     * @param rangeStart The starting byte position (must be non-negative)
     * @param isPartial Whether this represents a partial content request
     */
    public static record RangeInfo(long rangeStart, boolean isPartial) {
        public RangeInfo {
            if (rangeStart < 0) {
                throw new IllegalArgumentException("Range start cannot be negative");
            }
        }
    }

    public record AuthTokens(String accessToken, String refreshToken, Duration refreshTokenTtl, UserEntity userEntity) {

        public static final String REFRESH_TOKEN_COOKIE_NAME = "RefreshToken";

    }

    public record StreamableFileInfo(String fileName, String filePath, boolean isDirectory, boolean isFile, long fileSize,
                                     String fileId) {
    }

    // Private constructor to prevent instantiation
    private DbWorldRecords() {
        throw new AssertionError("Utility class should not be instantiated");
    }


}