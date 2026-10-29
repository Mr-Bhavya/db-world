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

## Inspection Troubleshooting

Inspection has a hard 75-second deadline, configurable with `app.downloader.probe-timeout-seconds`. Progress or retry output cannot extend that deadline. Probe requests use shorter network timeouts and fewer retries than downloads. The browser allows 90 seconds for the request, so keep that client timeout above the configured server deadline. Cancelling inspection stops the client request; an already-running server probe remains bounded by its deadline.

For YouTube extraction failures, check that yt-dlp is current, its supported JavaScript runtime is available to the backend account, and shared cookies are fresh. Authentication, verification challenges and rate limits cannot be fixed by retrying indefinitely. Process-failure logs include the stage, exit code, elapsed time and a classified reason without echoing cookie contents or credential-bearing URLs.

### Capturing Inspection Diagnostics

After deploying the diagnostics and restarting the backend, reproduce once and save the request's JSON response body and request ID. Collect `Media inspection`, `Media process` and `Media egress` lines for that request/trace ID; proxy logs preserve the request context across their virtual threads. An additional `inspection` ID ties source validation, proxy connections and the completion/failure summary together.

INFO logs record the source host (not the URL), URL-validation time, cookie configuration/readability, tool path, effective retry/timeouts, process PID, first-output delay, exit code, metadata counts and proxy DNS/connect/relay stages. WARN logs include bounded, redacted tool output on errors and timeouts. For one difficult reproduction, temporarily enable `logging.level.com.db.dbworld.app.downloader=DEBUG` to see each redacted probe-output line, then return to INFO. Full metadata JSON, raw command lines and cookie contents are not logged.

Share the public source URL, the request's `playlist` value, JSON response body, correlated diagnostic lines, deployed backend commit, yt-dlp version, and available supported JavaScript runtime/version. Also report whether the identical URL works through Admin Media Ingestion on the same server. Do not share authorization headers, browser cookies, cookie files, private links, full HAR exports or unredacted verbose yt-dlp output.

Audit writes use an independent transaction with a 10-second statement timeout. Hikari's apparent-leak warning identifies a connection held longer than the configured detection threshold, not necessarily a permanently leaked connection. If it persists, check MySQL lock waits, slow inserts, connection/socket health and whether Hikari subsequently reports that the connection was returned. A JDBC transaction timeout does not guarantee that a broken network socket will be interrupted.

## Administration

Download Management lists user jobs, source, status, queue position, progress, failure reason, size and expiry. Administrators can cancel, retry and delete server files or run expired-file cleanup. Mutations are recorded in backend logs. A running job must stop before its files can be deleted.

Download Center and Home widgets expose only the current user's jobs. Download tickets are file-scoped bearer links; protect them like temporary download credentials. Browser tickets last five minutes; queued native tickets cannot outlive the file's expiry.