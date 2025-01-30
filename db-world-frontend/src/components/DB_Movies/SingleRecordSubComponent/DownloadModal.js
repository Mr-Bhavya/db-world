import React, { useState } from "react";
import { Accordion, Button, Card, Modal } from "react-bootstrap";
import CommonServices from "../../CommonServices";
import Constants from "../../Constants";
import CopyDownloadButton from "../SubComponents/CopyDownloadButton";
import { deleteMediaFileInfoById, loadStreamFileInfoByRecordId } from "../../ApiServices";
import LoadingSpinner from "../../LoadingSpinner";
import { toast } from "react-toastify";

const DownloadModal = ({ movie, userRole }) => {

    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [mediaFileList, setMediaFileList] = useState([]);
    const [mediaListLoader, setMediaListLoader] = useState(false);
    const [groupedFiles, setGroupedFiles] = useState([]); const [activeKey, setActiveKey] = useState(null);

    const groupFilesBySeason = (files) => {
        return files.reduce((acc, file) => {
            const match = file?.filePath?.match(/\/S(\d{2})\//);
            if (match) {
                const season = `Season ${parseInt(match[1], 10)}`;
                if (!acc[season]) {
                    acc[season] = [];
                }
                acc[season].push(CommonServices.convertMediaInfoToCustomFormat([file])[0]);
            }
            return acc;
        }, {});
    };

    const handleDownloadModal = async () => {
        setShowDownloadModal(true);
        setMediaListLoader(true);
        const response = await loadStreamFileInfoByRecordId(movie.recordId);
        if (response.httpStatusCode === 200) {
            setMediaFileList(CommonServices.convertMediaInfoToCustomFormat(response.data));
            setMediaListLoader(false);
            setGroupedFiles(groupFilesBySeason(response.data))
        }

    }

    const handelMediaFileInfoDelete = async (mediaFileId) => {
        let response = await deleteMediaFileInfoById(mediaFileId);
        if (response.httpStatusCode === 200) {
            toast.success(response.message);
            handleDownloadModal()
        }
        else
            toast.error(response.message || response.errorMessages);
    }

    return (

        <div>
            <Button className="btn-sm mx-1" variant="warning" onClick={handleDownloadModal}>Download</Button>

            <Modal show={showDownloadModal} onHide={() => setShowDownloadModal(false)} fullscreen={true}>
                <Modal.Header closeButton>
                    <Modal.Title>Media List</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {
                        mediaListLoader ? <LoadingSpinner />
                            : mediaFileList?.length == 0
                                ?
                                <div className="d-flex justify-content-center align-items-center vh-100">
                                    <div className="alert alert-danger text-center" role="alert">
                                        No media available to download for this record
                                    </div>
                                </div>
                                :
                                movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE ?
                                    <div>
                                        {
                                            mediaFileList.map((mediaFile, index) => {
                                                return (<Card className="my-3">
                                                    <Card.Header as="h5">{index + 1}. {mediaFile?.general?.fileName}</Card.Header>
                                                    <Card.Body>
                                                        <Card.Text>
                                                            <Accordion>
                                                                <Accordion.Item eventKey={mediaFile?.id}>
                                                                    <Accordion.Header>
                                                                        Show Media Info
                                                                    </Accordion.Header>
                                                                    <Accordion.Body>
                                                                        <div id={"media-info-" + index} style={{ overflow: "auto" }}>
                                                                            <CommonServices.JSONToHTMLTable data={mediaFile} />
                                                                        </div>
                                                                    </Accordion.Body>
                                                                </Accordion.Item>
                                                            </Accordion>
                                                        </Card.Text>
                                                    </Card.Body>
                                                    <Card.Footer className="m-0 p-0">
                                                        {
                                                            userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?
                                                                <div class="float-end">
                                                                    <button className='btn btn-sm' style={{ height: "65px" }}
                                                                        onClick={() => handelMediaFileInfoDelete(mediaFile.id)}
                                                                    >
                                                                        🗑️
                                                                        <br />
                                                                        <b style={{ fontSize: "0.6rem" }}>
                                                                            Delete
                                                                        </b>
                                                                    </button>
                                                                </div> : ""
                                                        }
                                                        <CopyDownloadButton text={mediaFile.downloadUrl} eventValue={mediaFile?.general?.fileName} />
                                                    </Card.Footer>
                                                </Card>)
                                            })
                                        }
                                    </div>
                                    :
                                    <div className="container m-1 p-0">

                                        <Accordion>
                                            {Object.keys(groupedFiles).map((season, index) => (
                                                <Card key={index}>
                                                    <Accordion.Item eventKey={index.toString()}>
                                                        <Accordion.Header>
                                                            {season}
                                                        </Accordion.Header>
                                                        <Accordion.Body className="p-0 m-0">
                                                            <Card.Body className="m-1 p-0">
                                                                {groupedFiles[season].map((mediaFile, idx) => (
                                                                    <Card className="p-0 m-1">
                                                                        <Card.Header as="h5" >{idx + 1}. {mediaFile?.general?.fileName}</Card.Header>
                                                                        <Card.Body>
                                                                            <Card.Text>
                                                                                <Accordion>
                                                                                    <Accordion.Item eventKey={mediaFile?.id}>
                                                                                        <Accordion.Header>
                                                                                            Show Media Info
                                                                                        </Accordion.Header>
                                                                                        <Accordion.Body>
                                                                                            <div id={"media-info-" + index} style={{ overflow: "auto" }}>
                                                                                                <CommonServices.JSONToHTMLTable data={mediaFile} />
                                                                                            </div>
                                                                                        </Accordion.Body>
                                                                                    </Accordion.Item>
                                                                                </Accordion>
                                                                            </Card.Text>
                                                                        </Card.Body>
                                                                        <Card.Footer className="m-0 p-0">
                                                                            {
                                                                                userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?
                                                                                    <div class="float-end">
                                                                                        <button className='btn btn-sm' style={{ height: "65px" }}
                                                                                            onClick={() => handelMediaFileInfoDelete(mediaFile.id)}
                                                                                        >
                                                                                            🗑️
                                                                                            <br />
                                                                                            <b style={{ fontSize: "0.6rem" }}>
                                                                                                Delete
                                                                                            </b>
                                                                                        </button>
                                                                                    </div> : ""
                                                                            }
                                                                            <CopyDownloadButton text={mediaFile.downloadUrl} eventValue={mediaFile?.general?.fileName} />
                                                                        </Card.Footer>
                                                                    </Card>
                                                                ))}
                                                            </Card.Body>
                                                        </Accordion.Body>
                                                    </Accordion.Item>
                                                </Card>
                                            ))}
                                        </Accordion>
                                    </div>
                    }

                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDownloadModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal >
        </div>
    )
}

export default DownloadModal;