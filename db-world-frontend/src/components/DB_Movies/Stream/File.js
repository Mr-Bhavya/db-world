import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import CommonServices from "../../CommonServices";


function File(props) {
    const { file } = props;
    const [videoModel, setVideoModel] = useState(false);
    const [videoUrl, setVideoUrl] = useState("");
    const [downloadUrl, setDownloadUrl] = useState("");
    const [onUrlCopied, setOnUrlCopied] = useState(false);

    const playVideo = async (file) => {
        let tempUrl = window.location.origin + "/api/stream/watch/" + file.fileId +"?t=" + localStorage.getItem("token");
        if (window.location.port === "3000") {
            tempUrl = tempUrl.replace("3000", "9000")
        }
        setVideoUrl(tempUrl);
        tempUrl = tempUrl.replace("/watch", "/download")
        setDownloadUrl(tempUrl)
        setVideoModel(true);
        document.title = "DB World | DB Cinema - " + file.fileName;
    }

    return (
        <div className="m-1" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px" }}>
            <span>📃 {file.fileName} || {CommonServices.bytesToReadbleFormat(file.fileSize).value} {CommonServices.bytesToReadbleFormat(file.fileSize).suffix} ||
                <span className="btn" onClick={() => playVideo(file)}>▶️ Play</span>
            </span>

            <Modal show={videoModel} onHide={() => {
                setVideoModel(false)
                setVideoUrl(null);
                document.title = "DB World | DB Cinema"
            }}>
                <Modal.Header closeButton>
                    <Modal.Title className="overflow-auto w-100">{document.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <video id="player" class="player" controls enabled style={{ width: "100%" }} >
                        <source src={videoUrl} />
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
                    <Button variant="secondary" onClick={() => {
                        setVideoModel(false)
                        setVideoUrl(null);
                        document.title = "DB World | DB Cinema"
                    }}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

        </div>
    )
}

export default File;