import React, { useState, useEffect } from "react";
import "./index.css";
import { Button, Card, Col, Container, Row } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { loadStreamFileInfoByRecordId } from "../../../ApiServices";
import LoadingSpinner from "../../../LoadingSpinner";
import Constants from "../../../Constants";
import CommonServices from "../../../CommonServices";
import { Capacitor } from '@capacitor/core';
import Copy from "../../icons/copy";
import AndroidPlugins from "../../../../android-app-components/AndroidPlugins";
import DownloadButton from "./DownloadButton";
import MediaCard from "./MediaCard";

const DownloadPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Expecting movie via location.state
  const { movie } = location.state || {};

  const [mediaFileList, setMediaFileList] = useState([]);
  const [mediaListLoader, setMediaListLoader] = useState(false);

  const [showPlayer, setShowPlayer] = useState(false)

  // Load media files using the record ID
  const loadMediaFiles = async () => {
    setMediaListLoader(true);
    const response = await loadStreamFileInfoByRecordId(movie.recordId);
    if (response.httpStatusCode === 200) {
      const formattedFiles = CommonServices.convertMediaInfoToCustomFormat(response.data);
      // console.log("Formatted Files: ", formattedFiles);
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

  // --- MOVIES SECTION ---
  function MoviesSection() {
    return (
      <MediaCard mediaFileList={mediaFileList} type="movie" />
    )
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
      <MediaCard mediaFileList={mediaFileList} type="series" />
    );
  }

  return !movie ? (
    <LoadingSpinner />
  ) : (
    <div className="download-page">
      <Container fluid className="p-3">
        {/* Back Button */}
        <Button
          variant="outline-light"
          onClick={() => navigate(-1)}
          className="mb-3"
        >
          <i className="fas fa-arrow-left me-2"></i> Back
        </Button>
        {/* Header: Movie Image and Details */}
        <Row className="align-items-center mb-4">
          <Col xs={12} md={3} className="text-center">
            <img
              src={`https://image.tmdb.org/t/p/w300${movie?.tmdb?.poster_path || movie?.tmdb?.backdrop_path
                }`}
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
          ) : movie.type.toLowerCase() ===
            Constants.RECORD_TYPE_MOVIE.toLowerCase() ? (
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