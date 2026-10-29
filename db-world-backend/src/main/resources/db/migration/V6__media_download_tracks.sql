ALTER TABLE media_download_job
    ADD COLUMN video_format VARCHAR(255),
    ADD COLUMN audio_format VARCHAR(255),
    ADD COLUMN container VARCHAR(255);