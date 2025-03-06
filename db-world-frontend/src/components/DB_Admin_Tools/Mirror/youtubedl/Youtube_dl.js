import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from 'react-toastify';
import Constants from "../../../Constants";
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { ytDownload, ytInfo, adminSearchRecord } from "../../../ApiServices";
import FormatSelection from "./FormatSelection";

function Youtube_dl() {
    const navigate = useNavigate();
    const location = useLocation();

    const [link, setLink] = useState("");
    const [submitLoader, setSubmitLoader] = useState(false);
    const [getDetailsLoader, setGetDetailsLoader] = useState(false);
    const [videoDetails, setVideoDetails] = useState([]);
    const [onlyAudio, setOnlyAudio] = useState(false);
    const [rename, setRename] = useState(false);
    const [title, setTitle] = useState("");
    const [totalSize, setTotalSize] = useState(0);
    const [recordName, setRecordName] = useState("");
    const [recordList, setRecordList] = useState([]);

    const onGetDetail = async () => {
        setGetDetailsLoader(true);

        try {
            const ytInfoRes = await ytInfo(link);
            if (ytInfoRes.httpStatusCode === 200) {
                const result = ytInfoRes.data;
                setVideoDetails(result.formats.reverse());
                setTitle(result.series && result?.series !== null || result.season_number && result?.season_number !== null
                    ? `${result?.series} S${result.season_number}E${result.episode_number} - ${result.title}`
                    : `${result.title}`);
            } else if (ytInfoRes.httpStatusCode === 401) {
                toast.error(ytInfoRes.message + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
                    },
                    autoClose: 1000
                });
            } else {
                toast.error(ytInfoRes.message);
            }
        } catch (err) {
            toast.error("Failed to fetch details.");
        }
        setGetDetailsLoader(false);
    };

    const onSubmit = async (videoITag, audioITag) => {
        setSubmitLoader(true);
        try {
            const ytDownloadRes = await ytDownload({
                url: link, folderName: recordName, fileName: title, fileSize: isNaN(totalSize) ? 0 : totalSize, videoITag, audioITag, onlyAudio
            });
            if (ytDownloadRes.httpStatusCode === 200) {
                toast.success(ytDownloadRes.message);
            } else {
                toast.error(ytDownloadRes.message);
            }
        } catch (err) {
            toast.error("Failed.");
        }
        setSubmitLoader(false);
    };

    const searchDbCinemaRecord = async () => {
        if (recordName.length > 2) {
            const response = await adminSearchRecord(recordName);
            if (response.httpStatusCode === 200) {
                setRecordList(response.data);
            }
        }
    };

    useEffect(() => {
        if (recordName) {
            searchDbCinemaRecord();
        }
    }, [recordName]);

    return (
        <div className="container">
            <h1 className="text-center my-3">YouTube Downloader</h1>

            {/* Record Selector */}
            <Form.Group className="mb-3">
                <Form.Label>Record</Form.Label>
                <Form.Control
                    list="recordList"
                    id="record"
                    value={recordName}
                    onChange={(e) => setRecordName(e.target.value)}
                    placeholder="Select or Type Record"
                />
                <datalist id="recordList">
                    {recordList.map(item => (
                        <option key={item.recordId} value={`${item.recordId}-${item.name}`}>{item.recordId} | {item.type} | {item.name}</option>
                    ))}
                </datalist>
            </Form.Group>

            {/* YouTube Link Input */}
            <Form.Group className="mb-3">
                <Form.Label>YouTube Link</Form.Label>
                <Form.Control
                    type="text"
                    id="youtubeLink"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="Enter YouTube Link"
                />
            </Form.Group>

            {/* Get Video Details Button */}
            <Button variant="primary" onClick={onGetDetail} disabled={getDetailsLoader}>Get Details</Button>

            {getDetailsLoader && (
                <div className="text-center">
                    <div className="spinner-border text-primary my-3" role="status">
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            )}

            {/* Video Details Section */}
            {!getDetailsLoader && videoDetails.length > 0 && (
                <div className="my-3">
                    <h3>Title: {title}</h3>

                    {/* Rename File Option */}
                    <Form.Check
                        type="checkbox"
                        id="rename"
                        label="Rename File"
                        checked={rename}
                        onChange={() => setRename(!rename)}
                    />
                    {rename && (
                        <Form.Control
                            type="text"
                            id="fileName"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Rename File"
                        />
                    )}

                    {/* Only Audio Option */}
                    <Form.Check
                        type="checkbox"
                        id="onlyAudio"
                        label="Download Only Audio"
                        checked={onlyAudio}
                        onChange={() => setOnlyAudio(!onlyAudio)}
                    />

                    <hr />

                    {/* Format Selection Component */}
                    <FormatSelection formats={videoDetails} onHandleSubmit={onSubmit} />
                </div>
            )}

            {Constants.TOAST_CONTAINER}
        </div>
    );
}

export default Youtube_dl;
