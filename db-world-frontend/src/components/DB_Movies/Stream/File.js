import React, { useEffect, useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import CommonServices from "../../CommonServices";
import Constants from "../../Constants";
import { deleteStreamFile, renameStreamFile } from "../../ApiServices";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";


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

    const playVideo = (file) => {
        let tempUrl = window.location.origin + "/api/stream/watch/" + file.fileId + "?t=" + localStorage.getItem("token");
        if (window.location.port === "3000") {
            tempUrl = tempUrl.replace("3000", "9000")
        }
        setVideoUrl(tempUrl);
        tempUrl = tempUrl.replace("/watch", "/download")
        setDownloadUrl(tempUrl)
        document.title = "DB World | DB Cinema - " + file.fileName;
        setVideoModel(true);
    }

    const handleStop = () => {
        setVideoModel(false);
        document.title = "DB World | DB Cinema"
    };

    const renameFile = async () => {
        let renameRes = await renameStreamFile(file.fileId, newName);
        if (renameRes.httpStatusCode === 200) {
            file.fileName = newName
            setOnRename(false);
        } else if(renameRes.httpStatusCode === 401 || renameRes.httpStatusCode === 403){
            navigate(await Constants.REDIRECT(Constants.DB_MOVIES_ROUTE ), { replace: true });
        }else{
            toast.error(renameRes.message);
        }
    }

    const deleteFile = async () => {
        let deleteFileRes = await deleteStreamFile(file.fileId);
        if (deleteFileRes.httpStatusCode === 200) {
            setDeleteModel(false);
        } else if(deleteFileRes.httpStatusCode === 401 || deleteFileRes.httpStatusCode === 403){
            navigate(await Constants.REDIRECT(Constants.DB_MOVIES_ROUTE ), { replace: true });
        }else{
            toast.error(deleteFileRes.message);
        }
    }

    return (
        <div className="m-1" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px" }}>
            <span>📃

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
                                    <span className="btn btn-outline-success btn-sm" onClick={renameFile}>Done</span>
                                    :
                                    <span className="btn btn-outline-dark btn-sm" onClick={() => setOnRename(true)}>🖋️ Rename</span>
                            }
                            &nbsp;<span className="btn btn-outline-danger btn-sm" onClick={() => setDeleteModel(true)}>🚮 Delete</span>
                        </>
                        : ""

                }

            </span>

            <Modal show={videoModel} animation onHide={handleStop}>
                <Modal.Header closeButton>
                    <Modal.Title className="overflow-auto w-100">{document.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <video id="player" class="player" controls style={{ width: "100%" }}
                        enabled autoPlay src={videoUrl}
                    >
                    </video>

                    <div className="w-100" style={{ overflow: "auto" }}>

                    </div>
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

                    <Button variant="danger" onClick={() => {
                        window.open(downloadUrl);
                    }}>
                        Download
                    </Button>
                    <Button variant="secondary" onClick={handleStop}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={deleteModel} animation onHide={() => setDeleteModel(false)}>
                <Modal.Header closeButton>
                    <Modal.Title className="overflow-auto w-100">{file.fileName}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you Sure that you want to delete this file ?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="danger" onClick={deleteFile}>
                        Yes !!
                    </Button>
                    <Button variant="secondary" onClick={() => setDeleteModel(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

        </div>
    )
}

export default File;