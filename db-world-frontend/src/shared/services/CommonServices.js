import Constants from '@shared/constants';
import { Capacitor } from "@capacitor/core";
import DbWorldDownload from '@platform/android/DbWorldDownload';

class CommonServices {
  // ========== TIME & DATE UTILITIES ==========

  static getTimeDateFromTimeStamp = (timestamp, _timezone) => {
    timestamp = parseInt(timestamp);
    let date = new Date(timestamp);

    return {
      date: date.toLocaleDateString() || null,
      time: date.toLocaleTimeString() || null
    };
  }

  static getHHmmFromSeconds = (d) => {
    const date = new Date(null);
    date.setSeconds(d / 1000);
    return date.toISOString().substr(11, 8);
  }

  static getPercentage = (actual, total) => {
    return parseFloat((actual * 100) / total).toFixed(2);
  }

  // ========== DATA FORMATTING UTILITIES ==========

  static bytesToReadbleFormat = (bytes) => {
    if (bytes == null || typeof bytes === "undefined") {
      return { value: 0, suffix: "Bytes" };
    }

    if (typeof bytes === "string") {
      bytes = parseFloat(bytes).toFixed(0);
    }

    if (bytes === 0) return { value: 0, suffix: "Bytes" };

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return {
      value: parseFloat((bytes / Math.pow(k, i)).toFixed(2)),
      suffix: sizes[i]
    };
  }

