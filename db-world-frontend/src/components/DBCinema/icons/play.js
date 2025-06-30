import React from "react";
import { Button } from "@mui/material";
import { PlayArrow } from "@mui/icons-material";
import { Capacitor } from "@capacitor/core";
import Constants from "../../Constants";

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
  onAndroidPlay,
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
      if (Capacitor.getPlatform() === "android" && onAndroidPlay) {
        await onAndroidPlay(streamUrl);
      } else if (onWebPlay) {
        onWebPlay(mediaId);
      } else {
        // Default web behavior
        window.open(streamUrl, "_blank");
      }
    } catch (error) {
      const errorMsg = "Error playing media";
      console.error(`${errorMsg}:`, error);
      onError ? onError(errorMsg) : Constants.showToast.error(errorMsg);
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