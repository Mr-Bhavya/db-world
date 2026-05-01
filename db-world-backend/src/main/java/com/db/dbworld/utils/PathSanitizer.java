package com.db.dbworld.utils;

import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.io.File;

public class PathSanitizer {

    // Illegal characters for filenames across all platforms
    private static final String ILLEGAL_FILENAME_CHARS = "[<>:\"|?*\\x00/\\\\]";

    // Pattern for multiple spaces
    private static final Pattern MULTIPLE_SPACES_PATTERN = Pattern.compile("\\s{2,}");

    // Pattern for trailing dots and spaces
    private static final Pattern TRAILING_PROBLEMATIC_CHARS = Pattern.compile("[ .]+$");
    private static final Pattern LEADING_PROBLEMATIC_CHARS = Pattern.compile("^[ .]+");

    // Private constructor to prevent instantiation
    private PathSanitizer() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    /**
     * Sanitizes a full path by preserving directory structure but sanitizing each component
     * and converting multiple spaces to single spaces.
     *
     * @param path the original path to sanitize
     * @return the sanitized path with preserved directory structure
     */
    public static String sanitizePath(String path) {
        if (path == null || path.isEmpty()) {
            return path;
        }

        // Split the path into components
        String[] pathComponents = path.split("[\\\\/]");
        StringBuilder sanitizedPath = new StringBuilder();

        for (int i = 0; i < pathComponents.length; i++) {
            String component = pathComponents[i];

            // Skip empty components (like leading slash)
            if (component.isEmpty()) {
                if (i == 0) {
                    // Preserve leading slash for absolute paths
                    sanitizedPath.append(File.separator);
                }
                continue;
            }

            // Sanitize each path component (directory or filename)
            String sanitizedComponent = sanitizePathComponent(component);

            if (!sanitizedPath.isEmpty() &&
                    sanitizedPath.charAt(sanitizedPath.length() - 1) != File.separatorChar) {
                sanitizedPath.append(File.separator);
            }

            sanitizedPath.append(sanitizedComponent);
        }

        return sanitizedPath.toString();
    }

    /**
     * Sanitizes a path component (directory name or filename) without affecting separators
     */
    public static String sanitizePathComponent(String component) {
        if (component == null || component.isEmpty()) {
            return "unnamed";
        }

        // Remove illegal filename characters
        String sanitized = component.replaceAll(ILLEGAL_FILENAME_CHARS, "-");

        // Convert multiple spaces to single space
        sanitized = normalizeSpaces(sanitized);

        // Remove leading/trailing spaces and dots
        sanitized = removeProblematicLeadingChars(sanitized);
        sanitized = removeProblematicTrailingChars(sanitized);

        return sanitized.isEmpty() ? "unnamed" : sanitized;
    }

    /**
     * Sanitizes just a filename (without any path components)
     */
    public static String sanitizeFilename(String filename) {
        if (filename == null || filename.isEmpty()) {
            return "unnamed";
        }

        // Extract just the filename part if a path is provided
        String pureFilename = new File(filename).getName();

        // Sanitize the filename component
        return sanitizePathComponent(pureFilename);
    }

    /**
     * Sanitizes a path for a specific target operating system
     */
    public static String sanitizePathForOS(String path, String osType) {
        if (path == null || path.isEmpty()) {
            return path;
        }

        // First sanitize the path structure
        String sanitizedPath = sanitizePath(path);

        // OS-specific adjustments if needed
        if (osType != null) {
            switch (osType.toLowerCase()) {
                case "windows":
                    // Windows-specific adjustments
                    break;
                case "linux":
                case "ubuntu":
                    // Linux-specific adjustments
                    break;
                case "mac":
                case "macos":
                    // macOS-specific adjustments
                    break;
            }
        }

        return sanitizedPath;
    }

    /**
     * Converts multiple spaces to single spaces
     */
    private static String normalizeSpaces(String text) {
        Matcher matcher = MULTIPLE_SPACES_PATTERN.matcher(text);
        return matcher.replaceAll(" ").trim();
    }

    /**
     * Removes problematic leading characters (spaces, dots)
     */
    private static String removeProblematicLeadingChars(String text) {
        Matcher matcher = LEADING_PROBLEMATIC_CHARS.matcher(text);
        return matcher.replaceAll("");
    }

    /**
     * Removes problematic trailing characters (spaces, dots)
     */
    private static String removeProblematicTrailingChars(String text) {
        Matcher matcher = TRAILING_PROBLEMATIC_CHARS.matcher(text);
        return matcher.replaceAll("");
    }

    /**
     * Utility method to get file extension
     */
    public static String getFileExtension(String filename) {
        if (filename == null) {
            return "";
        }
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < filename.length() - 1) {
            return filename.substring(lastDotIndex + 1);
        }
        return "";
    }

    /**
     * Sanitizes filename while preserving extension
     */
    public static String sanitizeFilenameWithExtension(String filename) {
        if (filename == null || filename.isEmpty()) {
            return "unnamed";
        }

        String extension = getFileExtension(filename);
        String baseName = extension.isEmpty() ? filename :
                filename.substring(0, filename.lastIndexOf('.'));

        String sanitizedBase = sanitizeFilename(baseName);

        return extension.isEmpty() ? sanitizedBase : sanitizedBase + "." + extension;
    }

    // Test method
    public static void main(String[] args) {
        // Test cases
        String[] testPaths = {
                "path/to/file<name>.txt",
                "C:\\Users\\test\\file:name.docx",
                "folder  with  spaces/file*.txt",
                "con:tains?illegal*chars/path",
                "  leading spaces/file.txt  ",
                "...dots.at.ends.../file",
                "normal/path/file.txt",
                "file|name",
                "file\"name",
                "/absolute/path/file.txt",
                ""
        };

        System.out.println("Original -> Sanitized");
        System.out.println("---------------------");
        for (String path : testPaths) {
            System.out.println("****************************");
            String sanitized = sanitizeFilename(path);
            System.out.println("'" + path + "' -> '" + sanitized + "'");
            System.out.println("****************************");

            System.out.println("****************************");
            sanitized = sanitizePath(path);
            System.out.println("'" + path + "' -> '" + sanitized + "'");
            System.out.println("****************************");

            System.out.println("****************************");
            sanitized = sanitizeFilenameWithExtension(path);
            System.out.println("'" + path + "' -> '" + sanitized + "'");
            System.out.println("****************************");

            System.out.println("****************************");
            sanitized = sanitizePathComponent(path);
            System.out.println("'" + path + "' -> '" + sanitized + "'");
            System.out.println("****************************");
        }

        System.out.println("\nFilename only sanitization:");
        String[] testFilenames = {
                "file<name>.txt",
                "document  with  spaces.pdf",
                "con:tains?illegal*chars",
                "  leading and trailing  "
        };

        for (String filename : testFilenames) {
            System.out.println("****************************");
            String sanitized = sanitizeFilename(filename);
            System.out.println("'" + filename + "' -> '" + sanitized + "'");
            System.out.println("****************************");

            System.out.println("****************************");
            sanitized = sanitizePath(filename);
            System.out.println("'" + filename + "' -> '" + sanitized + "'");
            System.out.println("****************************");

            System.out.println("****************************");
            sanitized = sanitizeFilenameWithExtension(filename);
            System.out.println("'" + filename + "' -> '" + sanitized + "'");
            System.out.println("****************************");

            System.out.println("****************************");
            sanitized = sanitizePathComponent(filename);
            System.out.println("'" + filename + "' -> '" + sanitized + "'");
            System.out.println("****************************");
        }
    }
}