  static formatETA = (seconds) => {
    if (seconds <= 0) return "0 sec";

    const years = Math.floor(seconds / (3600 * 24 * 365));
    const days = Math.floor((seconds % (3600 * 24 * 365)) / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num) => String(num).padStart(2, "0");

    if (years > 0) {
      return `${years}y ${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    } else if (days > 0) {
      return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    } else if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    } else if (minutes > 0) {
      return `${pad(minutes)}:${pad(secs)}`;
    } else {
      return `${secs} sec`;
    }
  }

  // ========== COPY & DOWNLOAD UTILITIES ==========

  /**
   * Enhanced copy to clipboard with multiple fallback methods
   * @param {string|Promise<string>} text - Text to copy, or a promise of it (a secret still being
   *   fetched: see _copyPending)
   * @param {Object} options - Copy options. sensitive: a secret; clearAfterMs later the clipboard is
   *   emptied if it still holds this text (or unconditionally where it cannot be read), and it is
   *   never handed to the share sheet.
   * @returns {Object} Result object
   */
  static handleCopy = async (text, options = {}) => {
    if (typeof text?.then === "function") return this._copyPending(text, options);
    const {
      enableFallback = true,
      showToast = false,
      toastCallback = null,
      sensitive = false,
      clearAfterMs = 30000
    } = options;
    // A secret never goes to the share sheet: whichever app is picked there would keep it.
    const enableShare = !sensitive && (options.enableShare ?? true);

    // Validate input
    if (!text || typeof text !== "string") {
      const error = "Invalid text provided for copy";
      this._handleCopyFeedback(false, error, showToast, toastCallback);
      return { success: false, message: error };
    }

    try {
      // Method 1: Modern Clipboard API (Primary)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this._afterClipboardWrite(text, sensitive, clearAfterMs);
        this._handleCopyFeedback(true, "Copied to clipboard", showToast, toastCallback);
        return { success: true, message: "Copied to clipboard", method: "clipboard-api" };
      }

      // Method 2: Web Share API (for mobile devices)
      if (enableShare && navigator.share && this._isMobileDevice()) {
        try {
          await navigator.share({
            title: "Shared Content",
            text: text
          });
          this._handleCopyFeedback(true, "Content shared", showToast, toastCallback);
          return { success: true, message: "Content shared", method: "web-share" };
        } catch (_shareError) {
          // Web Share was cancelled or failed, continue to fallback
          //console.log("Web Share cancelled or failed, trying fallback...");
        }
      }

      // Method 3: Fallback for older browsers
      if (enableFallback) {
        const fallbackResult = this._fallbackCopy(text);
        if (fallbackResult.success) {
          this._afterClipboardWrite(text, sensitive, clearAfterMs);
          this._handleCopyFeedback(true, fallbackResult.message, showToast, toastCallback);
          return { ...fallbackResult, method: "fallback" };
        }
      }

      // All methods failed
      const error = "Copy not supported in this browser";
      this._handleCopyFeedback(false, error, showToast, toastCallback);
      return { success: false, message: error, method: "none" };

    } catch (error) {
      console.error("Copy error:", error);
      const errorMsg = `Copy failed: ${error.message}`;
      this._handleCopyFeedback(false, errorMsg, showToast, toastCallback);
      return { success: false, message: errorMsg, method: "error" };
    }
  }

  /**
   * Copies a value that is still on its way (a secret being fetched). Safari lets a page write to the
   * clipboard only inside the tap itself, and an awaited request ends that, so where ClipboardItem
   * exists the write starts at once with the value as a promise. Elsewhere, or if that write is
   * refused, the value is awaited and copied the ordinary way. A value that cannot be fetched is a
   * failed copy and schedules no clear.
   * @private
   */
  static _copyPending = async (pending, options) => {
    const { showToast = false, toastCallback = null, sensitive = false, clearAfterMs = 30000 } = options;
    const valid = pending.then((t) => {
      if (!t || typeof t !== "string") throw new Error("Invalid text provided for copy");
      return t;
    });
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      try {
        // Nothing is awaited before this call: it has to run inside the user's tap.
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": valid.then((t) => new Blob([t], { type: "text/plain" })),
        })]);
        const text = await valid;   // already settled: the write needed it
        this._afterClipboardWrite(text, sensitive, clearAfterMs);
        this._handleCopyFeedback(true, "Copied to clipboard", showToast, toastCallback);
        return { success: true, message: "Copied to clipboard", method: "clipboard-item" };
      } catch {
        // The value never came (reported below) or this write was refused: try the ordinary way.
      }
    }
    let text;
    try {
      text = await valid;
    } catch (error) {
      const errorMsg = `Copy failed: ${error.message}`;
      this._handleCopyFeedback(false, errorMsg, showToast, toastCallback);
      return { success: false, message: errorMsg, method: "error" };
    }
    return this.handleCopy(text, options);
  }

  /**
   * The pending clear of the last sensitive copy, if any: { text, timer, detach }. detach, while set,
   * removes the listeners waiting for the page to come back.
   */
  static _pendingClear = null;

  /** Drops the pending clear, its timer and its listeners. @private */
  static _cancelPendingClear = () => {
    const pending = this._pendingClear;
    this._pendingClear = null;
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.detach?.();
  }

  /**
   * After anything is put on the clipboard: whatever secret was there is overwritten, so its pending
   * clear goes (where the clipboard cannot be read it would otherwise wipe this new copy). A sensitive
   * copy then schedules its own clear.
   * @private
   */
  static _afterClipboardWrite = (text, sensitive, clearAfterMs) => {
    this._cancelPendingClear();
    if (!sensitive) return;
    const pending = { text, timer: null, detach: null };
    this._pendingClear = pending;
    pending.timer = setTimeout(() => this._runClear(pending, true), clearAfterMs);
  }

  /**
   * Empties the clipboard for a pending clear, unless it can be read and holds something else now.
   * A browser refuses the write while the page is hidden or unfocused (the user went to paste the
   * secret elsewhere), so then, and when the time runs out while hidden, it tries once more when the
   * page is back (mayRetry false on that try).
   * @private
   */
  static _runClear = async (pending, mayRetry) => {
    const current = () => this._pendingClear === pending;   // a newer copy replaces this clear
    if (!current()) return;
    if (mayRetry && typeof document !== "undefined" && document.hidden) {
      this._clearOnReturn(pending);
      return;
    }
    if (await this._clipboardReadGranted()) {
      try {
        if ((await navigator.clipboard.readText()) !== pending.text) { // the user has copied something else
          if (current()) this._pendingClear = null;
          return;
        }
      } catch {
        // Refused after all (an unfocused page, say): clear regardless.
      }
    }
    if (!current()) return;
    const cleared = await this._emptyClipboard();
    if (!current()) return;
    if (cleared || !mayRetry) this._pendingClear = null;
    else this._clearOnReturn(pending);
  }

  /**
   * Waits for the page to be visible or focused again, then makes the pending clear's last try.
   * @private
   */
  static _clearOnReturn = (pending) => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      this._pendingClear = null;   // nothing to wait for
      return;
    }
    const onReturn = () => {
      if (document.visibilityState === "hidden") return;   // the change was to hidden
      pending.detach?.();
      this._runClear(pending, false);
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    pending.detach = () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      pending.detach = null;
    };
  }

  /**
   * Whether the clipboard may be read without asking. readText() otherwise raises a permission prompt
   * (Chrome) or a Paste callout (Firefox, Safari) out of nowhere, and the Android WebView refuses it,
   * so without the grant the clipboard counts as unreadable and is cleared regardless.
   * @private
   */
  static _clipboardReadGranted = async () => {
    try {
      const status = await navigator.permissions.query({ name: "clipboard-read" });
      return status.state === "granted";
    } catch {
      return false; // no Permissions API, or it does not know clipboard-read
    }
  }

  /**
   * Best-effort: write '' to the clipboard, through the Clipboard API or, where that is missing, a copy
   * event. Never throws; resolves to whether the write went through.
   * @private
   */
  static _emptyClipboard = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText("");
        return true;
      }
      const onCopy = (e) => { e.clipboardData.setData("text/plain", ""); e.preventDefault(); };
      document.addEventListener("copy", onCopy);
      try { return document.execCommand("copy"); } finally { document.removeEventListener("copy", onCopy); }
    } catch {
      return false;   // not permitted (a hidden or unfocused page)
    }
  }

  /**
   * Fallback copy method using textarea
   * @private
   */
  static _fallbackCopy = (text) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        opacity: 0;
        pointer-events: none;
      `;

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      return successful
        ? { success: true, message: "Copied using fallback method" }
        : { success: false, message: "Fallback copy method failed" };
    } catch (error) {
      return { success: false, message: `Fallback error: ${error.message}` };
    }
  }

