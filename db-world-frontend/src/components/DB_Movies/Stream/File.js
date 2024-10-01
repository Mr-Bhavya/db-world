import React, { useEffect, useState } from "react";
import { Button, Modal, ToastContainer } from "react-bootstrap";
import CommonServices from "../../CommonServices";
import Constants from "../../Constants";
import { deleteStreamFile, renameStreamFile } from "../../ApiServices";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { v1 as uuidv1 } from 'uuid';
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Http } from "@capacitor-community/http";
import { Directory } from "@capacitor/filesystem";
import DownloadFileAndroid from "./DownloadFileAndroid";
import { Browser } from "@capacitor/browser";
import { useDispatch, useSelector } from "react-redux";
import { getDownloadStatus, updateDownloadStatus } from "../../../redux/action/allActions";


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

    useEffect(() => {
        createUrls();
        if (currentFileStatus != null) {
            setCurrentProgress(currentFileStatus[file.fileId]);
        }
        // let downloadFileStatus = localStorage.getItem("downloadFileStatus");
        // if (downloadFileStatus != null) {
        //     downloadFileStatus = JSON.parse(downloadFileStatus);
        //     if (Object.keys(downloadFileStatus).filter(key => key == file.fileId).length != 0) {
        //         setCurrentFileStatus(downloadFileStatus[file.fileId].progress);
        //     }
        // }
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
            <span style={{overflowX:"auto"}}>📃
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
                videoModel ?
                    <Modal show={videoModel} animation onHide={handleStop}>
                        <Modal.Header closeButton>
                            <Modal.Title className="overflow-auto w-100">{document.title}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <video id="player" class="player" controls style={{ width: "100%" }}
                                enabled autoPlay src={videoUrl}
                            ></video>
                            <hr />

                            {
                                currentProgress && currentProgress != null && typeof (currentProgress) != "undefined" && currentProgress.progress.download ?
                                    <div>
                                        <h3><u><b>Download status</b> </u></h3>
                                        {/* {console.log("currentProgress:", currentProgress)} */}
                                        <p><b>Total Size: </b>{CommonServices.bytesToReadbleFormat(file.fileSize)?.value} {CommonServices.bytesToReadbleFormat(file.fileSize)?.suffix}</p>
                                        <div className="row">
                                            <div className="col-4 col-md-2">
                                                <b>Process : </b>({CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}%)
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
                                        {/* <p><b>Percentage: </b>({CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}%)
                                            <span className="progress"
                                                style={{ width: "50%" }}
                                            >
                                                <span className="progress-bar progress-bar-striped progress-bar-animated bg-success text-dark" role="progressbar"
                                                    aria-valuemin="0"
                                                    aria-valuenow={CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}
                                                    aria-valuemax="100"
                                                    style={{ width: `${CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}%` }}
                                                >
                                                    <b>{CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)} % </b>
                                                </span>
                                            </span>
                                        </p> */}
                                        <div>
                                            <Button className="btn btn-sm btn-warning my-3" onClick={resetProgress} >Clear Download</Button>
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
                            {/* <button className="btn btn-danger" onClick={handelFileDownload}>
                        Download
                    </button> */}
                            <Button variant="secondary" onClick={handleStop}>
                                Close
                            </Button>
                        </Modal.Footer>
                    </Modal> : ""
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