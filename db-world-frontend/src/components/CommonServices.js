import Constants from "./Constants";
import { addUser, moviePageNumber, moviePageNumber_b, moviePageNumber_g, moviePageNumber_h, moviePageNumber_k, moviePageNumber_s, seriesPageNumber, seriesPageNumber_b, seriesPageNumber_g, seriesPageNumber_h, seriesPageNumber_k, seriesPageNumber_s } from "../redux/action/allActions";
import { useDispatch } from "react-redux";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

const getTimeDateFromTimeStamp = (timestamp, timezone) => {

    timestamp = parseInt(timestamp);

    let date = new Date(timestamp);

    let timeString = date.toLocaleTimeString();
    let dateString = date.toLocaleDateString();

    return { date: dateString || null, time: timeString || null };
}

const getHHmmFromSeconds = (d) => {
    var date = new Date(null);
    date.setSeconds(d / 1000);
    return date.toISOString().substr(11, 8);
}

const valiadteToken = async () => {
    // const response = await fetch(Constants.VALIDATE_TOKEN_API);
    // if (response.status === 200) {
    //     return true;
    // }
    return true;
}

const getPercentage = (actual, total) => {
    let percentage = parseFloat((actual * 100) / total).toFixed(2)
    return percentage;
}

const bytesToReadbleFormat = (bytes) => {

    if (bytes == null || typeof (bytes) === "undefined") {
        return { value: 0, suffix: "Bytes" };
    }

    if (typeof (bytes) === "string") {
        bytes = parseFloat(bytes).toFixed(0);
    }

    if (bytes === 0) return { value: 0, suffix: "Bytes" };
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return { value: parseFloat((bytes / Math.pow(k, i)).toFixed(2)), suffix: sizes[i] };

    // var megabytes = bytes * 0.00000095367432;
    // var kilobytes = bytes * 0.00097656;
    // var gigabytes = megabytes * 0.00097656;

    // if (bytes < 1024) {
    //     return { value: bytes, suffix: "bytes" }
    // }
    // else if (kilobytes > 1 && kilobytes < 1024) {
    //     return { value: parseFloat(kilobytes).toFixed(2), suffix: "KB" }
    // }
    // else if (megabytes < 1024) {
    //     return { value: parseFloat(megabytes).toFixed(2), suffix: "MB" }
    // }
    // else if (megabytes > 1024) {
    //     return { value: parseFloat(gigabytes).toFixed(2), suffix: "GB" }
    // } else {
    //     return { value: null, suffix: null };
    // }
}

const modifySearchQuery = (query) => {
    return query.replace(":", " ")
        .replace("-", " ")
        .replace(".", " ")
        .replace("_", " ")
}

const convertKiBTobytes = (KiB) => {
    return parseFloat(parseFloat(KiB) * 1024).toFixed(2);
}

const convertMiBTobytes = (MiB) => {
    return parseFloat(parseFloat(MiB) * 1048576).toFixed(2);
}

const convertGiBTobytes = (GiB) => {
    return parseFloat(parseFloat(GiB) * 1073741824).toFixed(2);
}

const convertTobytes = (value, suffix) => {
    let bytes = null;
    if (typeof (value) === null || typeof (value) === "undefined" || typeof (suffix) === null || typeof (suffix) === "undefined") {
        return null;
    }

    if (typeof (value) === "string") {
        value = parseFloat(bytes).toFixed(0);
    }

    if (suffix === Constants.KIB) {
        bytes = convertKiBTobytes(value);
    } else if (suffix === Constants.MIB) {
        bytes = convertMiBTobytes(value);
    } else if (suffix === Constants.MIB) {
        bytes = convertGiBTobytes(value);
    }
    return bytes;
}

