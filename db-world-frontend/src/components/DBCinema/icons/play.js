import React from "react";
import { Button } from "@mui/material";
import { PlayArrow } from "@mui/icons-material";
import { Capacitor } from "@capacitor/core";
import Constants from "../../Constants";
import AndroidPlugins from "../../../android-app-components/AndroidPlugins";
import { CapacitorVideoPlayer } from "capacitor-video-player"; // Ensure this is installed and linked properly

const Play = ({
  streamUrl,
  mediaId,
  variant = "contained",
  color = "primary",
  size = "small",
  label = "Play",
  startIcon = <PlayArrow />,
  onPlay,
  onError,
  onWebPlay,
  ...props
}) => {
  const handlePlay = async () => {
    if (onPlay) {
      onPlay(streamUrl, mediaId);
      return;
    }

    if (!streamUrl) {
      const errorMsg = "Stream URL is not available.";
      onError ? onError(errorMsg) : Constants.showToast.error(errorMsg);
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await AndroidPlugins.MyMedia3Player.playVideo({ url: streamUrl });
      } else {
        // Web or other non-native platform playback
        if (onWebPlay) {
          onWebPlay(mediaId);
        } else {
          // Default web behavior
          if (streamUrl.match(/\.(mp4|webm|ogg|mov)$/i)) {
            window.open(streamUrl, "_blank");
          } else {
            const videoWindow = window.open("", "_blank");
            videoWindow.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${mediaId || 'Media Player'}</title>
                  <style>
                    body { margin: 0; padding: 0; background: #000; }
                    video { width: 100%; height: 100%; }
                  </style>
                </head>
                <body>
                  <video controls autoplay>
                    <source src="${streamUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                  </video>
                </body>
              </html>
            `);
            videoWindow.document.close();
          }
        }
      }
    } catch (error) {
      const errorMsg = "Error playing media";
      console.error(`${errorMsg}:`, error);
      onError ? onError(errorMsg) : Constants.showToast.error(errorMsg);
      window.open(streamUrl, "_blank"); // Fallback
    }
  };

  return (
    <Button
      variant={variant}
      color={color}
      size={size}
      startIcon={startIcon}
      onClick={handlePlay}
      {...props}
    >
      {label}
    </Button>
  );
};

export default Play;
