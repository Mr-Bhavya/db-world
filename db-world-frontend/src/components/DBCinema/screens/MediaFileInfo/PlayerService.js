// utils/PlayerService.js
class PlayerService {
  static async openWithDefaultPlayer(fileUrl, fileName, options = {}) {
    try {
      const { isStream = true } = options;

      // For web environment
      if (this.isWebEnvironment()) {
        return this.openInWeb(fileUrl, fileName, isStream);
      }

      // For Electron/Desktop environment
      if (this.isElectron()) {
        return this.openInElectron(fileUrl);
      }

      // For mobile apps (React Native)
      if (this.isMobileApp()) {
        return this.openInMobileApp(fileUrl);
      }

      // Fallback to new tab for stream, download for files
      if (isStream) {
        window.open(fileUrl, '_blank');
      } else {
        this.downloadFile(fileUrl, fileName);
      }

    } catch (error) {
      console.error('Error opening player:', error);
      throw error;
    }
  }

  static async openWithSpecificPlayer(fileUrl, playerType, options = {}) {
    const players = {
      vlc: this.openWithVLC,
      mxplayer: this.openWithMXPlayer,
      browser: this.openInBrowser,
      default: this.openWithDefaultPlayer,
      download: this.downloadFile,
      system: this.openWithSystemPlayer
    };

    const playerFunction = players[playerType] || players.default;
    return playerFunction(fileUrl, options.fileName, options);
  }

  static openInWeb(fileUrl, fileName, isStream = true) {
    if (isStream) {
      // For streaming - open in new tab
      window.open(fileUrl, '_blank');
    } else {
      // For download - create download link
      this.downloadFile(fileUrl, fileName);
    }
  }

  static openInBrowser(fileUrl) {
    // Direct browser playback
    window.open(fileUrl, '_blank');
  }

  static openInElectron(fileUrl) {
    // For Electron apps
    if (window.require) {
      const { shell } = window.require('electron');
      shell.openExternal(fileUrl);
    } else {
      window.open(fileUrl, '_blank');
    }
  }

  static openInMobileApp(fileUrl) {
    // For React Native - use Linking
    if (window.Linking) {
      window.Linking.openURL(fileUrl).catch(err =>
        console.error('Failed to open URL:', err)
      );
    } else {
      window.open(fileUrl, '_blank');
    }
  }

  // System default player (mobile)
  static async openWithSystemPlayer(fileUrl) {
    if (this.isAndroid()) {
      // Android intent for system player
      const systemUrl = `intent:${fileUrl}#Intent;action=android.intent.action.VIEW;type=video/*;end`;
      window.open(systemUrl, '_blank');
      
      // Fallback to browser
      setTimeout(() => {
        if (!document.hidden) {
          window.open(fileUrl, '_blank');
        }
      }, 1000);
    } else if (this.isIOS()) {
      // iOS - just open in browser, system will handle it
      window.open(fileUrl, '_blank');
    } else {
      // Desktop - use default behavior
      this.openWithDefaultPlayer(fileUrl);
    }
  }

  static async openWithVLC(fileUrl) {
    // VLC protocol handler - works for both stream and file URLs
    try {
      const vlcUrl = `vlc://${fileUrl}`;
      window.open(vlcUrl, '_blank');

      // Fallback to direct URL if VLC fails
      setTimeout(() => {
        if (!document.hidden) {
          window.open(fileUrl, '_blank');
        }
      }, 1000);
    } catch (error) {
      console.error('VLC opening failed, falling back to browser:', error);
      window.open(fileUrl, '_blank');
    }
  }

  static async openWithMXPlayer(fileUrl, preferredVersion = 'auto') {
    const versions = {
      pro: {
        package: 'com.mxtech.videoplayer.pro',
        name: 'MX Player Pro',
        url: `intent:${fileUrl}#Intent;package=com.mxtech.videoplayer.pro;scheme=http;end`
      },
      free: {
        package: 'com.mxtech.videoplayer.ad',
        name: 'MX Player Free', 
        url: `intent:${fileUrl}#Intent;package=com.mxtech.videoplayer.ad;scheme=http;end`
      }
    };

    try {
      let mxUrl;
      
      if (preferredVersion === 'pro') {
        mxUrl = versions.pro.url;
      } else if (preferredVersion === 'free') {
        mxUrl = versions.free.url;
      } else {
        // Auto-detect: try Pro first, then Free
        mxUrl = versions.pro.url;
      }
      
      const playerWindow = window.open(mxUrl, '_blank');
      
      // Fallback mechanism for auto-detection
      if (preferredVersion === 'auto') {
        setTimeout(() => {
          if (!playerWindow || playerWindow.closed) {
            console.log('MX Player Pro not found, trying Free version');
            window.open(versions.free.url, '_blank');
          }
        }, 800);
      }
      
    } catch (error) {
      console.error('MX Player opening failed:', error);
      window.open(fileUrl, '_blank');
    }
  }

  static downloadFile(fileUrl, fileName) {
    try {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || 'download';
      link.target = '_blank';
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed, opening in new tab:', error);
      window.open(fileUrl, '_blank');
    }
  }

  static streamFile(fileUrl) {
    // Open stream URL in new tab for playback
    window.open(fileUrl, '_blank');
  }

  // Enhanced platform detection
  static isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  static isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  static isMobile() {
    return this.isAndroid() || this.isIOS();
  }

  static isDesktop() {
    return !this.isMobile() && !this.isMobileApp();
  }