// Utility function to format milliseconds to a human-readable string
function formatETA(seconds) {
    if (seconds <= 0) return "0 sec";

    const years = Math.floor(seconds / (3600 * 24 * 365));
    const days = Math.floor((seconds % (3600 * 24 * 365)) / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (years > 0) {
        return `${years}y ${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    } else if (days > 0) {
        return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    } else if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    } else if (minutes > 0) {
        return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    } else {
        return `${secs} sec`;
    }
}

function handleCopy(text) {
    try {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
            return { success: true, message: 'Copied to clipboard' };
        } else {
            // Fallback for older browsers or mobile
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";  // avoid scrolling to bottom on iOS
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            const successful = document.execCommand("copy");
            document.body.removeChild(textarea);

            if (successful) {
                return { success: true, message: 'Copied using fallback' };
            } else {
                return { success: false, message: 'Fallback copy failed' };
            }
        }
    } catch (err) {
        return { success: false, message: `Copy failed: ${err.message}` };
    }
}


const handleDownload = (text, isAndroid) => {
    try {
        if (Capacitor.isNativePlatform()) {
            Browser.open(text)
        } else {
            window.open(text);
        }
    } catch (e) {
        alert(e)
    }
}

const getCurrentUser = () => {
    let user = JSON.parse(localStorage.getItem('user'));
    return typeof (user) !== "undefined" ? user : null;
}

const isValidUrl = (url) => {
    if (/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi.test(url)) {
        return true;
    } else {
        return false;
    }
}

const removeUserFromLocal = () => {
    // Local Storage
    localStorage.setItem('login', false);
    localStorage.setItem('user', null);
    localStorage.setItem('token', null);
}

const setUserInLocal = (user, token) => {
    // Local Storage
    localStorage.setItem('login', true);
    localStorage.setItem('user', user);
    localStorage.setItem('token', token);
}

const JSONToHTMLTable = (props) => {
    const { data, style } = props
    return (
        <div className="">
            <table className="table table-sm table-striped table-bordered table-responsive">
                <tbody>
                    {Object.keys(data).map((k) => (
                        <tr key={k}>
                            {!Array.isArray(data) &&
                                <th className="align-middle" scope="row" style={{ width: "10%" }} >
                                    {/* Convert snakes to space and capitalize for visual */}
                                    {k.replace(/_/g, ' ')}
                                </th>
                            }
                            {(() => {
                                if (data[k] && typeof data[k] === 'object') {
                                    return (
                                        <td className="align-middle" style={style}>
                                            <JSONToHTMLTable data={data[k]} style={style} />
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

const convertMediaInfoToCustomFormat = (id, data, isSearchedFile) => {
    if (!data) return [];

    const baseUrl = window.location.origin;
    // const port = window.location.port === "3000" ? "9000" : window.location.port;
    const basePath = isSearchedFile ? "/api/stream/watch/" : "/api/stream/watch/uuid/";
    const token = localStorage.getItem("token");

    return data.map(mediaFile => {
        const mediaId = id ?? mediaFile.id;
        const urlBase = `${baseUrl}${basePath}${mediaId}?t=${token}`;
        
        const mediaDetails = {
            id: mediaId,
            general: {},
            video: {},
            audio: [],
            subtitle: [],
            downloadUrl: urlBase.replace("/watch", "/download"),
            streamUrl: urlBase
        };

        mediaFile?.trackInfos?.forEach(track => {
            if (!track?.type) return;

            const type = track.type;
            const bytesToReadable = (value) => {
                const result = bytesToReadbleFormat(value);
                return `${result.value} ${result.suffix}`;
            };

            if (type === "General") {
                mediaDetails.general = {
                    fileName: mediaFile.fileName,
                    fileSize: bytesToReadable(track?.fileSize),
                    duration: track?.duration,
                    overallBitrate: `${bytesToReadable(track?.overallBitRate)}/s`,
                    format: track?.format,
                    formatVersion: track?.formatVersion,
                    videoCount: track?.videoCount,
                    audioCount: track?.audioCount,
                    textCount: track?.textCount,
                    frameRate: track?.frameRate,
                    fileCreatedDateLocal: track?.fileCreatedDateLocal,
                    fileModifiedDateLocal: track?.fileModifiedDateLocal,
                    encodedApplication: track?.encodedApplication,
                    encodedLibrary: track?.encodedLibrary,
                    isStreamable: track?.isStreamable === "Yes"
                };
            } 
            else if (type === "Video") {
                mediaDetails.video = {
                    resolution: `${track?.width}x${track?.height}`,
                    aspectRatio: track?.displayAspectRatio?.toFixed(3) || 'N/A',
                    format: `${track?.formatCommercialIfAny || track?.format} (${track?.codecID})`,
                    formatProfile: track?.formatProfile,
                    formatLevel: track?.formatLevel,
                    formatTier: track?.formatTier,
                    bitRate: track?.bitRate,
                    frameRate: track?.frameRate,
                    frameRateMode: track?.frameRateMode,
                    frameCount: track?.frameCount,
                    colorSpace: track?.colorSpace,
                    chromaSubsampling: track?.chromaSubsampling,
                    bitDepth: track?.bitDepth,
                    colourPrimaries: track?.colourPrimaries,
                    transferCharacteristics: track?.transferCharacteristics,
                    matrixCoefficients: track?.matrixCoefficients,
                    size: bytesToReadable(track?.streamSize),
                    duration: formatDuration(track?.duration),
                    hdrDetails: track?.hdrFormat ? [
                        track.hdrFormat,
                        track.hdrFormatVersion,
                        track.hdrFormatCompatibility
                    ].filter(Boolean).join(' | ') : null
                };
            } 
            else if (type === "Audio") {
                mediaDetails.audio.push({
                    language: getLanguageName(track?.language),
                    format: `${track?.formatCommercialIfAny || track?.format} (${track?.codecID})`,
                    bitRate: `${bytesToReadable(track?.bitRate)}/s`,
                    channels: track?.channels,
                    channelLayout: track?.channelLayout,
                    samplingRate: track?.samplingRate,
                    duration: track?.duration,
                    size: bytesToReadable(track?.streamSize)
                });
            } 
            else if (type === "Text") {
                mediaDetails.subtitle.push({
                    language: track?.language,
                    format: track?.formatCommercialIfAny || track?.format,
                    codecID: track?.codecID,
                    bitRate: track?.bitRate > 0 
                        ? `${bytesToReadable(track?.bitRate)}/s` 
                        : 'Unknown',
                    frameCount: track?.frameCount,
                    duration: track?.duration,
                    forced: track?.forced,
                    defaultFlag: track?.defaultFlag
                });
            }
        });

        return mediaDetails;
    });
};


// Helper functions
function getLanguageName(code) {
    const languages = {
        'hi': 'Hindi',
        'en': 'English',
        'en-US': 'English (US)',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'ja': 'Japanese',
        // ... other language codes
    };
    const baseLang = code?.split('-')[0];
    return languages[code] || languages[baseLang] || code;
}

function getChannelDescription(channelCount) {
    const descriptions = {
        1: 'Mono',
        2: 'Stereo',
        6: '5.1 Surround',
        8: '7.1 Surround'
        // ... other channel configurations
    };
    return descriptions[channelCount] || `${channelCount} channels`;
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm ' : ''}${secs}s`;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

const rgbaToHex = (rgba) => {
    // Parse RGBA values
    const parts = rgba.substring(rgba.indexOf("(")).split(",");
    const r = parseInt(parts[0].substring(1).trim());
    const g = parseInt(parts[1].trim());
    const b = parseInt(parts[2].trim());
    const a = parseFloat(parts[3] ? parts[3].substring(0, parts[3].indexOf(")")).trim() : 1);

    // Convert to HEX components
    const toHex = (n) => {
        const hex = Math.round(n).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    // For fully opaque (alpha = 1), return 6-digit HEX
    if (a >= 1) return `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    // For transparency, convert alpha to 0-255 scale and add to HEX
    const alphaByte = Math.round(a * 255);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(alphaByte)}`;
};

const getImageUrlFromTmdb = (tmdb, type, quality = 'original') => {
    if (!tmdb) return null;
    let imagePath = null;
    let images = [];

    // Determine which image array to use based on type
    if (type === Constants.IMAGE_TYPE_POSTER) {
        images = tmdb.images?.posters || [];
    } else if (type === Constants.IMAGE_TYPE_BACKDROP) {
        images = tmdb.images?.backdrops || [];
    }

    if (images.length > 0) {
        // Define priority groups in order
        const priorityGroups = [
            ['en'],                                 // First priority: English
            ['hi'],                                 // Second priority: Hindi
            ['gu', 'ta', 'te', 'ml', 'kn', 'ko'],    // Third priority: any one from these
        ];

        let filtered = [];

        // Loop over each group in order and break once we find images
        for (let group of priorityGroups) {
            filtered = images.filter(
                img => group.includes(img.iso_639_1) && img.file_path !== null
            );
            if (filtered.length > 0) break;
        }

        // If no images found in the priority groups, fallback to any available image
        if (filtered.length === 0) {
            filtered = images.filter(img => img.file_path !== null);
        }

        // If we have images, randomly pick one
        if (filtered.length > 0) {
            const randomIndex = Math.floor(Math.random() * filtered.length);
            imagePath = filtered[randomIndex].file_path;
        }
    }

    // Final fallback if imagePath still not set
    if (!imagePath) {
        imagePath = type === Constants.IMAGE_TYPE_POSTER ? tmdb.poster_path : tmdb.backdrop_path;
    }

    return Constants.TMDB_IMAGE_BASE_URL
        .replace('{quality}', quality)
        .replace('{imagePath}', imagePath);
};

function parseLogLine(line) {
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
}

const slugify = (str) => {
    return str
        ? str.toString()
            .toLowerCase()
            .replace(/\s+/g, '-')     // Replace spaces with -
            .replace(/[^\w\-]+/g, '') // Remove all non-word chars
            .replace(/\-\-+/g, '-')   // Replace multiple - with single -
            .replace(/^-+/, '')       // Trim - from start of text
            .replace(/-+$/, '')       // Trim - from end of text
        : '';
}



export default {
    getTimeDateFromTimeStamp,
    getHHmmFromSeconds,
    getPercentage,
    formatETA,
    isValidUrl,
    JSONToHTMLTable,
    bytesToReadbleFormat,
    convertTobytes,
    valiadteToken,
    modifySearchQuery,
    handleCopy,
    handleDownload,
    getCurrentUser,
    removeUserFromLocal,
    setUserInLocal,
    convertMediaInfoToCustomFormat,
    rgbaToHex,
    getImageUrlFromTmdb,
    parseLogLine,
    formatDuration,
    formatDateTime,
    getLanguageName,
    getChannelDescription,
    slugify
    // pageUpdate
}