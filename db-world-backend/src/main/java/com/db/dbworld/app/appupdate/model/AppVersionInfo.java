package com.db.dbworld.app.appupdate.model;

/**
 * Latest published Android build, surfaced to the app's in-app updater.
 *
 * Populated from {@code version.json} that the Jenkins release pipeline writes
 * alongside {@code app-release.apk} in the configured release directory.
 *
 * @param versionCode      monotonic Android versionCode of the latest build
 * @param versionName      human-readable version (e.g. "1.4.0")
 * @param apkUrl           relative download path; the app resolves it against its API base
 * @param mandatory        when true the app blocks usage until the user updates
 * @param minSupportedCode any installed versionCode below this is force-updated
 * @param changelog        short release notes shown in the update dialog
 * @param sizeBytes        APK size (for the download progress UI)
 */
public record AppVersionInfo(
        long   versionCode,
        String versionName,
        String apkUrl,
        boolean mandatory,
        long   minSupportedCode,
        String changelog,
        long   sizeBytes
) {}