  /**
   * Handle copy feedback
   * @private
   */
  static _handleCopyFeedback = (success, message, showToast, toastCallback) => {
    if (showToast && toastCallback && typeof toastCallback === "function") {
      toastCallback(success, message);
    }

    if (import.meta.env.MODE === "development") {
      //console.log(`Copy ${success ? "success" : "error"}:`, message);
    }
  }

  /**
   * Check if device is mobile
   * @private
   */
  static _isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  /**
   * Enhanced download handler with better platform detection
   * @param {string} url - URL to download/open
   * @param {Object} options - Download options
   * @returns {Object} Result object
   */
  static handleDownload = async (url, options = {}) => {
    const {
      fileName = null,
      openInNewTab = true,
      useBrowser = true,
      checkUrlValidity = false
    } = options;

    // Validate URL
    if (!url || typeof url !== "string") {
      return { success: false, message: "Invalid URL provided" };
    }

    try {
      // Check URL validity if enabled
      if (checkUrlValidity) {
        const isValid = await this._validateUrl(url);
        if (!isValid) {
          return { success: false, message: "Invalid or unreachable URL" };
        }
      }

      // Native platform handling (Capacitor)
      if (Capacitor.isNativePlatform()) {
        return await this._handleNativeDownload(url, fileName);
      }

      // Web platform handling
      return this._handleWebDownload(url, fileName, openInNewTab, useBrowser);

    } catch (error) {
      console.error("Download error:", error);
      return {
        success: false,
        message: `Download failed: ${error.message}`,
        error: error
      };
    }
  }

  /**
   * Handle download for native platforms using DbWorldDownload plugin
   * @private
   */
  static _handleNativeDownload = async (url, fileName = null) => {
    try {
      await DbWorldDownload.ensurePermissions();
      const result = await DbWorldDownload.startDownload({
        url,
        fileName: fileName || url.split('/').pop().split('?')[0] || 'download',
      });
      return {
        success: true,
        message: "Download started",
        platform: "native",
        method: "downloadManager",
        downloadId: result?.downloadId,
      };
    } catch (error) {
      console.error("Native download failed:", error);
      return {
        success: false,
        message: "Download failed",
        platform: "native",
        error: error
      };
    }
  }

  /**
   * Handle download for web platforms
   * @private
   */
  static _handleWebDownload = (url, fileName, openInNewTab, useBrowser) => {
    try {
      if (useBrowser && openInNewTab) {
        // Open in new tab (for streaming or direct access)
        const newWindow = window.open(url, "_blank", "noopener,noreferrer");

        if (!newWindow) {
          throw new Error("Popup blocked. Please allow popups for this site.");
        }

        return {
          success: true,
          message: "Opened in new tab",
          platform: "web",
          method: "new-tab"
        };
      } else {
        // Traditional download with filename
        const link = document.createElement("a");
        link.href = url;

        if (fileName) {
          link.download = fileName;
        }

        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return {
          success: true,
          message: fileName ? "Download started" : "Opening file",
          platform: "web",
          method: "anchor-download",
          fileName: fileName
        };
      }
    } catch (error) {
      console.error("Web download failed:", error);
      return {
        success: false,
        message: `Web download failed: ${error.message}`,
        platform: "web",
        error: error
      };
    }
  }

