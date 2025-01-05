import Constants from "./Constants";
import { addUser, moviePageNumber, moviePageNumber_b, moviePageNumber_g, moviePageNumber_h, moviePageNumber_k, moviePageNumber_s, seriesPageNumber, seriesPageNumber_b, seriesPageNumber_g, seriesPageNumber_h, seriesPageNumber_k, seriesPageNumber_s } from "../redux/action/allActions";
import { useDispatch } from "react-redux";

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
        return { value: null, suffix: null };
    }

    if (typeof (bytes) === "string") {
        bytes = parseFloat(bytes).toFixed(0);
    }

    var megabytes = bytes * 0.00000095367432;
    var kilobytes = bytes * 0.00097656;
    var gigabytes = megabytes * 0.00097656;

    if (bytes < 1024) {
        return { value: bytes, suffix: "bytes" }
    }
    else if (kilobytes > 1 && kilobytes < 1024) {
        return { value: parseFloat(kilobytes).toFixed(2), suffix: "KB" }
    }
    else if (megabytes < 1024) {
        return { value: parseFloat(megabytes).toFixed(2), suffix: "MB" }
    }
    else if (megabytes > 1024) {
        return { value: parseFloat(gigabytes).toFixed(2), suffix: "GB" }
    } else {
        return { value: null, suffix: null };
    }
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

const handleCopy = (text) => {
    try {
        const element = document.createElement("textarea");
        element.value = text;
        document.body.appendChild(element)
        element.select();
        document.execCommand("copy");
        document.body.removeChild(element);
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
                                <th className="align-middle" scope="row" style={{width : "10%"}} >
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

const convertMediaInfoToCustomFormat = (data) => {
    return data?.map(mediaFile => {
        let mediaDetails = {
            id: "",
            general: {},
            video: {},
            audio: [],
            subtitle: [],
            downloadUrl: "",
            streamUrl: ""
        }
        mediaDetails.id = mediaFile.id

        let tempUrl = window.location.origin + "/api/stream/watch/uuid/" + mediaFile.id + "?t=" + localStorage.getItem("token");
        if (window.location.port === "3000") {
            tempUrl = tempUrl.replace("3000", "9000")
        }
        mediaDetails.streamUrl = tempUrl;
        tempUrl = tempUrl.replace("/watch", "/download")
        mediaDetails.downloadUrl = tempUrl

        mediaFile?.trackInfos?.forEach(track => {
            if (track?.type === "General") {
                let general = {}
                general.fileName = mediaFile.fileName;
                general.fileSize = bytesToReadbleFormat(mediaFile?.fileSize).value + " " + bytesToReadbleFormat(mediaFile?.fileSize).suffix;
                general.duration = track?.duration;
                general.overallBitrate = bytesToReadbleFormat(track?.overallBitRate).value + " " + bytesToReadbleFormat(track?.overallBitRate).suffix + "/s";
                general.Description = track?.Description;
                mediaDetails.general = general;
            }
            if (track?.type === "Video") {
                let video = {}
                video.resolution = track?.width + "x" + track?.height;
                video.format = track?.codecID + " | " + track?.format + " | " + track?.formatProfile + " | " + bytesToReadbleFormat(track?.bitRate).value + " " + bytesToReadbleFormat(track?.bitRate).suffix + "/s";
                video.hdrDetails = track?.hdrFormat != null && track?.hdrFormat + " | " + track?.hdrFormatVersion + " | " + track?.hdrFormatCompatibility
                video.size = bytesToReadbleFormat(track?.streamSize).value + " " + bytesToReadbleFormat(track?.streamSize).suffix;
                mediaDetails.video = video;
            }
            if (track?.type === "Audio") {
                let audio = {}
                audio.language = track?.language;
                audio.format = track?.codecID + " | " + track?.format + " @ " + bytesToReadbleFormat(track?.bitRate).value + " " + bytesToReadbleFormat(track?.bitRate).suffix + "/s";
                // audio.bitrate = track?.bitRate;
                audio.size = bytesToReadbleFormat(track?.streamSize).value + " " + bytesToReadbleFormat(track?.streamSize).suffix;
                audio.channelInfo = track?.channels + " | " + track?.channelPositions;
                mediaDetails.audio.push(audio);
            }
            if (track?.type === "Text") {
                let subtitle = {}
                subtitle.format = track?.codecID + " " + track?.format + " @ " + bytesToReadbleFormat(track?.bitRate).value + " " + bytesToReadbleFormat(track?.bitRate).suffix + "/s";
                subtitle.language = track?.language;
                subtitle.size = bytesToReadbleFormat(track?.streamSize).value + " " + bytesToReadbleFormat(track?.streamSize).suffix;;
                mediaDetails.subtitle.push(subtitle);
            }
        });
        return mediaDetails;
    })
}


export default {
    getTimeDateFromTimeStamp,
    getHHmmFromSeconds,
    getPercentage,
    isValidUrl,
    JSONToHTMLTable,
    bytesToReadbleFormat,
    convertTobytes,
    valiadteToken,
    modifySearchQuery,
    handleCopy,
    getCurrentUser,
    removeUserFromLocal,
    setUserInLocal,
    convertMediaInfoToCustomFormat
    // pageUpdate
}