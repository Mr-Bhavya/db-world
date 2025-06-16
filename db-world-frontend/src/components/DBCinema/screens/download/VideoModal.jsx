import React, { useEffect, useRef, useState } from "react";
import { registerPlugin, Capacitor } from "@capacitor/core";
import "./VideoModal.css";

const CapacitorVideoPlayer = registerPlugin("CapacitorVideoPlayer");

export default function VideoModal({ url, title, onExit }) {
  const videoRef = useRef(null);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(Capacitor.getPlatform() === 'android');
  }, []);

  useEffect(() => {
    if (isAndroid) {
      // Initialize native player
      CapacitorVideoPlayer.initPlayer({
        mode: "fullscreen",
        url,
        componentTag: "video-player",
        title,
        controller: false,
        chromecast: true,
        exitOnEnd: true,
        pipEnabled: true,
        displayMode: "landscape",
      });

      // Listen for exit event
      const listener = CapacitorVideoPlayer.addListener('onExit', () => {
        onExit();
      });
      return () => {
        listener.remove();
      };
    } else {
      const vid = videoRef.current;

      const handleExitFullscreen = () => {
        if (document.fullscreenElement === null) {
          onExit();
        }
      };

      if (vid) {
        const playPromise = vid.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            if (vid.requestFullscreen) {
              vid.requestFullscreen();
            } else if (vid.webkitRequestFullscreen) {
              vid.webkitRequestFullscreen();
            } else if (vid.msRequestFullscreen) {
              vid.msRequestFullscreen();
            }
          }).catch(error => {
            console.error("Video playback failed:", error);
          });
        }
      }

      document.addEventListener("fullscreenchange", handleExitFullscreen);
      document.addEventListener("webkitfullscreenchange", handleExitFullscreen);
      document.addEventListener("msfullscreenchange", handleExitFullscreen);

      return () => {
        document.removeEventListener("fullscreenchange", handleExitFullscreen);
        document.removeEventListener("webkitfullscreenchange", handleExitFullscreen);
        document.removeEventListener("msfullscreenchange", handleExitFullscreen);
      };
    }
  }, [isAndroid, url, title, onExit]);

  return (
    <div className="video-modal">
      {isAndroid ? (
        <div id="video-player" className="video-player-container" />
      ) : (
        <div className="web-video-wrapper">
          <video
            ref={videoRef}
            src={url}
            controls
            className="web-video"
            onEnded={onExit}
            onAbort={onExit}
            onError={onExit}
          />
        </div>
      )}
    </div>
  );
}
