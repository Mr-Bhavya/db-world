import React, { useEffect, useState } from 'react';
import {
    Container, Row, Col, Card, Button, Dropdown, Form, InputGroup, Modal
} from 'react-bootstrap';
import {
    FaFolder, FaFile, FaEllipsisV, FaSearch, FaArrowLeft, FaArrowsAlt, FaCopy, FaTrash, FaTimes
} from 'react-icons/fa';
import { deleteFileApi, getStreamMediaList, moveFileApi, renameFileApi } from '../../ApiServices';
import LoadingSpinner from '../../LoadingSpinner';
import DestinationPicker from './DestinationPicker';
import { toast } from 'react-toastify';
import Constants from '../../Constants';
import CommonServices from '../../CommonServices';

const FileExplorer = () => {
    // File Explorer states
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState('/');
    const [selectedFiles, setSelectedFiles] = useState([]); // multi-selection
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name'); // 'name', 'folders-first', 'files-first'
    const [loading, setLoading] = useState(false);

    const [selectedFile, setSelectedFile] = useState(null);

    // Rename Modal
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameFile, setRenameFile] = useState(null);
    const [renameText, setRenameText] = useState(null);

    // Delete Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteFile, setDeleteFile] = useState(null);

    // Info Modal
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [infoFile, setInfoFile] = useState(null);
    // const [renameText, setRenameText] = useState(null);

    // Move Modal states (for multi or single move)
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveTargets, setMoveTargets] = useState([]); // array of files/folders to move
    const [moveDestPath, setMoveDestPath] = useState('/');

    // Copy Modal states (for multi or single copy)
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copyTargets, setCopyTargets] = useState([]); // array of files/folders to copy
    const [copyDestPath, setCopyDestPath] = useState('/');

    // Fetch files for current path
    const fetchFiles = async (path) => {
        setLoading(true);
        try {
            const response = await getStreamMediaList(encodeURIComponent(path));
            if (response.httpStatusCode === 200) {
                setFiles(response.data);
            }
        } catch (error) {
            console.error('Error fetching files:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchFiles(currentPath);
        setSelectedFiles([]); // clear multi selection when navigating
    }, [currentPath]);

    // Navigation & Selection
    const handleDoubleClick = (file) => {
        if (file.isDirectory) {
            setCurrentPath(file.filePath);
        }
    };

    const handleToggleSelect = (file) => {
        setSelectedFiles((prev) => {
            if (prev.find((f) => f.filePath === file.filePath)) {
                return prev.filter((f) => f.filePath !== file.filePath);
            } else {
                return [...prev, file];
            }
        });
    };

    // Prevent dropdown click from toggling selection
    const handleDropdownClick = (e, file) => {
        setSelectedFile(file);
    };

    // Filter and sort files based on search term and sort criteria
    const getFilteredAndSortedFiles = () => {
        let filtered = files.filter((file) =>
            file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (sortBy === 'name') {
            filtered.sort((a, b) => a.fileName.localeCompare(b.fileName));
        } else if (sortBy === 'date') {
            filtered.sort((a, b) => new Date(b.lastModifiedTime) - new Date(a.lastModifiedTime));
        } else if (sortBy === 'folders-first') {
            filtered.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.fileName.localeCompare(b.fileName);
            });
        } else if (sortBy === 'files-first') {
            filtered.sort((a, b) => {
                if (!a.isDirectory && b.isDirectory) return -1;
                if (a.isDirectory && !b.isDirectory) return 1;
                return a.fileName.localeCompare(b.fileName);
            });
        }
        return filtered;
    };

    const filteredFiles = getFilteredAndSortedFiles();

    // Navigate back to parent folder
    const handleBack = () => {
        if (currentPath === '/' || currentPath === '') return;
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        const newPath = '/' + parts.join('/');
        setCurrentPath(newPath === '' ? '/' : newPath);
    };

    // Open Move/Copy modals
    const openMoveModal = (file = null) => {
        if (file) {
            // For individual file action, override multi-selection
            setMoveTargets([file]);
        } else {
            setMoveTargets(selectedFiles);
        }
        setMoveDestPath(currentPath);
        setShowMoveModal(true);
    };

    const openCopyModal = (file = null) => {
        if (file) {
            setCopyTargets([file]);
        } else {
            setCopyTargets(selectedFiles);
        }
        setCopyDestPath(currentPath);
        setShowCopyModal(true);
    };

    const openRenameModal = (file = null) => {
        setRenameFile(file);
        setRenameText(file?.fileName)
        setShowRenameModal(true);
    };

    const openDeleteModal = (file = null) => {
        setDeleteFile(file);
        setShowDeleteModal(true);
    };

    const openInfoModal = (file = null) => {
        setInfoFile(file);
        setShowInfoModal(true);
    };

    // Multi-selection action handlers
    const handleMultiDelete = async () => {
        console.log('Deleting selected items:', selectedFiles.map((f) => f.fileName));
        setSelectedFiles([]);
        fetchFiles(currentPath);
    };

    const handleRenameSubmit = async () => {
        let renameRes = await renameFileApi(renameFile.id, { newName: renameText });
        if (renameRes.httpStatusCode === 200) {
            toast.success(renameRes.message)
            fetchFiles(currentPath);
        } else {
            toast.error(renameRes.message || renameRes.errorMessage)
        }
        setShowRenameModal(false);
        setRenameText(null);
        setRenameFile([]);
    };

    const handleMoveSubmit = async () => {
        console.log('Moving:', moveTargets.map((f) => f.fileName), 'to', moveDestPath);
        let renameRes = await moveFileApi(moveTargets[0].id, { newDirectory: moveDestPath });
        if (renameRes.httpStatusCode === 200) {
            toast.success(renameRes.message)
            fetchFiles(currentPath);
        } else {
            toast.error(renameRes.message || renameRes.errorMessage)
        }
        setShowMoveModal(false);
        setSelectedFiles([]);
        fetchFiles(currentPath);
    };

    const handleCopySubmit = async () => {
        console.log('Copying:', copyTargets.map((f) => f.fileName), 'to', copyDestPath);
        // TODO: API call to copy the selected files/folders
        setShowCopyModal(false);
        setSelectedFiles([]);
        fetchFiles(currentPath);
    };

    const handleDeleteSubmit = async () => {
        let deleteRes = await deleteFileApi(deleteFile.id);
        if (deleteRes.httpStatusCode === 200) {
            setShowDeleteModal(false);
            toast.success(deleteRes.message);
            fetchFiles(currentPath);
        } else {
            toast.error(deleteRes.message || deleteRes.errorMessage)
        }
        setShowCopyModal(false);
        setSelectedFiles([]);
        fetchFiles(currentPath);
    };

    return (
        <Container fluid className="p-1">
            <Row className="mb-3 align-items-center">
                <Col xs="auto">
                    {currentPath !== '/' && (
                        <Button size='sm' variant="outline-dark" onClick={handleBack}>
                            <FaArrowLeft />
                        </Button>
                    )}
                </Col>
                <Col xs={12} md={4}>
                    <InputGroup>
                        <InputGroup.Text>
                            <FaSearch />
                        </InputGroup.Text>
                        <Form.Control
                            placeholder="Search files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col xs="auto" className="m-3">
                    <Dropdown>
                        <Dropdown.Toggle variant="secondary">
                            Sort: {sortBy}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item onClick={() => setSortBy('name')}>Name</Dropdown.Item>
                            <Dropdown.Item onClick={() => setSortBy('date')}>Date</Dropdown.Item>
                            <Dropdown.Item onClick={() => setSortBy('folders-first')}>Folders First</Dropdown.Item>
                            <Dropdown.Item onClick={() => setSortBy('files-first')}>Files First</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Col>
            </Row>

            {/* Floating multi-selection action panel */}
            {selectedFiles.length > 0 && (
                <div
                    style={{
                        position: 'fixed', right: '10px', top: '50%', transform: 'translateY(-50%)', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '8px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px'
                    }}
                >
                    <FaArrowsAlt
                        onClick={() => openMoveModal()}
                        style={{ cursor: 'pointer' }}
                        title="Move Selected"
                    />
                    <FaCopy
                        onClick={() => openCopyModal()}
                        style={{ cursor: 'pointer' }}
                        title="Copy Selected"
                    />
                    <FaTrash
                        onClick={handleMultiDelete}
                        style={{ cursor: 'pointer' }}
                        title="Delete Selected"
                    />
                    <FaTimes
                        onClick={() => setSelectedFiles([])}
                        style={{ cursor: 'pointer' }}
                        title="Clear Selection"
                    />
                </div>
            )}

            {loading ? (
                <LoadingSpinner />
            ) : (
                <Row>
                    {filteredFiles.map((file) => {
                        const isSelected = selectedFiles.find((f) => f?.filePath === file?.filePath);
                        return (
                            <Col xs={6} sm={6} md={4} lg={3} key={file.filePath} className="mb-3 p-1">
                                <Card
                                    className={`h-100 p-2 d-flex align-items-center justify-content-between flex-row user-select-none ${isSelected ? 'border border-primary' : ''}`}
                                    onDoubleClick={() => handleDoubleClick(file)}
                                >
                                    <div
                                        className="d-flex align-items-center"
                                        style={{
                                            width: '80%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {file?.isDirectory ? (
                                            <FaFolder size={24} className="me-2" style={{ width: '2rem', minWidth: '2rem', cursor: "pointer" }} onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleSelect(file);
                                            }} />
                                        ) : (
                                            <FaFile size={24} className="me-2" style={{ width: '2rem', minWidth: '2rem', cursor: "pointer" }} onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleSelect(file);
                                            }} />
                                        )}
                                        <Card.Title
                                            className="m-0"
                                            style={{
                                                fontSize: '14px', flexGrow: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                                            }}
                                        >
                                            {file?.fileName}
                                        </Card.Title>
                                    </div>
                                    <Dropdown
                                        onClick={(e) => handleDropdownClick(e, file)}>
                                        <Dropdown.Toggle
                                            variant="link"
                                            bsPrefix="p-0 my-1 border-0"
                                            style={{ color: 'black' }}
                                        >
                                            <FaEllipsisV />
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu>
                                            <Dropdown.Item onClick={(e) => { e.stopPropagation(); openRenameModal(file) }}>Rename</Dropdown.Item>
                                            <Dropdown.Item onClick={(e) => { e.stopPropagation(); openMoveModal(file); }}>Move</Dropdown.Item>
                                            <Dropdown.Item onClick={(e) => { e.stopPropagation(); openCopyModal(file); }}>Copy</Dropdown.Item>
                                            <Dropdown.Item onClick={(e) => { e.stopPropagation(); openDeleteModal(file); }} >Delete</Dropdown.Item>
                                            <Dropdown.Item onClick={(e) => { e.stopPropagation(); openInfoModal(file); }}>More Info</Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}

            {/* Rename */}
            <Modal show={showRenameModal} onHide={() => setShowRenameModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title className='text-dark'>Rename</Modal.Title>
                </Modal.Header>
                <Modal.Body className='text-dark'>
                    <p><strong>Original Name: </strong>{renameFile?.fileName}</p>
                    <p><strong>New Name: </strong>{renameText}</p>
                    <input type='text' className='w-100' value={renameText} onChange={(e) => setRenameText(e.target.value)} />
                </Modal.Body>
                <Modal.Footer>
                    <Button size='sm' variant="secondary" onClick={() => setShowRenameModal(false)}>Cancel</Button>
                    <Button size='sm' variant="danger" onClick={handleRenameSubmit}>Submit</Button>
                </Modal.Footer>
            </Modal>

            {/* Move Modal with Destination Picker */}
            <Modal show={showMoveModal} onHide={() => setShowMoveModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Move File/Folder</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <DestinationPicker destPath={moveDestPath} setDestPath={setMoveDestPath} />
                </Modal.Body>
                <Modal.Footer>
                    <Button size='sm' variant="secondary" onClick={() => setShowMoveModal(false)}>Cancel</Button>
                    <Button size='sm' variant="primary" onClick={handleMoveSubmit}>Move</Button>
                </Modal.Footer>
            </Modal>

            {/* Copy Modal with Destination Picker */}
            <Modal show={showCopyModal} onHide={() => setShowCopyModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Copy File/Folder</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <DestinationPicker destPath={copyDestPath} setDestPath={setCopyDestPath} />
                </Modal.Body>
                <Modal.Footer>
                    <Button size='sm' variant="secondary" onClick={() => setShowCopyModal(false)}>Cancel</Button>
                    <Button size='sm' variant="primary" onClick={handleCopySubmit}>Copy</Button>
                </Modal.Footer>
            </Modal>

            {/* Copy Modal with Destination Picker */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title className='text-dark'>Delete Confirmation</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className='text-dark'><strong>Do you want to really delete below mentioed file ?</strong></p>
                    <p className='text-dark'><strong>File Name: </strong>{deleteFile?.fileName}</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button size='sm' variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                    <Button size='sm' variant="danger" onClick={handleDeleteSubmit}>Delete</Button>
                </Modal.Footer>
            </Modal>

            {/* Info Modal with Destination Picker */}
            <Modal show={showInfoModal} onHide={() => setShowInfoModal(false)} size="sm"
                aria-labelledby="contained-modal-title-vcenter"
                centered >
                <Modal.Header closeButton>
                    <Modal.Title className='text-dark'>Info</Modal.Title>
                </Modal.Header>
                <Modal.Body className='text-dark' style={{ maxHeight: "20rem", overflow: "auto" }}>
                    <p><strong>File Name: </strong> {infoFile?.fileName} </p>
                    <p><strong>File Path: </strong> {infoFile?.filePath} </p>
                    <p><strong>Is directory: </strong> {infoFile?.isDirectory == true ? 'Yes' : 'NO'} </p>
                    <p><strong>File Size: </strong> {CommonServices.bytesToReadbleFormat(infoFile?.fileSize).value + " " + CommonServices.bytesToReadbleFormat(infoFile?.fileSize).suffix} </p>
                    <p><strong>Parent Folder: </strong> {infoFile?.parentFolder} </p>
                    <p><strong>Creation Date: </strong> {infoFile?.creationDate} </p>
                    <p><strong>Last Modified Time:  </strong> {infoFile?.lastModifiedTime} </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button size='sm' variant="secondary" onClick={() => setShowInfoModal(false)}>close</Button>
                </Modal.Footer>
            </Modal>

            {Constants.TOAST_CONTAINER}
        </Container>
    );
};

export default FileExplorer;
