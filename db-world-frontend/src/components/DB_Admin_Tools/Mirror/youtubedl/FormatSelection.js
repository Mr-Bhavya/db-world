import React, { useState, useEffect } from 'react';
import { Button, Tab, Tabs } from 'react-bootstrap';
import { ChevronDown, ChevronUp } from 'react-bootstrap-icons'; // Import icons from Bootstrap Icons

const FormatSelection = ({ formats, onHandleSubmit }) => {
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [selectedAudio, setSelectedAudio] = useState(null);
    const [activeTab, setActiveTab] = useState('video');
    const [expandedGroups, setExpandedGroups] = useState({
        video: {},
        audio: {}
    });

    const handleVideoSelection = (format) => {
        setSelectedVideo(format);
    };

    const handleAudioSelection = (format) => {
        setSelectedAudio(format);
    };

    const handleGroupToggle = (type, key) => {
        setExpandedGroups((prevState) => ({
            ...prevState,
            [type]: {
                ...prevState[type],
                [key]: !prevState[type][key]
            }
        }));
    };

    // Group video formats by resolution
    const videoFormats = formats.filter((format) => format.video_ext !== 'none');
    const audioFormats = formats.filter((format) => format.video_ext === 'none');

    // Group video formats by resolution
    const groupedVideoFormats = videoFormats.reduce((groups, format) => {
        const resolution = format.resolution || 'N/A';
        if (!groups[resolution]) {
            groups[resolution] = [];
        }
        groups[resolution].push(format);
        return groups;
    }, {});

    const handleSubmit = async () => {
        if (!selectedVideo) {
            alert('You must select a video format!');
            return;
        }
        console.log(selectedVideo, selectedAudio);
        // Here you can process the selected formats
        const dataToSubmit = {
            video: selectedVideo?.format_id,
            audio: selectedAudio?.format_id || null
        };
        onHandleSubmit(selectedVideo?.format_id, selectedAudio?.format_id || null);
    };

    return (
        <div className="format-selection-container my-3">
            <h3>Select Video/Audio Quality</h3>

            <Tabs
                defaultActiveKey="video"
                id="uncontrolled-tab-example"
                className="mb-3"
                activeKey={activeTab}
                onSelect={(key) => setActiveTab(key)}
            >
                <Tab eventKey="video" title="Video Quality">
                    <div className="formats-section" id='video'>
                        <h4 className="bg-primary text-white p-2 rounded">Select Video Format (Mandatory)</h4>
                        {Object.entries(groupedVideoFormats).map(([resolution, formats]) => (
                            <div key={resolution}>
                                <div
                                    className="group-header d-flex justify-content-between align-items-center p-2 mt-2 bg-light rounded"
                                    onClick={() => handleGroupToggle('video', resolution)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <h5 className="m-0">{resolution} Resolution</h5>
                                    <Button variant="link" className="p-0">
                                        {expandedGroups.video[resolution] ? <ChevronUp /> : <ChevronDown />}
                                    </Button>
                                </div>
                                {expandedGroups.video[resolution] && (
                                    <div className="row mt-3">
                                        {formats.map((format, index) => (
                                            <div key={index} className="col-12 col-md-4 mb-3">
                                                <div
                                                    className={`format-item p-3 border rounded ${selectedVideo === format ? 'bg-dark text-white' : 'bg-light'
                                                        }`}
                                                    onClick={() => handleVideoSelection(format)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <h6>{format.format_note}</h6>
                                                    <p><strong>Codec:</strong> {format.vcodec}</p>
                                                    <p><strong>File Size:</strong> {(format.filesize / (1024 * 1024)).toFixed(2)} MB</p>
                                                    <p><strong>Quality:</strong> {format.quality}</p>
                                                    <Button
                                                        variant={selectedVideo === format ? 'outline-light' : 'outline-primary'}
                                                        className="w-100"
                                                    >
                                                        {selectedVideo === format ? 'Selected' : 'Select'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Tab>
                <Tab eventKey="audio" title="Audio Quality">
                    <div className="formats-section" id="audio">
                        <h4 className="bg-primary text-white p-2 rounded">Select Audio Format (Optional)</h4>
                        <div className="row mt-3">
                            {audioFormats.map((format, index) => (
                                <div key={index} className="col-12 col-md-4 mb-3">
                                    <div
                                        className={`format-item p-3 border rounded ${selectedAudio === format ? 'bg-primary text-white' : 'bg-light'
                                            }`}
                                        onClick={() => handleAudioSelection(format)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <h6>{format.format_note}</h6>
                                        <p><strong>Audio Codec:</strong> {format.acodec}</p>
                                        <p><strong>Bitrate:</strong> {format.abr} kbps</p>
                                        <p><strong>File Size:</strong> {(format.filesize / (1024 * 1024)).toFixed(2)} MB</p>
                                        <p><strong>Quality:</strong> {format.quality}</p>
                                        <Button
                                            variant={selectedAudio === format ? 'outline-light' : 'outline-primary'}
                                            className="w-100"
                                        >
                                            {selectedAudio === format ? 'Selected' : 'Select'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Tab>
            </Tabs>

            {/* Submit Button */}
            <div className="submit-container mt-3">
                <Button variant="success" onClick={handleSubmit} className="w-100">
                    Submit
                </Button>
            </div>

            {/* Selection Summary */}
            <div className="selection-summary mt-4">
                <h4>Selection Summary:</h4>
                <div className="row">
                    <div className="col-12 col-md-6 mb-3">
                        <div className="card">
                            <div className="card-header bg-info text-white">
                                <strong>Video Format</strong>
                            </div>
                            <div className="card-body">
                                {selectedVideo ? (
                                    <>
                                        <h5>{selectedVideo.format_note}</h5>
                                        <p><strong>Codec:</strong> {selectedVideo.vcodec}</p>
                                        <p><strong>File Size:</strong> {(selectedVideo.filesize / (1024 * 1024)).toFixed(2)} MB</p>
                                        <p><strong>Quality:</strong> {selectedVideo.quality}</p>
                                    </>
                                ) : (
                                    <p className="text-muted">Not Selected (Mandatory)</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-md-6 mb-3">
                        <div className="card">
                            <div className="card-header bg-warning text-dark">
                                <strong>Audio Format</strong>
                            </div>
                            <div className="card-body">
                                {selectedAudio ? (
                                    <>
                                        <h5>{selectedAudio.format_note}</h5>
                                        <p><strong>Audio Codec:</strong> {selectedAudio.acodec}</p>
                                        <p><strong>Bitrate:</strong> {selectedAudio.abr} kbps</p>
                                        <p><strong>File Size:</strong> {(selectedAudio.filesize / (1024 * 1024)).toFixed(2)} MB</p>
                                        <p><strong>Quality:</strong> {selectedAudio.quality}</p>
                                    </>
                                ) : (
                                    <p className="text-muted">Not Selected</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default FormatSelection;