  /**
   * Validate URL accessibility
   * @private
   */
  static _validateUrl = async (url) => {
    try {
      const urlPattern = new URL(url);

      // For same-origin requests, we can do a HEAD request
      if (urlPattern.origin === window.location.origin) {
        const response = await fetch(url, { method: "HEAD" });
        return response.ok;
      }

      // For cross-origin, return true and let browser handle it
      return true;
    } catch (error) {
      console.warn("URL validation failed, proceeding anyway:", error);
      return true;
    }
  }

  // Quick methods for simple use cases
  static quickCopy = (text) => {
    return this.handleCopy(text, {
      enableFallback: true,
      enableShare: false,
      showToast: false
    });
  }

  static quickDownload = (url, fileName = null) => {
    return this.handleDownload(url, {
      fileName: fileName,
      openInNewTab: true,
      useBrowser: true
    });
  }

  // ========== STRING & URL UTILITIES ==========

  static modifySearchQuery = (query) => {
    return query.replace(/[:.\-_]/g, " ");
  }

  static isValidUrl = (url) => {
    const pattern = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
    return pattern.test(url);
  }

  static slugify = (str) => {
    return str
      ? str.toString()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "")
      : "";
  }

  // ========== STORAGE UTILITIES ==========

  static getCurrentUser = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      return user || null;
    } catch {
      return null;
    }
  }

  static removeUserFromLocal = () => {
    localStorage.setItem("login", "false");
    localStorage.setItem("user", null);
    localStorage.setItem("token", null);
  }

  static setUserInLocal = (user, token) => {
    localStorage.setItem("login", "true");
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", token);
  }

  // ========== MEDIA INFO CONVERSION ==========

  static convertMediaInfoToCustomFormat = (id, data, _isSearchedFile) => {
    if (!data) return [];

    const dataArray = Array.isArray(data) ? data : [data];

    return dataArray.map(mediaFile => {
      const mediaId = id ?? mediaFile.id;

      // New API uses `tracks` with durations in ms and rawMediaInfo per track.
      // Old API used `trackInfos` with durations in seconds and no rawMediaInfo.
      const isNewFormat = !!mediaFile?.tracks;

      const mediaDetails = {
        id: mediaId,
        mediaFileId: mediaFile.id ?? null,
        filePath: mediaFile.filePath ?? null,
        tmdbSeasonNumber: mediaFile.tmdbSeasonNumber ?? null,
        tmdbEpisodeNumber: mediaFile.tmdbEpisodeNumber ?? null,
        general: {},
        video: {},
        audio: [],
        subtitle: [],
        streamUrl: null,
        downloadUrl: null,
      };

      const bytesToReadable = (value) => {
        if (!value) return null;
        const result = this.bytesToReadbleFormat(value);
        return `${result.value} ${result.suffix}`;
      };

      // Convert duration to seconds for formatDuration().
      // New format stores ms; old format already in seconds.
      const toSecs = (d) => (d != null && isNewFormat) ? Math.round(d / 1000) : d;

      // Build a format string safely — omits the codec part if not available
      const fmtStr = (track, raw) => {
        const commercial = track?.formatCommercialIfAny ?? raw?.Format_Commercial_IfAny;
        const codec = track?.codecID ?? raw?.CodecID;
        const base = commercial || track?.format;
        return codec ? `${base} (${codec})` : base ?? track?.format ?? null;
      };

      (mediaFile?.tracks ?? mediaFile?.trackInfos)?.forEach(track => {
        if (!track?.type) return;
        const type = track.type;
        const raw = (isNewFormat ? track?.rawMediaInfo : null) ?? {};

        if (type === 'General') {
          mediaDetails.general = {
            fileName: mediaFile.fileName,
            filePath: mediaFile.filePath,
            fileSize: bytesToReadable(track?.fileSize) ?? bytesToReadable(mediaFile?.fileSize),
            // Raw bytes as well as the formatted string: a caller with a LIST of files
            // (the download sheet's "34 files - 128 GB") can't add up "2.1 GB" strings.
            fileSizeBytes: Number(track?.fileSize ?? mediaFile?.fileSize) || null,
            duration: toSecs(track?.duration),
            overallBitrate: track?.overallBitRate ? `${bytesToReadable(track.overallBitRate)}/s` : null,
            format: track?.format,
            formatVersion: track?.formatVersion ?? raw?.Format_Version,
            videoCount: track?.videoCount,
            audioCount: track?.audioCount,
            textCount: track?.textCount,
            frameRate: track?.frameRate,
            encodedApplication: track?.encodedApplication ?? raw?.Encoded_Application,
            encodedLibrary: track?.encodedLibrary ?? raw?.Encoded_Library,
            isStreamable: track?.isStreamable === 'Yes' || raw?.IsStreamable === 'Yes',
          };
        } else if (this.isRealVideoTrack(track, raw) && !mediaDetails.video?.format) {
          const durSecs = toSecs(track?.duration);

          mediaDetails.video = {
            resolution: (track?.width && track?.height)
              ? `${track.width}x${track.height}`
              : null,
            aspectRatio: track?.displayAspectRatio ?? raw?.DisplayAspectRatio_String ?? 'N/A',
            format: fmtStr(track, raw),
            formatProfile: track?.formatProfile ?? raw?.Format_Profile,
            formatLevel: track?.formatLevel ?? raw?.Format_Level,
            formatTier: track?.formatTier ?? raw?.Format_Tier,
            bitRate: track?.bitRate,
            frameRate: track?.frameRate,
            frameRateMode: track?.frameRateMode ?? raw?.FrameRate_Mode,
            frameCount: track?.frameCount ?? (raw?.FrameCount != null ? Number(raw.FrameCount) : null),
            colorSpace: track?.colorSpace,
            chromaSubsampling: track?.chromaSubsampling ?? raw?.ChromaSubsampling,
            bitDepth: track?.bitDepth,
            colourPrimaries: track?.colourPrimaries ?? raw?.colour_primaries,
            transferCharacteristics: track?.transferCharacteristics ?? raw?.transfer_characteristics,
            matrixCoefficients: track?.matrixCoefficients ?? raw?.matrix_coefficients,
            size: bytesToReadable(track?.streamSize),
            duration: durSecs ? this.formatDuration(durSecs) : null,
            hdrDetails: track?.hdrFormat
              ? [
                track.hdrFormat,
                track?.hdrFormatVersion ?? raw?.HDR_Format_Version,
                track?.hdrFormatCompatibility,
              ].filter(Boolean).join(' | ')
              : null,
          };
        } else if (type === 'Audio') {
          mediaDetails.audio.push({
            language: this.getLanguageName(track?.language),
            title: track?.title,
            format: fmtStr(track, raw),
            bitRate: track?.bitRate ? `${bytesToReadable(track.bitRate)}/s` : null,
            channels: track?.channels,
            channelLayout: track?.channelLayout ?? raw?.ChannelLayout,
            samplingRate: track?.samplingRate,
            duration: toSecs(track?.duration),
            size: track?.streamSize ? bytesToReadable(track.streamSize) : null,
          });
        } else if (type === 'Text') {
          mediaDetails.subtitle.push({
            language: track?.language,
            title: track?.title,
            format: fmtStr(track, raw),
            codecID: track?.codecID ?? raw?.CodecID,
            bitRate: (track?.bitRate > 0) ? `${bytesToReadable(track.bitRate)}/s` : 'Unknown',
            frameCount: track?.frameCount ?? (raw?.FrameCount != null ? Number(raw.FrameCount) : null),
            duration: toSecs(track?.duration),
            forced: track?.forced,
            defaultFlag: track?.defaultTrack ?? track?.defaultFlag,
          });
        }
      });

      return mediaDetails;
    });
  };

  static isRealVideoTrack = (track, raw) => {
    if (!track || track.type !== 'Video') return false;

    // Exclude image/attachments (cover.jpg, poster, etc.)
    if (raw?.extra?.FILENAME) return false;

    // MJPEG video attachments
    if (track.codecID === 'V_MJPEG' || track.format === 'V_MJPEG') return false;

    // Zero duration is a strong signal of image
    if (!track.duration || track.duration <= 0) return false;

    return true;
  };

  // ========== HELPER FUNCTIONS ==========

  static getLanguageName = (code) => {
    const languages = {
      "hi": "Hindi",
      "en": "English",
      "en-US": "English (US)",
      "es": "Spanish",
      "fr": "French",
      "de": "German",
      "ja": "Japanese",
    };
    const baseLang = code?.split("-")[0];
    return languages[code] || languages[baseLang] || code;
  }

  static getChannelDescription = (channelCount) => {
    const descriptions = {
      1: "Mono",
      2: "Stereo",
      6: "5.1 Surround",
      8: "7.1 Surround"
    };
    return descriptions[channelCount] || `${channelCount} channels`;
  }

  static formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? hrs + "h " : ""}${mins > 0 ? mins + "m " : ""}${secs}s`;
  }

  static formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  static formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // ========== OTHER UTILITIES ==========

  static rgbaToHex = (rgba) => {
    const parts = rgba.substring(rgba.indexOf("(")).split(",");
    const r = parseInt(parts[0].substring(1).trim());
    const g = parseInt(parts[1].trim());
    const b = parseInt(parts[2].trim());
    const a = parseFloat(parts[3] ? parts[3].substring(0, parts[3].indexOf(")")).trim() : 1);

    const toHex = (n) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    if (a >= 1) return `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    const alphaByte = Math.round(a * 255);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(alphaByte)}`;
  };

  static getImageUrlFromTmdb = (tmdb, type, quality = "original") => {
    if (!tmdb) return null;
    let imagePath = null;
    let images = [];

    if (type === Constants.IMAGE_TYPE_POSTER) {
      images = tmdb.images?.posters || [];
    } else if (type === Constants.IMAGE_TYPE_BACKDROP) {
      images = tmdb.images?.backdrops || [];
    }

    if (images.length > 0) {
      const priorityGroups = [
        ["en"],
        ["hi"],
        ["gu", "ta", "te", "ml", "kn", "ko"],
      ];

      let filtered = [];

      for (let group of priorityGroups) {
        filtered = images.filter(
          img => group.includes(img.iso_639_1) && img.file_path !== null
        );
        if (filtered.length > 0) break;
      }

      if (filtered.length === 0) {
        filtered = images.filter(img => img.file_path !== null);
      }

      if (filtered.length > 0) {
        const randomIndex = Math.floor(Math.random() * filtered.length);
        imagePath = filtered[randomIndex].file_path;
      }
    }

    if (!imagePath) {
      imagePath = type === Constants.IMAGE_TYPE_POSTER ? tmdb.poster_path : tmdb.backdrop_path;
    }

    return Constants.TMDB_IMAGE_BASE_URL
      .replace("{quality}", quality)
      .replace("{imagePath}", imagePath);
  };

  static parseLogLine = (line) => {
    const userMatch = line.match(/User (.+?) is accessing API/);
    const apiMatch = line.match(/API: (.+?) \|/);
    const methodMatch = line.match(/\| Method: (.+?) from/);
    const refererMatch = line.match(/from Referer: (.+?)\. Token/);
    const tokenMatch = line.match(/Token Validated: (true|false)/);

    return {
      timestamp: line.substring(0, 23),
      user: userMatch?.[1] || "Unknown",
      api: apiMatch?.[1] || "Unknown",
      method: methodMatch?.[1] || "Unknown",
      referer: refererMatch?.[1] || "Unknown",
      tokenValidated: tokenMatch?.[1] === "true",
    };
  };

  // ========== LEGACY METHODS (for backward compatibility) ==========

  static convertKiBTobytes = (KiB) => {
    return parseFloat(parseFloat(KiB) * 1024).toFixed(2);
  }

  static convertMiBTobytes = (MiB) => {
    return parseFloat(parseFloat(MiB) * 1048576).toFixed(2);
  }

  static convertGiBTobytes = (GiB) => {
    return parseFloat(parseFloat(GiB) * 1073741824).toFixed(2);
  }

  static convertTobytes = (value, suffix) => {
    if (!value || !suffix) return null;

    if (typeof value === "string") {
      value = parseFloat(value).toFixed(0);
    }

    if (suffix === Constants.KIB) {
      return this.convertKiBTobytes(value);
    } else if (suffix === Constants.MIB) {
      return this.convertMiBTobytes(value);
    } else if (suffix === Constants.GIB) {
      return this.convertGiBTobytes(value);
    }
    return null;
  }

  static JSONToHTMLTable = (props) => {
    const { data, style } = props;
    return (
      <div className="">
        <table className="table table-sm table-striped table-bordered table-responsive">
          <tbody>
            {Object.keys(data).map((k) => (
              <tr key={k}>
                {!Array.isArray(data) &&
                  <th className="align-middle" scope="row" style={{ width: "10%" }} >
                    {k.replace(/_/g, " ")}
                  </th>
                }
                {(() => {
                  if (data[k] && typeof data[k] === "object") {
                    return (
                      <td className="align-middle" style={style}>
                        <this.JSONToHTMLTable data={data[k]} style={style} />
                      </td>
                    )
                  }
                  return (
                    <td className="align-middle">
                      {data[k]}
                    </td>
                  )
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

export default CommonServices;
