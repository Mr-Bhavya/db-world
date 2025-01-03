import React, { useEffect, useState } from "react";
import { Button, Modal, ToastContainer } from "react-bootstrap";
import CommonServices from "../../CommonServices";
import Constants from "../../Constants";
import { deleteStreamFile, loadStreamFileInfoByFiledId, renameStreamFile } from "../../ApiServices";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { v1 as uuidv1 } from 'uuid';
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import DownloadFileAndroid from "./DownloadFileAndroid";
import { Browser } from "@capacitor/browser";
import { useDispatch, useSelector } from "react-redux";
import { updateDownloadStatus } from "../../../redux/action/allActions";
import HtmlJsonTable from "react-json-to-html-table"


function File(props) {
    let { file, userRole } = props;
    const [videoModel, setVideoModel] = useState(false);
    const [deleteModel, setDeleteModel] = useState(false);
    const [videoUrl, setVideoUrl] = useState("");
    const [downloadUrl, setDownloadUrl] = useState("");
    const [onUrlCopied, setOnUrlCopied] = useState(false);
    const [newName, setNewName] = useState(file.fileName);
    const [onRename, setOnRename] = useState(false);
    const navigate = useNavigate();
    const [isDeleted, setIsDeleted] = useState(false);
    const [deleteLoader, setDeleteLoader] = useState(false);
    const [renameLoader, setRenameLoader] = useState(false);
    var currentFileStatus = useSelector(state => state.downloadProgressReducer);
    const [currentProgress, setCurrentProgress] = useState(currentFileStatus);
    const [mediaInfo, setMediaInfo] = useState([]);
    const [mediaInfoLoader, setMediaInfoLoader] = useState(false);
    const dispatch = useDispatch();

    const createUrls = () => {
        let tempUrl = window.location.origin + "/api/stream/watch/" + file.fileId + "?t=" + localStorage.getItem("token");
        if (window.location.port === "3000") {
            tempUrl = tempUrl.replace("3000", "9000")
        }
        file["videoUrl"] = tempUrl;
        tempUrl = tempUrl.replace("/watch", "/download")
        setDownloadUrl(tempUrl)
        file["downloadUrl"] = tempUrl;
    }

    const playVideo = (file) => {
        loadMediaInfo();
        setVideoUrl(file.videoUrl);
        document.title = "DB World | DB Cinema - " + file.fileName;
        setVideoModel(true);
    }

    const handleStop = () => {
        setVideoModel(false);
        document.title = "DB World | DB Cinema"
    };

    const handelFileDownload = () => {
        if (Capacitor.isNativePlatform()) {
            Browser.open({ url: file.downloadUrl })
        } else {
            window.open(downloadUrl);
        }
    }

    const renameFile = async () => {
        setRenameLoader(true);
        let renameRes = await renameStreamFile(file.fileId, newName);
        if (renameRes.httpStatusCode === 200) {
            file.fileName = newName
            setOnRename(false);
        } else if (renameRes.httpStatusCode === 401 || renameRes.httpStatusCode === 403) {
            navigate(await Constants.REDIRECT(Constants.DB_MOVIES_ROUTE), { replace: true });
        } else {
            toast.error(renameRes.message);
        }
        setRenameLoader(false);
    }

    const deleteFile = async () => {
        setDeleteLoader(true)
        let deleteFileRes = await deleteStreamFile(file.fileId);
        if (deleteFileRes.httpStatusCode === 200) {
            setDeleteModel(false);
            setIsDeleted(true);
            toast.success(deleteFileRes.message);
        } else if (deleteFileRes.httpStatusCode === 401 || deleteFileRes.httpStatusCode === 403) {
            navigate(await Constants.REDIRECT(Constants.DB_MOVIES_ROUTE), { replace: true });
        } else {
            toast.error(deleteFileRes.message);
        }
        setDeleteLoader(false)
    }

    const loadMediaInfo = async () => {
        let mediaInfoRes = await loadStreamFileInfoByFiledId(file.fileId);
        if (mediaInfoRes.httpStatusCode === 200) {
            setMediaInfo(CommonServices.convertMediaInfoToCustomFormat(mediaInfoRes.data));
        } else {
            toast.error(mediaInfoRes.message);
        }
    }

    useEffect(() => {
        createUrls();
        if (currentFileStatus != null) {
            setCurrentProgress(currentFileStatus[file.fileId]);
        }
    }, [])

    useEffect(() => {
        if (currentFileStatus != null) {
            setCurrentProgress(currentFileStatus[file.fileId]);
        }
    }, [currentFileStatus])

    const resetProgress = () => {
        let progress = {
            "download": false,
            "loaded": 0,
            "pending": 0,
            "total": file.fileSize,
            "failed": false,
            "message": null
        };
        if (currentFileStatus != null) {
            currentFileStatus[file.fileId] = { file, progress }
            setCurrentProgress(currentFileStatus[file.fileId]);
            dispatch(updateDownloadStatus(currentFileStatus));
        }
    }

    return (
        isDeleted ||
        <div className="m-1"
            style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px" }}
        >
            <span style={{ overflowX: "auto" }}>📃
                {
                    onRename ? <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} /> : file.fileName
                }
                || {CommonServices.bytesToReadbleFormat(file.fileSize).value} {CommonServices.bytesToReadbleFormat(file.fileSize).suffix} ||
                &nbsp;<span className="btn btn-outline-success btn-sm" onClick={() => playVideo(file)}>▶️ Play</span>
                {
                    Constants.ADMIN_USER_ROLE.toLocaleLowerCase() === userRole?.toLocaleLowerCase() || Constants.OWNER_USER_ROLE.toLocaleLowerCase() === userRole?.toLocaleLowerCase() ?
                        <>&nbsp;
                            {
                                onRename ?
                                    renameLoader ? Constants.BUTTON_LOADER("dark", "Renaming") : <span className="btn btn-outline-success btn-sm" onClick={renameFile}>Done</span>
                                    :
                                    <span className="btn btn-outline-dark btn-sm" onClick={() => setOnRename(true)}>🖋️ Rename</span>
                            }
                            &nbsp;<span className="btn btn-outline-danger btn-sm" onClick={() => setDeleteModel(true)}>🚮 Delete</span>
                        </>
                        : ""
                }

            </span>

            {

                <Modal show={videoModel} animation onHide={handleStop} fullscreen={true}>
                    <Modal.Header closeButton>
                        <Modal.Title className="overflow-auto w-100">{document.title}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div>
                            <video id="player" class="player" controls style={{ width: "100%" }}
                                enabled autoPlay src={videoUrl}
                            ></video>
                        </div>
                        <div  style={{ width: "100%", overflowX: "auto" }} >
                            <HtmlJsonTable data={mediaInfo} className="table table-sm table-striped table-bordered table-responsive"/>
                        </div>
                        <hr />
                        {
                            currentProgress && currentProgress != null && typeof (currentProgress) != "undefined" && currentProgress.progress?.download ?
                                <div>
                                    <h3><u><b>Download status</b> </u></h3>
                                    {/* {console.log("currentProgress:", currentProgress)} */}
                                    <div><b>Total Size: </b>{CommonServices.bytesToReadbleFormat(file.fileSize)?.value} {CommonServices.bytesToReadbleFormat(file.fileSize)?.suffix}</div>
                                    <div className="row">
                                        <div className="col-4 col-md-2">
                                            <b>Process : </b>
                                        </div>
                                        <div className="col-8 col-md-4">
                                            <div className="progress" style={{ width: "70%" }}>
                                                <div className="progress-bar progress-bar-striped progress-bar-animated bg-success text-dark" role="progressbar"
                                                    aria-valuemin="0"
                                                    aria-valuenow={CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}
                                                    aria-valuemax="100"
                                                    style={{ width: `${CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}%` }}
                                                >
                                                    <b>{CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)} % </b>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="row">
                                        <div className="col-6 col-md-2">
                                            <b>Percentage : </b>
                                        </div>
                                        <div className="col-6 col-md-4">
                                            {CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}%
                                        </div>
                                    </div>
                                    <hr />
                                    <div className="row">
                                        <div class="col"><Button className="btn btn-sm btn-warning" onClick={resetProgress} >Clear Download</Button></div>
                                    </div>
                                    <div >

                                    </div>
                                </div> : ""
                        }
                    </Modal.Body>
                    <Modal.Footer>

                        {
                            onUrlCopied ?
                                <Button variant="success">
                                    Copied !
                                </Button>
                                :
                                <Button variant="primary" onClick={() => {
                                    CommonServices.handleCopy(downloadUrl)
                                    setOnUrlCopied(true)
                                    setInterval(() => {
                                        setOnUrlCopied(false)
                                    }, 5000)

                                }}>
                                    Copy Url
                                </Button>
                        }

                        {
                            Capacitor.isNativePlatform() ? <DownloadFileAndroid file={file} />
                                :
                                <button className="btn btn-danger" onClick={handelFileDownload}>
                                    Download
                                </button>
                        }
                        <Button variant="secondary" onClick={handleStop}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            }

            {
                deleteModel ?
                    <Modal show={deleteModel} animation onHide={() => setDeleteModel(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title className="overflow-auto w-100">{file.fileName}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <p>Are you Sure that you want to delete this file ?</p>
                        </Modal.Body>
                        <Modal.Footer>
                            {
                                deleteLoader ?
                                    Constants.BUTTON_LOADER("danger", "Deleteing")
                                    :
                                    <Button variant="danger" onClick={deleteFile}>
                                        Yes !!
                                    </Button>
                            }
                            <Button variant="secondary" onClick={() => setDeleteModel(false)}>
                                Close
                            </Button>
                        </Modal.Footer>
                    </Modal> : ""
            }




            <ToastContainer
                containerId={`toast_` + uuidv1()}
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
            {/* {Constants.TOAST_CONTAINER} */}

        </div >
    )
}

export default File;