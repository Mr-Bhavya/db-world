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
    function MediaCard({ media }) {
        const [expanded, setExpanded] = useState(false);

        return (
            <div className="media-card">
                <div
                    className="media-card-header"
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    <p className="media-filename">{media.general.fileName}</p>
                    <button className="toggle-btn">
                        {expanded ? (
                            <i className="fas fa-chevron-up"></i>
                        ) : (
                            <i className="fas fa-chevron-down"></i>
                        )}
                    </button>
                </div>
                <div className={`media-card-body ${expanded ? "expanded" : ""}`}>
                    <div className="general-info">
                        <p>
                            <strong>File Size:</strong> {media.general.fileSize}
                        </p>
                        <p>
                            <strong>Duration:</strong> {Math.floor(media.general.duration / 60)} minutes
                        </p>
                        <p>
                            <strong>Overall Bitrate:</strong> {media.general.overallBitrate}
                        </p>
                    </div>
                    <hr />
                    <div className="video-info">
                        <h4>Video</h4>
                        <p>
                            <strong>Resolution:</strong> {media.video.resolution}
                        </p>
                        <p>
                            <strong>Format:</strong> {media.video.format}
                        </p>
                        <p>
                            <strong>Size:</strong> {media.video.size}
                        </p>
                    </div>
                    <hr />
                    {media.audio && media.audio.length > 0 && (
                        <div className="audio-info">
                            <h4>Audio</h4>
                            {media.audio.map((audio, idx) => (
                                <div key={idx}>
                                    <p>
                                        <strong>Language:</strong> {audio.language ? audio.language : "N/A"}
                                    </p>
                                    <p>
                                        <strong>Format:</strong> {audio.format}
                                    </p>
                                    <p>
                                        <strong>Size:</strong> {audio.size}
                                    </p>
                                    <p>
                                        <strong>Channels:</strong> {audio.channelInfo}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                    <hr />
                    {media.subtitle && media.subtitle.length > 0 && (
                        <div className="subtitle-info">
                            <h4>Subtitles</h4>
                            {media.subtitle.map((sub, idx) => (
                                <div key={idx}>
                                    <p>
                                        <strong>Language:</strong> {sub.language}
                                    </p>
                                    <p>
                                        <strong>Format:</strong> {sub.format}
                                    </p>
                                    <p>
                                        <strong>Size:</strong> {sub.size}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <Card.Footer className="d-flex justify-content-end align-items-center p-2">
                    {(userRole === Constants.ADMIN_USER_ROLE ||
                        userRole === Constants.OWNER_USER_ROLE) && (
                            <Button
                                size="sm"
                                variant="danger"
                                className="btn-sm me-2"
                                onClick={() => handelMediaFileInfoDelete(media.id)}
                            >
                                <i className="fas fa-trash-alt"></i> Delete
                            </Button>
                        )}
                    <div>
                        <Copy text={media.downloadUrl} />
                        <Button
                            size="sm"
                            variant="outline-success"
                            className="btn-sm"
                            as="a"
                            href={media.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={()=>CommonServices.handleDownload(media.downloadUrl)}
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
                        <MediaCard key={movieItem.id} media={movieItem} />
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
                                    <MediaCard key={ep.id} media={ep} />
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
