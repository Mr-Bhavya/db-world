import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorVideoPlayer } from 'capacitor-video-player';

const VideoPlayer = () => {
  useEffect(() => {
    const initializePlayer = async () => {
      const platform = Capacitor.getPlatform();
      const playerId = 'fullscreen';
      const url = 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4';

      // Initialize the player in fullscreen mode
      await CapacitorVideoPlayer.initPlayer({
        mode: 'fullscreen',
        url,
        playerId,
        componentTag: 'video-player',
        title: 'Big Buck Bunny',
        subtitle: 'Sample Video',
        accentColor: '#FF0000',
        artwork: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217',
        headers: {},
        subtitleUrl: 'https://example.com/subtitles.vtt',
        language: 'en',
        isTV: false,
        chromecast: true,
      });

      // Add event listeners
      CapacitorVideoPlayer.addListener('jeepCapVideoPlayerReady', (data) => {
        //console.log('Player Ready:', data);
      });

      CapacitorVideoPlayer.addListener('jeepCapVideoPlayerPlay', (data) => {
        //console.log('Playback Started:', data);
      });

      CapacitorVideoPlayer.addListener('jeepCapVideoPlayerPause', (data) => {
        //console.log('Playback Paused:', data);
      });

      CapacitorVideoPlayer.addListener('jeepCapVideoPlayerEnded', (data) => {
        //console.log('Playback Ended:', data);
      });

      CapacitorVideoPlayer.addListener('jeepCapVideoPlayerExit', (data) => {
        //console.log('Player Exited:', data);
      });
    };

    initializePlayer();
  }, []);

  return <div id="video-player"></div>;
};

export default VideoPlayer;

