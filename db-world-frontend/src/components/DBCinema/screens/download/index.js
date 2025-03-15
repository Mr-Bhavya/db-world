import React, { useState, useEffect } from "react";
import "./index.css";
import { Button, Card, Col, Container, Row } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { deleteMediaFileInfoById, loadStreamFileInfoByRecordId } from "../../../ApiServices";
import LoadingSpinner from "../../../LoadingSpinner";
import Constants from "../../../Constants";
import CommonServices from "../../../CommonServices";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import Copy from "../../icons/copy";

const DownloadPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // Expecting movie and userRole via location.state
    const { movie, userRole } = location.state || {};

    const [mediaFileList, setMediaFileList] = useState([]);
    const [mediaListLoader, setMediaListLoader] = useState(false);
    const [copiedMediaId, setCopiedMediaId] = useState(null);

    // Load media files using the record ID
    const loadMediaFiles = async () => {
        setMediaListLoader(true);
        const response = await loadStreamFileInfoByRecordId(movie.recordId);
        if (response.httpStatusCode === 200) {
            const formattedFiles = CommonServices.convertMediaInfoToCustomFormat(response.data);
            // formattedFiles.forEach((file) => {
            //     file.downloadUrl = "";
            //     file.streamUrl = "";
            // });
            // console.log(formattedFiles)
            setMediaFileList(formattedFiles);
        }
        setMediaListLoader(false);
    };

    useEffect(() => {
        if (movie && movie.recordId) {
            loadMediaFiles();
        } else {
            navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handelMediaFileInfoDelete = async (mediaFileId) => {
        const response = await deleteMediaFileInfoById(mediaFileId);
        if (response.httpStatusCode === 200) {
            toast.success(response.message);
            loadMediaFiles();
        } else {
            toast.error(response.message || response.errorMessages);
        }
    };

    const handleCopyURL = (url, mediaFileId) => {
        CommonServices.handleCopy(url)
        setCopiedMediaId(mediaFileId);
        toast.success("Download URL copied to clipboard");
        setTimeout(() => {
            setCopiedMediaId(null);
        }, 2000);
    };

    // const handleDownload = async (url) => {
    //     if (Capacitor.isNativePlatform()) {
    //         Browser.open(url)
    //     } else {
    //         window.open(url);
    //     }
    // }

    // --- REUSABLE CARD COMPONENT ---
    function MediaCard({ mediaInfo }) {
        const [expanded, setExpanded] = useState(false);

        return (
            <div className="media-card">
                <div
                    className="media-card-header"
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    <p className="media-filename">{mediaInfo.general.fileName}</p>
                    <button className="toggle-btn">
                        {expanded ? (
                            <i className="fas fa-chevron-up"></i>
                        ) : (
                            <i className="fas fa-chevron-down"></i>
                        )}
                    </button>
                </div>
                <div className="mx-3 media-card-content" style={{ display: expanded ? "block" : "none" }}>
                    <p><strong>File Size: </strong>{mediaInfo.general.fileSize}</p>
                    <p><strong>Duration: </strong>{mediaInfo.general.duration} sec</p>
                    <p><strong>Overall Bitrate: </strong>{mediaInfo.general.overallBitrate}</p>

                    <hr />

                    <h5 className='text-danger'>Video</h5>
                    <p><strong>Resolution: </strong>{mediaInfo.video.resolution}</p>
                    <p><strong>Format: </strong>{mediaInfo.video.format}</p>
                    <p><strong>HDR Details: </strong>{mediaInfo.video.hdrDetails ? mediaInfo.video.hdrDetails : 'No'}</p>
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
                <Card.Footer className="d-flex justify-content-end align-items-center p-2">
                    <div>
                        <Copy text={mediaInfo.downloadUrl} />
                        <Button
                            size="sm"
                            variant="outline-success"
                            className="btn-sm"
                            as="a"
                            href={mediaInfo.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => CommonServices.handleDownload(mediaInfo.downloadUrl)}
                        >
                            <i className="fas fa-download"></i> Download
                        </Button>
                    </div>
                </Card.Footer>
            </div>
        );
    }

    // --- MOVIES SECTION ---
    function MoviesSection() {
        return (
            <div className="movies-section">
                <div className="cards-container">
                    {mediaFileList.map((movieItem) => (
                        <MediaCard key={movieItem.id} mediaInfo={movieItem} />
                    ))}
                </div>
            </div>
        );
    }

    // --- SERIES SECTION (Grouped by Season) ---
    function SeriesSection() {
        // Group episodes by season using regex to extract season (e.g., S03)
        const groupedEpisodes = mediaFileList.reduce((acc, episode) => {
            const { fileName } = episode.general;
            const seasonMatch = fileName.match(/S(\d{2})/i);
            const season = seasonMatch ? seasonMatch[1] : "Unknown";
            if (!acc[season]) acc[season] = [];
            acc[season].push(episode);
            return acc;
        }, {});

        return (
            <div className="series-section">
                {Object.keys(groupedEpisodes)
                    .sort()
                    .map((season) => (
                        <div key={season} className="season-group">
                            <h3>Season {parseInt(season, 10)}</h3>
                            <div className="cards-container">
                                {groupedEpisodes[season].map((ep) => (
                                    <MediaCard key={ep.id} mediaInfo={ep} />
                                ))}
                            </div>
                        </div>
                    ))}
            </div>
        );
    }

    return !movie ? (
        <LoadingSpinner />
    ) : (
        <div className="download-page">
            <Container fluid className="p-3">
                {/* Back Button */}
                <Button variant="outline-light" onClick={() => navigate(-1)} className="mb-3">
                    <i className="fas fa-arrow-left me-2"></i> Back
                </Button>
                {/* Header: Movie Image and Details */}
                <Row className="align-items-center mb-4">
                    <Col xs={12} md={3} className="text-center">
                        <img
                            src={`https://image.tmdb.org/t/p/w300${movie?.tmdb?.poster_path || movie?.tmdb?.backdrop_path}`}
                            alt={movie.title}
                            className="img-fluid rounded"
                            style={{ maxWidth: "200px" }}
                        />
                    </Col>
                    <Col xs={12} md={9} className="text-light">
                        <h2 className="movie-title">{movie?.tmdb?.title}</h2>
                        {movie?.tmdb?.release_date && (
                            <p>
                                <strong>Release:</strong> {movie?.tmdb?.release_date}
                            </p>
                        )}
                        {movie?.tmdb?.overview && <p>{movie?.tmdb?.overview}</p>}
                    </Col>
                </Row>
                {/* Media File List Content */}
                <div className="media-content">
                    <h3 className="section-title">Downloadable Files:</h3>
                    {mediaListLoader ? (
                        <LoadingSpinner />
                    ) : mediaFileList.length === 0 ? (
                        <div className="d-flex justify-content-center align-items-center vh-50">
                            <div className="alert alert-danger text-center" role="alert">
                                No media available to download for this record
                            </div>
                        </div>
                    ) : movie.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE.toLowerCase() ? (
                        <MoviesSection />
                    ) : (
                        <SeriesSection />
                    )}
                </div>
            </Container>
            {Constants.TOAST_CONTAINER}
        </div>
    );
};

export default DownloadPage;
