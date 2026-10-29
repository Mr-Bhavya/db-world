# Media Downloader

Media Downloader prepares media from public HTTP/HTTPS URLs supported by the installed yt-dlp version. DRM-protected content is not supported. Authentication, geographical restrictions, source availability and extractor changes can prevent a download; support for a service does not guarantee every URL will work.

## User Flow

- Sign in, add a URL and inspect it.
- Select video or playlist items, then choose video or audio-only output.
- Use presets or select separate video/audio tracks under Advanced. Exact track IDs apply to single videos; playlist presets resolve independently for each item.
- Review the selection and prepare the files. Each user has one active server preparation job; remaining jobs queue. Admin Media Ingestion is separate.
- Save prepared files explicitly from Download Center. Cinema and Media Downloader share the device-transfer queue, limited to one transfer at a time.
- Prepared server files expire seven days after completion. Deleting a server file does not delete copies already saved on a device.

The website shows browser-managed transfers as handed to the browser, not verified completion. Android uses the native transfer manager. MP3/M4A conversion cannot improve the original source quality.

## Deployment

1. Provide working yt-dlp and FFmpeg binaries through the existing `app.tools` settings.
2. The default private storage directory is `<app.paths.downloads>/media-downloader`. Set `app.downloader.root` to override it. Keep this directory outside static/CDN serving roots and grant the backend account write access.
3. Apply the normal Flyway migrations: V5 creates `media_download_job`; V6 adds persisted track and container settings. Restart the backend for the new entity fields and endpoints.
4. Ensure the media disk is mounted and has space for both working files and completed output. Cleanup runs every minute and retains job history.
5. Test an authorized public video, an audio-only output, a playlist, cancellation, and an Android save on the deployment before treating the feature as release-verified.

Shared source cookies use the existing server configuration. They never go to clients, but they grant users access through that server account and can cause account-wide throttling. Use a dedicated account and restrict cookie file permissions.

The queue is designed for the existing single backend instance. Multiple backend replicas would require distributed job claiming before enabling workers on every instance.

## Administration

Download Management lists user jobs, source, status, queue position, progress, failure reason, size and expiry. Administrators can cancel, retry and delete server files or run expired-file cleanup. Mutations are recorded in backend logs. A running job must stop before its files can be deleted.

Download Center and Home widgets expose only the current user's jobs. Download tickets are file-scoped bearer links; protect them like temporary download credentials. Browser tickets last five minutes; queued native tickets cannot outlive the file's expiry.