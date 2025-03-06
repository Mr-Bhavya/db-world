import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FaCopy, FaDownload } from 'react-icons/fa';
import { loadMediaInfo, renameStreamFile, deleteStreamFile, loadStreamFileInfoByFiledId } from '../../../ApiServices';
import { useLocation, useNavigate } from 'react-router-dom';
import Constants from '../../../Constants';
import CommonServices from '../../../CommonServices';

function FileDetailsModal({ show, onHide, fileId, userRole }) {
    const [loading, setLoading] = useState(true);
    const [mediaInfo, setMediaInfo] = useState(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const handleRename = async () => {
        if (!newFileName.trim()) {
            toast.error('File name cannot be empty.');
            return;
        }
        let renameRes = await renameStreamFile(fileId, newFileName);
        if (renameRes.httpStatusCode === 200) {
            setMediaInfo((prev) => ({
                ...prev,
                general: { ...prev.general, fileName: newFileName }
            }));
            setIsEditingName(false);
        } else if (renameRes.httpStatusCode === 401 || renameRes.httpStatusCode === 403) {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        } else {
            toast.error(renameRes.message);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this file?')) {
            let deleteFileRes = await deleteStreamFile(fileId);
            if (deleteFileRes.httpStatusCode === 200) {
                onHide();
                toast.success(deleteFileRes.message);
            } else if (deleteFileRes.httpStatusCode === 401 || deleteFileRes.httpStatusCode === 403) {
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                toast.error(deleteFileRes.message);
            }
        }
    };

    const fetchMediaInfo = async () => {
        let mediaInfoRes = await loadStreamFileInfoByFiledId(fileId);
        if (mediaInfoRes.httpStatusCode === 200) {
            const converted = CommonServices.convertMediaInfoToCustomFormat(mediaInfoRes.data, true);
            if (converted.length > 0) {
                setMediaInfo(converted[0]);
                setNewFileName(converted[0]?.general?.fileName);
            }
            setLoading(false);
        } else {
            toast.error(mediaInfoRes.message);
        }
    };

    // Load media info when modal opens
    useEffect(() => {
        if (show) {
            setLoading(true);
            fetchMediaInfo();
        }
    }, [show, fileId]);

    // Handler to copy the download URL to clipboard
    const handleCopy = () => {
        if (mediaInfo && mediaInfo.downloadUrl) {
            CommonServices.handleCopy(mediaInfo.downloadUrl)
            toast.success("Download link is copied !!")
        } else {
            toast.info('No download URL available.');
        }
    };

    // Handler to download the file via the download URL
    const handleDownload = () => {
        if (mediaInfo && mediaInfo.downloadUrl) {
            window.open(mediaInfo.downloadUrl, '_blank');
        } else {
            toast.info('No download URL available.');
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            contentClassName="bg-dark text-white"
        >
            <Modal.Header closeButton className="border-1">
                <Modal.Title>Media Info</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }} className="border-1">
                {loading ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                        <Spinner animation="border" variant="light" />
                    </div>
                ) : mediaInfo ? (
                    <div>
                        <p>
                            <strong>File Name: </strong>
                            {isEditingName ? (
                                <>
                                    <Form.Control
                                        type="text"
                                        value={newFileName}
                                        onChange={(e) => setNewFileName(e.target.value)}
                                        size="sm"
                                        className="d-inline-block w-auto"
                                    />
                                    <Button variant="success" size="sm" onClick={handleRename} className="ml-2">
                                        Save
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => {
                                        setIsEditingName(false);
                                        setNewFileName(mediaInfo.general.fileName);
                                    }} className="ml-2">
                                        Cancel
                                    </Button>
                                </>
                            ) : (userRole &&
                                <>
                                    {mediaInfo.general.fileName}{' '}
                                    <Button variant="link" size="sm" onClick={() => setIsEditingName(true)} className="text-white p-0">
                                        Rename
                                    </Button>
                                </>
                            )}
                        </p>
                        <p><strong>File Size: </strong>{mediaInfo.general.fileSize}</p>
                        <p><strong>Duration: </strong>{mediaInfo.general.duration} sec</p>
                        <p><strong>Overall Bitrate: </strong>{mediaInfo.general.overallBitrate}</p>

                        <hr />

                        <h5 className='text-danger'>Video</h5>
                        <p><strong>Resolution: </strong>{mediaInfo.video.resolution}</p>
                        <p><strong>Format: </strong>{mediaInfo.video.format}</p>
                        <p><strong>HDR Details: </strong>{mediaInfo.video.hdrDetails ? 'Yes' : 'No'}</p>
                        <p><strong>Size: </strong>{mediaInfo.video.size}</p>

                        <hr />

                        <h5 className='text-danger'>Audio</h5>
                        {mediaInfo.audio && mediaInfo.audio.length > 0 ? (
                            mediaInfo.audio.map((audio, index) => (
                                <div key={index}>
                                    {audio.language && <p><strong>Language:</strong> {audio.language}</p>}
                                    <p><strong>Format: </strong>{audio.format}</p>
                                    <p><strong>Size: </strong>{audio.size}</p>
                                    <p><strong>Channel Info: </strong>{audio.channelInfo}</p>
                                    {index !== mediaInfo.audio.length - 1 && <hr className='w-50' />}
                                </div>
                            ))
                        ) : (
                            <p>No audio info available.</p>
                        )}

                        {mediaInfo.subtitle && mediaInfo.subtitle.length > 0 && (
                            <>
                                <hr />
                                <h5 className='text-danger'>Subtitles</h5>
                                {mediaInfo.subtitle.map((sub, index) => (
                                    <div key={index}>
                                        {sub.format && <p><strong>Format:</strong> {sub.format}</p>}
                                        {sub.language && <p><strong>Language:</strong> {sub.language}</p>}
                                        {sub.size && <p><strong>Size:</strong> {sub.size}</p>}
                                        {index !== mediaInfo.subtitle.length - 1 && <hr className='w-50' />}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                ) : (
                    <p>Error loading media info.</p>
                )}
            </Modal.Body>
            <Modal.Footer className="border-1">
                {
                    userRole &&
                    <Button variant="danger" onClick={handleDelete}>
                        Delete File
                    </Button>
                }

                <Button variant="outline-light" onClick={handleCopy}>
                    <FaCopy className="mr-1" /> Copy URL
                </Button>
                <Button variant="outline-light" onClick={handleDownload}>
                    <FaDownload className="mr-1" /> Download
                </Button>
            </Modal.Footer>
            {Constants.TOAST_CONTAINER}
        </Modal>
    );
}

export default FileDetailsModal;