  // Player detection and capabilities
  static getAvailablePlayers(mediaInfo = {}) {
    const hasStreamUrl = !!mediaInfo.streamUrl;
    const hasDownloadUrl = !!mediaInfo.downloadUrl;
    const isMobile = this.isMobile();
    const isAndroid = this.isAndroid();
    const isDesktop = this.isDesktop();

    // Base players available on all platforms
    const basePlayers = [
      {
        id: 'browser',
        name: 'Browser Player',
        icon: '🌐',
        description: 'Play in web browser',
        supportsStream: true,
        supportsDownload: false,
        platforms: ['web', 'mobile', 'desktop']
      },
      {
        id: 'download',
        name: 'Download File',
        icon: '📥',
        description: 'Download to device',
        supportsStream: false,
        supportsDownload: true,
        platforms: ['web', 'mobile', 'desktop']
      }
    ];

    // Mobile-specific players
    const mobilePlayers = [
      {
        id: 'system',
        name: 'System Player',
        icon: '📱',
        description: 'Open with device default player',
        supportsStream: true,
        supportsDownload: false,
        platforms: ['mobile']
      },
      {
        id: 'vlc',
        name: 'VLC Mobile',
        icon: '🔴',
        description: 'Open with VLC Mobile',
        supportsStream: true,
        supportsDownload: true,
        platforms: ['mobile']
      }
    ];

    // Android-specific players
    const androidPlayers = [
      {
        id: 'mxplayer',
        name: 'MX Player',
        icon: '🎯',
        description: 'Open with MX Player (Android)',
        supportsStream: true,
        supportsDownload: true,
        platforms: ['android']
      }
    ];

    // Desktop-specific players
    const desktopPlayers = [
      {
        id: 'vlc',
        name: 'VLC Media Player',
        icon: '🔴',
        description: 'Open with VLC (Desktop)',
        supportsStream: true,
        supportsDownload: true,
        platforms: ['desktop']
      }
    ];

    // Combine players based on platform
    let availablePlayers = [...basePlayers];

    if (isMobile) {
      availablePlayers = [...availablePlayers, ...mobilePlayers];
      
      if (isAndroid) {
        availablePlayers = [...availablePlayers, ...androidPlayers];
      }
    }

    if (isDesktop) {
      availablePlayers = [...availablePlayers, ...desktopPlayers];
    }

    // Filter players based on available URLs and platform
    return availablePlayers.filter(player => {
      // Check if player supports current platform
      const supportsPlatform = player.platforms.some(platform => {
        if (platform === 'mobile' && isMobile) return true;
        if (platform === 'android' && isAndroid) return true;
        if (platform === 'desktop' && isDesktop) return true;
        if (platform === 'web') return true;
        return false;
      });

      if (!supportsPlatform) return false;

      if (player.id === 'download') {
        return hasDownloadUrl;
      }
      
      return hasStreamUrl; // Other players need stream URL
    });
  }

  static getRecommendedPlayer(mediaInfo) {
    const players = this.getAvailablePlayers(mediaInfo);
    const isMobile = this.isMobile();
    const isAndroid = this.isAndroid();

    // Platform-specific recommendations
    if (isMobile) {
      // On mobile, prefer system player first
      const systemPlayer = players.find(p => p.id === 'system');
      if (systemPlayer) return systemPlayer;

      // Then VLC for better compatibility
      const vlcPlayer = players.find(p => p.id === 'vlc');
      if (vlcPlayer) return vlcPlayer;

      // Then MX Player on Android
      if (isAndroid) {
        const mxPlayer = players.find(p => p.id === 'mxplayer');
        if (mxPlayer) return mxPlayer;
      }
    } else {
      // On desktop, prefer VLC
      const vlcPlayer = players.find(p => p.id === 'vlc');
      if (vlcPlayer) return vlcPlayer;
    }

    // Fallback to browser
    return players.find(p => p.id === 'browser') || players[0];
  }

  // Get platform-specific player descriptions
  static getPlayerDescription(playerId) {
    const descriptions = {
      system: 'Opens with your device\'s default media player',
      vlc: this.isMobile ? 'VLC Mobile - Universal media player' : 'VLC Media Player - Plays everything',
      mxplayer: 'MX Player - Popular Android video player with hardware acceleration',
      browser: 'Plays directly in your web browser',
      download: 'Downloads the file to your device'
    };
    
    return descriptions[playerId] || 'Media player';
  }

  // Environment detection
  static isWebEnvironment() {
    return typeof window !== 'undefined' && !this.isElectron() && !this.isMobileApp();
  }

  static isElectron() {
    return typeof window !== 'undefined' && window.process && window.process.type;
  }

  static isMobileApp() {
    return typeof window !== 'undefined' && (window.ReactNativeWebView || window.Linking);
  }

  static getPlatform() {
    if (this.isElectron()) return 'electron';
    if (this.isMobileApp()) return 'mobile';
    if (this.isAndroid()) return 'android';
    if (this.isIOS()) return 'ios';
    if (this.isMobile()) return 'mobile';
    return 'web';
  }

  // Quick methods with platform awareness
  static quickPlay(fileUrl, mediaInfo = {}) {
    const recommendedPlayer = this.getRecommendedPlayer(mediaInfo);
    return this.openWithSpecificPlayer(fileUrl, recommendedPlayer.id, {
      fileName: mediaInfo.fileName,
      isStream: true
    });
  }

  static quickDownload(fileUrl, fileName = null) {
    return this.downloadFile(fileUrl, fileName);
  }
}

export default PlayerService;