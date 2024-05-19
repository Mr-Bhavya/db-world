import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ToastContainer, toast } from 'react-toastify';
import Constants from "../Constants";
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import CommonServices from "../CommonServices";
import { ytDownload, ytInfo } from "../ApiServices";

function Youtube_dl() {

    const navigate = useNavigate();
    const [link, setLink] = useState("");
    const [submitLoader, setSubmitLoader] = useState(false);
    const [getDetailsLoader, setGetDetailsLoader] = useState(false);
    const [videoDetails, setVideoDetails] = useState([]);
    const [selectQuality, setSelectQuality] = useState("video");
    const [videoItag, setVideoItag] = useState(137);
    const [audioItag, setAudioItag] = useState(0);
    const [onlyAudio, setOnlyAudio] = useState(false);
    const [rename, setRename] = useState(false);
    const [title, setTitle] = useState("")
    const [totalSize, setTotalSize] = useState(0);
    const [method, setMethod] = useState("function");
    const TYPE_VIDEO = "video";
    const TYPE_AUDIO = "audio";

    const [videoFormat, setVideoFormat] = useState([]);
    const [audioFormat, setAudioFormat] = useState([]);
    const [resolution_2160, setResolution_2160] = useState([]);
    const [resolution_1440, setResolution_1440] = useState([]);
    const [resolution_1080, setResolution_1080] = useState([]);
    const [resolution_720, setResolution_720] = useState([]);
    const [resolution_480, setResolution_480] = useState([]);
    const [resolution_other, setResolution_other] = useState([]);

    const filterFormat = (videoDetails) => {
        let videoFormat = videoDetails.filter(({ asr, acodec, abr, protocol }) => (asr === null || acodec === "none" || abr === 0) && protocol !== "mhtml")
        let audioFormat = videoDetails.filter(({ height, vcodec, vbr, protocol }) => (height === null || vcodec === "none" || vbr === 0) && protocol !== "mhtml")
        let resolution_2160 = videoFormat?.filter(({ resolution, height, format_note }) => resolution?.includes("2160") || height === 2160 || format_note?.includes("2160"));
        let resolution_1440 = videoFormat?.filter(({ resolution, height, format_note }) => resolution?.includes("1440") || height === 1440 || format_note?.includes("1440"));
        let resolution_1080 = videoFormat?.filter(({ resolution, height, format_note }) => resolution?.includes("1080") || height === 1080 || format_note?.includes("1080"));
        let resolution_720 = videoFormat?.filter(({ resolution, height, format_note }) => resolution?.includes("720") || height === 720 || format_note?.includes("720"));
        let resolution_480 = videoFormat?.filter(({ resolution, height, format_note }) => resolution?.includes("480") || height === 480 || format_note?.includes("480"));
        let resolution_other = videoFormat?.filter((format) => !resolution_2160.includes(format)
            && !resolution_1440.includes(format)
            && !resolution_1080.includes(format)
            && !resolution_720.includes(format)
            && !resolution_480.includes(format));

        setVideoFormat(videoFormat)
        setAudioFormat(audioFormat)
        setResolution_2160(resolution_2160);
        setResolution_1440(resolution_1440);
        setResolution_1080(resolution_1080);
        setResolution_720(resolution_720);
        setResolution_480(resolution_480);
        setResolution_other(resolution_other);

    }

    const onGetDetail = async (e) => {
        setGetDetailsLoader(true)
        setSelectQuality("video");
        try {
            const ytInfoRes = await ytInfo(link)
            if (ytInfoRes.httpStatusCode === 200) {
                // console.log(data);
                let result = ytInfoRes.data;
                setVideoDetails(result.formats.reverse());
                filterFormat(result.formats.reverse());
                setTitle(
                    result.series && result?.series !== null || result.season_number && result?.season_number !== null ?
                        `${result?.series} S${result.season_number}E${result.episode_number} - ${result.title}` //For Series ${result.upload_date ? ` (${result.upload_date.slice(0,4)})` : ""}
                        :
                        `${result.title}` //For Movies
                );
                
            } else if (ytInfoRes.httpStatusCode === 401) {
                toast.error(ytInfoRes.message + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=download"));
                    },
                    autoClose: 1000
                })
            } else {
                toast.error(ytInfoRes.message)
                setSubmitLoader(false);
                setVideoDetails([])
                filterFormat([]);
            }
        } catch (err) {
            console.log(err);
            toast.error("Failed.")
        }
        setGetDetailsLoader(false);
    }

    const inputForm = (f, type) => {
        var fileSize = f.filesize ? CommonServices.bytesToReadbleFormat(f.filesize) : CommonServices.bytesToReadbleFormat(f.filesize_approx);
        var tbr = CommonServices.bytesToReadbleFormat(CommonServices.convertTobytes(f.tbr, Constants.KIB));
        if (type === TYPE_VIDEO) {
            return (

                <div className="form-check">
                    <input className="form-check-input"
                        type="radio"
                        name="videoItag"
                        id={f.format_id}
                        defaultChecked={f.format_id === videoItag}
                        value={f.format_id}
                        onChange={() => {
                            setVideoItag(f.format_id)
                            setTotalSize(fileSize == null ? 0 : parseFloat(CommonServices.convertTobytes(fileSize.value, fileSize.suffix)).toFixed(2))
                            setAudioItag(0);
                        }}
                    />
                    <label className="form-check-label" htmlFor={f.format_id}>
                        <div>
                            <b>Format: </b> {f.format}<br />
                            <b>VCodec:</b> {f.vcodec} <br />
                            {/* <b>Resolution: </b> {f.resolution}<br />
                            <b>format_note: </b> {f.format_note}<br />
                            <b>height: </b> {f.height}<br />
                            <b>width: </b> {f.width}<br /> */}
                            {/* <b>VBR: </b> {CommonServices.convertTobytes(videoFormat.vbr)} <br /> */}
                            <b>Dynamic Rrange: </b> {f.dynamic_range}<br />
                            <b>TBR: </b> {tbr?.value} {tbr?.suffix}/s<br />
                            <b>Filesize: </b> {fileSize?.value} {fileSize?.suffix}<br />
                            <b>Video_Ext: </b> {f.video_ext}<br />
                            <b>Container: </b> {f.container}<br />
                            <b>Protocol: </b> {f.protocol}<br />
                            <b>ID: </b> {f.format_id}<br />
                        </div>
                        <br />
                    </label>


                </div>
            )
        } else if (type === TYPE_AUDIO) {
            return (
                <div className="form-check">
                    <input className="form-check-input"
                        type="radio"
                        name="audioItag"
                        id={f.format_id}
                        defaultChecked={f.format_id === audioItag}
                        value={f.format_id}
                        onChange={() => setAudioItag(f.format_id)} />
                    <label className="form-check-label" htmlFor={f.format_id}>
                        <div>
                            <b>format: </b> {f.format}<br />
                            <b>acodec:</b> {f.acodec} <br />
                            {/* <b>Resolution: </b> {f.resolution}<br />
                            <b>format_note: </b> {f.format_note}<br /> */}
                            <b>Audio Channels:</b> {f.audio_channels}<br />
                            <b>TBR: </b> {tbr?.value} {tbr?.suffix}/s<br />
                            <b>filesize: </b> {fileSize?.value} {fileSize?.suffix}<br />
                            <b>audio_ext: </b> {f.audio_ext}<br />
                            <b>container: </b> {f.container}<br />
                            <b>Protocol: </b> {f.protocol}<br />
                            <b>ID: </b> {f.format_id}<br />
                        </div>
                        <br />
                    </label>
                </div>
            )
        }

    }



    const onSubmit = async () => {
        // console.log(videoItag, audioItag)
        setSubmitLoader(true);
        try {
            const ytDownloadRes = await ytDownload({
                url: link, fileName:title, fileSize: totalSize == "NaN" ? 0 : totalSize, videoITag: videoItag,
                audioITag: audioItag, onlyAudio
            })

            // const res = await fetch("/api/media/yt/download", {
            //     method: "POST",
            //     headers: {
            //         Accept: "application/json",
            //         "Content-Type": "application/json",
            //     },
            //     credentials: "include",
            //     body: JSON.stringify({
            //         url: link,
            //         title: title,
            //         totalSize,
            //         videoItag,
            //         audioItag,
            //         thumbnail_url: videoDetails.thumbnail_url,
            //         onlyAudio,
            //         isYt: true
            //     })
            // })
            // console.log(res);
            // const data = await res.json();
            // console.log(data);
            if (ytDownloadRes.httpStatusCode === 200) {
                toast.success(ytDownloadRes.message);
            } else {
                toast.error(ytDownloadRes.message)
            }
            setSubmitLoader(false);
        } catch (err) {
            console.log(err);
            setSubmitLoader(false);
            toast.error("Failed.")
        }
    }




    return (
        <div className="card mx-3 my-3"
            style={{
                border: "2px solid",
                background: "rgba(255 ,255 ,255, 0.9)",
            }}
        >
            <h1 className="card-title text-center mx-3 my-2 border-bottom border-5 border-dark"> Youtube Downloader </h1>

            <div className="col-6 mx-3">
                <select className="form-select"
                    aria-label="select ytdlp method"
                    onChange={(e) => setMethod(e.target.value)}
                >
                    <option selected>Select Method</option>
                    <option selected={method === "function" ? true : false} value="function">Using ytDlpWrap Method</option>
                    <option selected={method === "command" ? true : false} value="command">Using Command Method</option>
                </select>
            </div>

            <div className="row g-2 mx-2 my-1">
                <div className="col-md">
                    <div className="form-floating mb-2">
                        <input type="text"
                            className="form-control"
                            id="floatingInput"
                            name="youtubeLink"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="Enter Youtube Link" />
                        <label htmlFor="floatingInput">Youtube Link</label>
                    </div>
                </div>
                <div className="col-md">
                    <div className="form-floating">
                        <button type="submit"
                            className="btn btn-primary mx-3 my-1"
                            onClick={onGetDetail}
                        >Get Details</button>
                    </div>
                </div>
            </div>
            <hr />

            {
                !getDetailsLoader ?
                    videoDetails.length != 0 ?
                        <div className="mx-3 my-3">
                            <h3>Title:  {title}</h3>
                            <hr />
                            <div className='col-md'>
                                <input className="form-check-input mx-3"
                                    type="checkbox"
                                    value={rename}
                                    id="rename"
                                    checked={rename}
                                    onChange={() => {
                                        setRename(!rename)
                                    }
                                    } />
                                <label className="form-check-label" htmlFor="rename">
                                    <h5>Rename File</h5>
                                </label>

                                {
                                    rename &&
                                    <div className="col-md mx-3">
                                        <div className="form-floating mb-2">
                                            <input type="search"
                                                className="form-control"
                                                id="floatingInput"
                                                name="title"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Rename file" />
                                            <label htmlFor="floatingInput">File Name</label>
                                        </div>
                                    </div>
                                }

                            </div>
                            <hr />
                            <div className="form-check">
                                <input className="form-check-input"
                                    type="checkbox"
                                    value={onlyAudio}
                                    id="onlyAudio"
                                    checked={onlyAudio}
                                    onChange={() => {
                                        setOnlyAudio(!onlyAudio)
                                        console.log(onlyAudio);
                                    }
                                    } />
                                <label className="form-check-label" htmlFor="onlyAudio">
                                    <h5>Download only Audio</h5>
                                    <ButtonGroup aria-label="Quality button">
                                        <Button variant={selectQuality === "video" ? "dark" : "light"} onClick={() => setSelectQuality("video")}>Video Quality</Button>
                                        <Button variant={selectQuality === "audio" ? "dark" : "light"} onClick={() => setSelectQuality("audio")}>Audio Quality</Button>
                                    </ButtonGroup>
                                </label>
                            </div>
                            <div>
                                {
                                    !onlyAudio ?
                                        videoDetails &&
                                            selectQuality === "video" ?
                                            <div className="row g-2 mx-2 my-1">
                                                <div className="col-md-6">
                                                    <div>
                                                        <h3>Select Video Quality</h3>
                                                        <div>
                                                            {
                                                                resolution_2160 && resolution_2160.length > 0 &&
                                                                <details>
                                                                    <summary><b> 2160p Resolution </b></summary>
                                                                    {
                                                                        resolution_2160.map((f) => {
                                                                            return inputForm(f, TYPE_VIDEO);
                                                                        })
                                                                    }
                                                                </details>
                                                            }
                                                            {
                                                                resolution_1440 && resolution_1440.length > 0 &&
                                                                <details>
                                                                    <summary><b> 1440p Resolution </b></summary>
                                                                    {
                                                                        resolution_1440.map((f) => {
                                                                            return inputForm(f, TYPE_VIDEO);
                                                                        })
                                                                    }
                                                                </details>
                                                            }
                                                            {
                                                                resolution_1080 && resolution_1080.length > 0 &&
                                                                <details>
                                                                    <summary><b> 1080p Resolution </b></summary>
                                                                    {
                                                                        resolution_1080.map((f) => {
                                                                            return inputForm(f, TYPE_VIDEO);
                                                                        })
                                                                    }
                                                                </details>
                                                            }
                                                            {
                                                                resolution_720 && resolution_720.length > 0 &&
                                                                <details>
                                                                    <summary><b> 720p Resolution </b></summary>
                                                                    {
                                                                        resolution_720.map((f) => {
                                                                            return inputForm(f, TYPE_VIDEO);
                                                                        })
                                                                    }
                                                                </details>
                                                            }
                                                            {
                                                                resolution_480 && resolution_480.length > 0 &&
                                                                <details>
                                                                    <summary><b> 480p Resolution </b></summary>
                                                                    {
                                                                        resolution_480.map((f) => {
                                                                            return inputForm(f, TYPE_VIDEO);
                                                                        })
                                                                    }
                                                                </details>
                                                            }
                                                            {
                                                                resolution_other && resolution_other.length > 0 &&
                                                                <details>
                                                                    <summary><b> Other Resolutions </b></summary>
                                                                    {
                                                                        resolution_other.map((f) => {
                                                                            return inputForm(f, TYPE_VIDEO);
                                                                        })
                                                                    }
                                                                </details>
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            :
                                            <div>

                                                <h3>Select Audio Quality</h3>
                                                {
                                                    audioFormat.map(f => {
                                                        return inputForm(f, TYPE_AUDIO);
                                                    })
                                                }
                                            </div>
                                        :
                                        <div>

                                            <h3>Select Audio Quality</h3>
                                            {
                                                audioFormat.map(f => {
                                                    return inputForm(f, TYPE_AUDIO);
                                                })
                                            }
                                        </div>
                                }

                                <hr />
                                {
                                    !submitLoader &&
                                    <button type="submit"
                                        className="btn btn-primary mx-3 my-3"
                                        onClick={onSubmit}
                                    >Submit</button>
                                    ||
                                    <button className="btn btn-primary" type="button" disabled>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        &nbsp;&nbsp;&nbsp;Processing ...
                                    </button>
                                }
                                <button type="submit"
                                    className="btn btn-danger btn-outline mx-3 my-3"
                                    onClick={() => navigate(-1)}
                                >❌ Cancel</button>
                            </div>
                        </div>
                        : ""
                    : <div className='d-flex justify-content-center'>
                        <div className="spinner-border text-danger m-5" role="status">
                            <span className="sr-only text-center" />
                        </div>
                    </div>
            }
            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={true}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
        </div >
    )

}

export default Youtube_dl;