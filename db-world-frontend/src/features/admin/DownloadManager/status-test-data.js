const StatusTestData = [
    // 1. Active Download (Long filename)
    {
        status: {
            id: "1",
            fileName: "very_very_very_very_very_very_very_long_movie_filename_that_should_be_truncated_properly_in_ui.mkv",
            fileUrl: "https://cdn.example.com/longmovie.mkv",
            fileSize: 2147483648,
            currentState: "DOWNLOAD",
            folderName: "Movies",
            magnet: false,
            downloadStatus: {
                speed: 9.3,
                fileDownloaded: 1073741824,
                eta: 118
            },
            message: "<div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:56.196] [stdout] Added active download mapping - GID:bc96110417c9995d  → MirrorId: 1769872852716</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:56.207] [stdout] 🔍 Started monitoring GID bc96110417c9995d for mirror 1769872852716</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:58.722] [stdout] 📁 File info updated from Aria2 (files array): ADGPM2nPUmCKabYTXwO0zb56RybeV4evGXxX9FyFA1eIMAw1-Sp4eVyrQoDkJaJYm6YcPIXt_hAB7_YlPaKNBoGJtGb0tuI91Jix6OMgr-wvW29EE4R6gx6Wd82Z6ZHMQ6M-Lf7yrEAS8jLbOvq9S9HjttZ1GSmA74Y6_pkcLKb1VPo_7YB_fTBFiCfC-X9c2tmoctBxOt1OSk1pNU9W3vE2HscJswbptzwOgR8W-I6ea4rcqen-Ns4gWfr0EhoIEsZQ6HWikndgRoC43_t4O0OJqwbDLjWhMVdcC_kinZKK3StfjegOoY7xlv5T0MU8-upVW8MN2FBiC7pSYqkX1I2EsWDzapySMnQ74PMLmUeDvcmE9PXleZb5i-Gb8eGRsfWULDvGR_X5bK16gB7IJSyrDhz5odIQnrC1pMKMirXg9w-dqgqG4WU_lQWsL5QwtcaVMAz8bL2Qr-V9kk1D00pUW8rVgL7ach1eKmfUxSYB70sEvvbCh9bpBo0MCW6uVcsxIY_JP3d-7-Y2r9qEOr9ggCq1alCrEUvxXQyldUkQWVzqHQ5dZP6_l8BM9AevOo7U31eGkEqjoJyk_w6EN4l5ZKg-IWZ9EEOuJCkY6wKSyxxcRxnU9GP1ropqFgAwWmiZ0-LkPTD8FyQefaPpW-G5dPYq4cYGwtvpJHyQWt17pkacP0HlBmxbllrvWGsyKaaeHDaBNz7KJfxOEWI2yoRS-075UCwi0AhR2-7cVakYNPYKmshCZxZI1NTSxuiFsZhs8migUL7NtwuzU2li7KlHyyPCHzDYVXrGioSeALFZuc2oFeuzXoAGy-SWX9k4ZYXrY--7pYOBLnuoMwYKUPuSQWIKiToxh6qoM-kS_996fwG3TWG0qnBzU_6Io43jqHc1nOtpKbP63Y9BZb52XvtZ77RwqOQ0gpdoS9F9NKjMYg7lSVN_KQH_u-lxhEcvREIzoPoR4FPrxvljHwMLc6R3NpqZlx00f1EWoXJlpzNit9z3IQbiLKL66gdlI6zt2VGyMFq8bqaetkZgTPzpVWI653adodsVA3j09LdBe0FBIx2asvnR0y6v6vgQnJsyr8tOz4pocFDQ → Dhurandhar.2025.REPACK.1080p.NF.WEB-DL.Multi.AAC5.1.AV1-CPTN5DW.mkv</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.726] [stdout] ✅ Download completed</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] 🔍 Starting post-download tasks</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] ✅ Download completed, starting processing</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] 🔄 Starting media processing</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.729] [stdout] 🔄 Starting media processing...</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.730] [stdout] 📁 Processing with record ID: 4182</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 21:00:40.647] [stdout] ✅ Media processing completed successfully!</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 21:00:40.647] [stdout] ✅ Media processing completed successfully</div>"
        },
        isRunning: true,
        isQueued: false
    },

    // 2. Queued Download (0 progress)
    {
        status: {
            id: "2",
            fileName: "queued_file.mkv",
            fileUrl: "https://cdn.example.com/queued.mkv",
            fileSize: 3000000000,
            currentState: "DOWNLOAD",
            folderName: "Queue",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 0,
                eta: 0
            },
            message: "Waiting for slot"
        },
        isRunning: false,
        isQueued: true,
        queuePosition: 3
    },

    // 3. Paused
    {
        status: {
            id: "3",
            fileName: "paused_documentary.mp4",
            fileUrl: "https://cdn.example.com/doc.mp4",
            fileSize: 5000000000,
            currentState: "PAUSE",
            folderName: "Docs",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 2000000000,
                eta: 0
            },
            message: "User paused download"
        },
        isRunning: false,
        isQueued: false
    },

    // 4. Resume State
    {
        status: {
            id: "4",
            fileName: "resumable_linux_iso.iso",
            fileUrl: "https://cdn.example.com/linux.iso",
            fileSize: 4294967296,
            currentState: "RESUME",
            folderName: "ISOs",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 2147483648,
                eta: 0
            },
            message: "Resuming download from paused state"
        },
        isRunning: false,
        isQueued: false
    },

    // 5. Extract
    {
        status: {
            id: "5",
            fileName: "archive.zip",
            fileSize: 100000000,
            currentState: "EXTRACT",
            folderName: "Archives",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 100000000,
                eta: 0
            },
            message: "Extracting files..."
        },
        isRunning: false
    },

    // 6. Merge
    {
        status: {
            id: "6",
            fileName: "merge_video_audio.mp4",
            fileSize: 700000000,
            currentState: "MERGE",
            folderName: "YouTube",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 700000000,
                eta: 0
            },
            message: "Merging audio and video streams"
        },
        isRunning: true
    },

    // 7. FFMPEG
    {
        status: {
            id: "7",
            fileName: "ffmpeg_processing.mp4",
            fileSize: 800000000,
            currentState: "FFMPEG",
            folderName: "Re-encode",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 800000000,
                eta: 0
            },
            message: "Re-encoding video using ffmpeg"
        },
        isRunning: false
    },

    // 8. Magnet Torrent
    {
        status: {
            id: "8",
            fileName: "Ubuntu 24.04 LTS",
            fileUrl: "magnet:?xt=urn:btih:ABC123",
            fileSize: 6000000000,
            currentState: "DOWNLOAD",
            folderName: "Torrents",
            magnet: true,
            downloadStatus: {
                speed: 2.1,
                fileDownloaded: 1000000000,
                eta: 2048
            },
            message: "Torrent downloading, 3 seeders"
        },
        isRunning: true
    },

    // 9. Success
    {
        status: {
            id: "9",
            fileName: "report.pdf",
            fileUrl: "https://cdn.example.com/report.pdf",
            fileSize: 5000000,
            currentState: "SUCCESS",
            folderName: "Completed",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 5000000,
                eta: 0
            },
            message: "Download completed successfully"
        },
        isRunning: false
    },

    // 10. Failed
    {
        status: {
            id: "10",
            fileName: "broken_video.mp4",
            fileUrl: "https://cdn.example.com/broken.mp4",
            fileSize: 1000000000,
            currentState: "FAILED",
            folderName: "Failed",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 300000000,
                eta: 0
            },
            message: "Connection timeout after 3 retries"
        },
        isRunning: false
    },

    // 11. Cancelled
    {
        status: {
            id: "11",
            fileName: "cancelled.rar",
            fileUrl: "https://cdn.example.com/cancelled.rar",
            fileSize: 200000000,
            currentState: "CANCELLED",
            folderName: "Cancelled",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 50000000,
                eta: 0
            },
            message: "User cancelled download"
        },
        isRunning: false
    },

    // 12. COMPLETE (alias of success)
    {
        status: {
            id: "12",
            fileName: "complete_state_test.txt",
            fileUrl: "https://cdn.example.com/complete.txt",
            fileSize: 123456,
            currentState: "COMPLETE",
            folderName: "Done",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 123456,
                eta: 0
            },
            message: "Task marked as complete"
        },
        isRunning: false
    },

    // 13. Edge Case: No file size
    {
        status: {
            id: "13",
            fileName: "unknown_size_stream",
            fileUrl: "https://cdn.example.com/live",
            fileSize: 0,
            currentState: "DOWNLOAD",
            folderName: "Streams",
            magnet: false,
            downloadStatus: {
                speed: 1.2,
                fileDownloaded: 0,
                eta: 0
            },
            message: "Live stream (size unknown)"
        },
        isRunning: true
    },

    // 14. Edge Case: No message
    {
        status: {
            id: "14",
            fileName: "silent_task.bin",
            fileUrl: "https://cdn.example.com/silent.bin",
            fileSize: 1000,
            currentState: "DOWNLOAD",
            folderName: "Misc",
            magnet: false,
            downloadStatus: {
                speed: 0.5,
                fileDownloaded: 200,
                eta: 10
            },
            message: null
        },
        isRunning: true
    },

    // 15. FAILED at start (0%)
    {
        status: {
            id: "15",
            fileName: "failed_immediately.mp4",
            fileUrl: "https://cdn.example.com/fail0.mp4",
            fileSize: 1000000000,
            currentState: "FAILED",
            folderName: "Failed-Edge",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 0,
                eta: 0
            },
            message: "Invalid URL - resource not found"
        },
        isRunning: false
    },

    // 16. FAILED near completion (99%)
    {
        status: {
            id: "16",
            fileName: "failed_at_99_percent.mkv",
            fileUrl: "https://cdn.example.com/fail99.mkv",
            fileSize: 2000000000,
            currentState: "FAILED",
            folderName: "Failed-Edge",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 1980000000,
                eta: 0
            },
            message: "Disk full while writing file"
        },
        isRunning: false
    },

    // 17. FAILED during post-process
    {
        status: {
            id: "17",
            fileName: "ffmpeg_failed.mp4",
            fileSize: 800000000,
            currentState: "FAILED",
            folderName: "PostProcess",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 800000000,
                eta: 0
            },
            message: "FFMPEG error: codec not supported"
        },
        isRunning: false
    },

    // 18. CANCELLED while running
    {
        status: {
            id: "18",
            fileName: "cancelled_midway.iso",
            fileUrl: "https://cdn.example.com/cancelmid.iso",
            fileSize: 5000000000,
            currentState: "CANCELLED",
            folderName: "Cancelled-Edge",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 2500000000,
                eta: 0
            },
            message: "User cancelled at 50%"
        },
        isRunning: false
    },

    // 19. CANCELLED while queued
    {
        status: {
            id: "19",
            fileName: "cancelled_while_queued.mkv",
            fileUrl: "https://cdn.example.com/cancelqueue.mkv",
            fileSize: 3000000000,
            currentState: "CANCELLED",
            folderName: "Cancelled-Edge",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 0,
                eta: 0
            },
            message: "User cancelled before start"
        },
        isRunning: false,
        isQueued: false
    },

    // 20. CANCELLED magnet torrent
    {
        status: {
            id: "20",
            fileName: "Ubuntu 22.04 Torrent",
            fileUrl: "magnet:?xt=urn:btih:CANCELLED123",
            fileSize: 6000000000,
            currentState: "CANCELLED",
            folderName: "Torrents",
            magnet: true,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 1200000000,
                eta: 0
            },
            message: "Torrent stopped by user"
        },
        isRunning: false
    },

    // 21. CANCELLED after resume
    {
        status: {
            id: "21",
            fileName: "resumed_then_cancelled.bin",
            fileUrl: "https://cdn.example.com/resumecancel.bin",
            fileSize: 4000000000,
            currentState: "CANCELLED",
            folderName: "Cancelled-Edge",
            magnet: false,
            downloadStatus: {
                speed: 0,
                fileDownloaded: 3000000000,
                eta: 0
            },
            message: "<div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:56.196] [stdout] Added active download mapping - GID:bc96110417c9995d  → MirrorId: 1769872852716</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:56.207] [stdout] 🔍 Started monitoring GID bc96110417c9995d for mirror 1769872852716</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:58.722] [stdout] 📁 File info updated from Aria2 (files array): ADGPM2nPUmCKabYTXwO0zb56RybeV4evGXxX9FyFA1eIMAw1-Sp4eVyrQoDkJaJYm6YcPIXt_hAB7_YlPaKNBoGJtGb0tuI91Jix6OMgr-wvW29EE4R6gx6Wd82Z6ZHMQ6M-Lf7yrEAS8jLbOvq9S9HjttZ1GSmA74Y6_pkcLKb1VPo_7YB_fTBFiCfC-X9c2tmoctBxOt1OSk1pNU9W3vE2HscJswbptzwOgR8W-I6ea4rcqen-Ns4gWfr0EhoIEsZQ6HWikndgRoC43_t4O0OJqwbDLjWhMVdcC_kinZKK3StfjegOoY7xlv5T0MU8-upVW8MN2FBiC7pSYqkX1I2EsWDzapySMnQ74PMLmUeDvcmE9PXleZb5i-Gb8eGRsfWULDvGR_X5bK16gB7IJSyrDhz5odIQnrC1pMKMirXg9w-dqgqG4WU_lQWsL5QwtcaVMAz8bL2Qr-V9kk1D00pUW8rVgL7ach1eKmfUxSYB70sEvvbCh9bpBo0MCW6uVcsxIY_JP3d-7-Y2r9qEOr9ggCq1alCrEUvxXQyldUkQWVzqHQ5dZP6_l8BM9AevOo7U31eGkEqjoJyk_w6EN4l5ZKg-IWZ9EEOuJCkY6wKSyxxcRxnU9GP1ropqFgAwWmiZ0-LkPTD8FyQefaPpW-G5dPYq4cYGwtvpJHyQWt17pkacP0HlBmxbllrvWGsyKaaeHDaBNz7KJfxOEWI2yoRS-075UCwi0AhR2-7cVakYNPYKmshCZxZI1NTSxuiFsZhs8migUL7NtwuzU2li7KlHyyPCHzDYVXrGioSeALFZuc2oFeuzXoAGy-SWX9k4ZYXrY--7pYOBLnuoMwYKUPuSQWIKiToxh6qoM-kS_996fwG3TWG0qnBzU_6Io43jqHc1nOtpKbP63Y9BZb52XvtZ77RwqOQ0gpdoS9F9NKjMYg7lSVN_KQH_u-lxhEcvREIzoPoR4FPrxvljHwMLc6R3NpqZlx00f1EWoXJlpzNit9z3IQbiLKL66gdlI6zt2VGyMFq8bqaetkZgTPzpVWI653adodsVA3j09LdBe0FBIx2asvnR0y6v6vgQnJsyr8tOz4pocFDQ → Dhurandhar.2025.REPACK.1080p.NF.WEB-DL.Multi.AAC5.1.AV1-CPTN5DW.mkv</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.726] [stdout] ✅ Download completed</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] 🔍 Starting post-download tasks</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] ✅ Download completed, starting processing</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] 🔄 Starting media processing</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.729] [stdout] 🔄 Starting media processing...</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.730] [stdout] 📁 Processing with record ID: 4182</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 21:00:40.647] [stdout] ✅ Media processing completed successfully!</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 21:00:40.647] [stdout] ✅ Media processing completed successfully</div>"
        },
        isRunning: false
    },

    {
        // 22. SUCCESS with large file size
        status: {
            "id": "1769872852716",
            "gid": "bc96110417c9995d",
            "timeStamp": "1769873440648",
            "recordId": 4182,
            "folderName": "4182-Dhurandhar",
            "fileUrl": "https://video-downloads.googleusercontent.com/ADGPM2nPUmCKabYTXwO0zb56RybeV4evGXxX9FyFA1eIMAw1-Sp4eVyrQoDkJaJYm6YcPIXt_hAB7_YlPaKNBoGJtGb0tuI91Jix6OMgr-wvW29EE4R6gx6Wd82Z6ZHMQ6M-Lf7yrEAS8jLbOvq9S9HjttZ1GSmA74Y6_pkcLKb1VPo_7YB_fTBFiCfC-X9c2tmoctBxOt1OSk1pNU9W3vE2HscJswbptzwOgR8W-I6ea4rcqen-Ns4gWfr0EhoIEsZQ6HWikndgRoC43_t4O0OJqwbDLjWhMVdcC_kinZKK3StfjegOoY7xlv5T0MU8-upVW8MN2FBiC7pSYqkX1I2EsWDzapySMnQ74PMLmUeDvcmE9PXleZb5i-Gb8eGRsfWULDvGR_X5bK16gB7IJSyrDhz5odIQnrC1pMKMirXg9w-dqgqG4WU_lQWsL5QwtcaVMAz8bL2Qr-V9kk1D00pUW8rVgL7ach1eKmfUxSYB70sEvvbCh9bpBo0MCW6uVcsxIY_JP3d-7-Y2r9qEOr9ggCq1alCrEUvxXQyldUkQWVzqHQ5dZP6_l8BM9AevOo7U31eGkEqjoJyk_w6EN4l5ZKg-IWZ9EEOuJCkY6wKSyxxcRxnU9GP1ropqFgAwWmiZ0-LkPTD8FyQefaPpW-G5dPYq4cYGwtvpJHyQWt17pkacP0HlBmxbllrvWGsyKaaeHDaBNz7KJfxOEWI2yoRS-075UCwi0AhR2-7cVakYNPYKmshCZxZI1NTSxuiFsZhs8migUL7NtwuzU2li7KlHyyPCHzDYVXrGioSeALFZuc2oFeuzXoAGy-SWX9k4ZYXrY--7pYOBLnuoMwYKUPuSQWIKiToxh6qoM-kS_996fwG3TWG0qnBzU_6Io43jqHc1nOtpKbP63Y9BZb52XvtZ77RwqOQ0gpdoS9F9NKjMYg7lSVN_KQH_u-lxhEcvREIzoPoR4FPrxvljHwMLc6R3NpqZlx00f1EWoXJlpzNit9z3IQbiLKL66gdlI6zt2VGyMFq8bqaetkZgTPzpVWI653adodsVA3j09LdBe0FBIx2asvnR0y6v6vgQnJsyr8tOz4pocFDQ",
            "magnet": false,
            "fileName": "Dhurandhar.2025.REPACK.1080p.NF.WEB-DL.Multi.AAC5.1.AV1-CPTN5DW.mkv",
            "fileType": "application/octet-stream",
            "filePath": "/ext_hdisk/dbworld/integration/4182-Dhurandhar/Dhurandhar.2025.REPACK.1080p.NF.WEB-DL.Multi.AAC5.1.AV1-CPTN5DW.mkv",
            "recordIdPath": "/ext_hdisk/dbworld/integration/4182-Dhurandhar",
            "extract": false,
            "tempFileName": "Dhurandhar.2025.REPACK.1080p.NF.WEB-DL.Multi.AAC5.1.AV1-CPTN5DW.mkv",
            "tempFilePath": "/ext_hdisk/dbworld/temp/4182-Dhurandhar/Dhurandhar.2025.REPACK.1080p.NF.WEB-DL.Multi.AAC5.1.AV1-CPTN5DW.mkv",
            "tempRecordIdPath": "/ext_hdisk/dbworld/temp/4182-Dhurandhar",
            "fileSize": 6617902656,
            "currentState": "SUCCESS",
            "downloadStatus": {
                "fileDownloaded": 6617902656,
                "fileRemaining": 0,
                "eta": 0,
                "totalFileSize": 6617902656,
                "updateTime": 1769873238726,
                "lastDownloadedBytes": 0
            },
            "onlyAudio": false,
            "message": "<div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:56.196] [stdout] Added active download mapping - GID:bc96110417c9995d  → MirrorId: 1769872852716</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:56.207] [stdout] 🔍 Started monitoring GID bc96110417c9995d for mirror 1769872852716</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:50:58.722] [stdout] 📁 File info updated from Aria2 (files array): ADGPM2nPUmCKabYTXwO0zb56RybeV4evGXxX9FyFA1eIMAw1-Sp4eVyrQoDkJaJYm6YcPIXt_hAB7_YlPaKNBoGJtGb0tuI91Jix6OMgr-wvW29EE4R6gx6Wd82Z6ZHMQ6M-Lf7yrEAS8jLbOvq9S9HjttZ1GSmA74Y6_pkcLKb1VPo_7YB_fTBFiCfC-X9c2tmoctBxOt1OSk1pNU9W3vE2HscJswbptzwOgR8W-I6ea4rcqen-Ns4gWfr0EhoIEsZQ6HWikndgRoC43_t4O0OJqwbDLjWhMVdcC_kinZKK3StfjegOoY7xlv5T0MU8-upVW8MN2FBiC7pSYqkX1I2EsWDzapySMnQ74PMLmUeDvcmE9PXleZb5i-Gb8eGRsfWULDvGR_X5bK16gB7IJSyrDhz5odIQnrC1pMKMirXg9w-dqgqG4WU_lQWsL5QwtcaVMAz8bL2Qr-V9kk1D00pUW8rVgL7ach1eKmfUxSYB70sEvvbCh9bpBo0MCW6uVcsxIY_JP3d-7-Y2r9qEOr9ggCq1alCrEUvxXQyldUkQWVzqHQ5dZP6_l8BM9AevOo7U31eGkEqjoJyk_w6EN4l5ZKg-IWZ9EEOuJCkY6wKSyxxcRxnU9GP1ropqFgAwWmiZ0-LkPTD8FyQefaPpW-G5dPYq4cYGwtvpJHyQWt17pkacP0HlBmxbllrvWGsyKaaeHDaBNz7KJfxOEWI2yoRS-075UCwi0AhR2-7cVakYNPYKmshCZxZI1NTSxuiFsZhs8migUL7NtwuzU2li7KlHyyPCHzDYVXrGioSeALFZuc2oFeuzXoAGy-SWX9k4ZYXrY--7pYOBLnuoMwYKUPuSQWIKiToxh6qoM-kS_996fwG3TWG0qnBzU_6Io43jqHc1nOtpKbP63Y9BZb52XvtZ77RwqOQ0gpdoS9F9NKjMYg7lSVN_KQH_u-lxhEcvREIzoPoR4FPrxvljHwMLc6R3NpqZlx00f1EWoXJlpzNit9z3IQbiLKL66gdlI6zt2VGyMFq8bqaetkZgTPzpVWI653adodsVA3j09LdBe0FBIx2asvnR0y6v6vgQnJsyr8tOz4pocFDQ → Dhurandhar.2025.REPACK.1080p.NF.WEB-DL.Multi.AAC5.1.AV1-CPTN5DW.mkv</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.726] [stdout] ✅ Download completed</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] 🔍 Starting post-download tasks</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] ✅ Download completed, starting processing</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.727] [stdout] 🔄 Starting media processing</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.729] [stdout] 🔄 Starting media processing...</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 20:57:18.730] [stdout] 📁 Processing with record ID: 4182</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 21:00:40.647] [stdout] ✅ Media processing completed successfully!</div><div style='color:#198754;font-family:monospace;'>[2026-01-31 21:00:40.647] [stdout] ✅ Media processing completed successfully</div>",
            "cancelled": false,
            "completed": true,
            "failed": false,
            "currentStatus": "Success ✅",
            "success": true,
            "fileReadyForMove": false,
            "pause": false
        },
        isRunning: false,
        isQueued: false
    }

];

export default StatusTestData;
