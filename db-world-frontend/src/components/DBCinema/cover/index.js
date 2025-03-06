import axios from '../services/axios';
import React, { useEffect, useState } from 'react';
import './cover.css';
import requests from '../services/requests';
import Constants from '../../Constants';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';

function Cover({ recordCount = 5 }) {
  const [records, setRecords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Holds the current transition class (for slide animations)
  const [transitionClass, setTransitionClass] = useState('');
  // Used to prevent overlapping animations
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCoverMovies() {
      try {
        const response = await axios.get(requests.fetchCoverRecord, {
          headers: { Authorization: 'Bearer ' + localStorage.getItem("token") },
          params: { pageSize: recordCount }
        });
        const recordsData = response.data.data.records.map(record => {
          record.tmdb = record.type === Constants.RECORD_TYPE_MOVIE ? record.movieTmdb : record.seriesTmdb;
          return record;
        });
        setRecords(recordsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching cover movies:", error);
        setLoading(false);
      }
    }
    fetchCoverMovies();
  }, [recordCount]);

  const animationDuration = 500; // Must match the CSS animation duration

  const handleNext = () => {
    if (records.length === 0 || animating) return;
    setAnimating(true);
    // Slide out to left
    setTransitionClass('slide-out-left');
    setTimeout(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % records.length);
      // Slide in from right
      setTransitionClass('slide-in-right');
      setTimeout(() => {
        setTransitionClass('');
        setAnimating(false);
      }, animationDuration);
    }, animationDuration);
  };

  const handlePrev = () => {
    if (records.length === 0 || animating) return;
    setAnimating(true);
    // Slide out to right
    setTransitionClass('slide-out-right');
    setTimeout(() => {
      setCurrentIndex(prevIndex => (prevIndex - 1 + records.length) % records.length);
      // Slide in from left
      setTransitionClass('slide-in-left');
      setTimeout(() => {
        setTransitionClass('');
        setAnimating(false);
      }, animationDuration);
    }, animationDuration);
  };

  // Auto-cycle using slide transition
  useEffect(() => {
    if (records.length === 0) return;
    const interval = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [records, animating]);

  // Setup swipe handlers (trackMouse allows desktop click-drag swiping)
  const handlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrev(),
    trackMouse: true,
  });

  if (loading) return <CoverSkeleton />;

  const record = records[currentIndex];
  if (!record) return null;

  return (
    <div {...handlers} className="cover-container">
      <div
        className={`cover-main ${transitionClass}`}
        style={{
          backgroundSize: 'cover',
          backgroundImage: `url("https://image.tmdb.org/t/p/original/${record?.tmdb?.backdrop_path || record?.tmdb?.poster_path}")`,
          backgroundPosition: "center center"
        }}
      >
        <div className='cover-contents'>
          <h1 className='movie-title'>
            {record?.tmdb?.title || record?.tmdb?.name || record?.tmdb?.original_name}
          </h1>
          <h3 className='movie-overview'>
            {record?.tmdb?.overview && record.tmdb.overview.length > 200
              ? record.tmdb.overview.substring(0, 200) + '...'
              : record?.tmdb?.overview}
          </h3>
          <div style={{ paddingTop: 8 }}>
            <button
              className='btn-play'
              onClick={() =>
                navigate(
                  `${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(":recordId", record.recordId)}`,
                  { state: { movie: record, userRole: "" } }
                )
              }
            >
              <i className="fa fa-download"></i> Download
            </button>
            <button
              className='btn-more'
              onClick={() =>
                navigate(
                  record.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE
                    ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(
                        ":title",
                        record.recordId + "-" + record.name.toLowerCase().replace(/ /g, "-")
                      )
                    : Constants.DB_SERIES_DETIALS_ROUTE.replace(
                        ":title",
                        record.recordId + "-" + record.name.toLowerCase().replace(/ /g, "-")
                      )
                )
              }
            >
              <i className="fa fa-info-circle"></i> More Info
            </button>
          </div>
        </div>
      </div>

      {/* Navigation buttons for desktop */}
      <div className="cover-controls">
        <button className="cover-prev" onClick={handlePrev}>◀</button>
        <button className="cover-next" onClick={handleNext}>▶</button>
      </div>

      {/* Faded cover effect */}
      <div className='faded-bottom'></div>
    </div>
  );
}

function CoverSkeleton() {
  return (
    <div className="cover-skeleton">
      <div className="cover-skeleton-image"></div>
      <div className="cover-skeleton-contents">
        <div className="cover-skeleton-title skeleton"></div>
        <div className="cover-skeleton-overview skeleton"></div>
        <div className="cover-skeleton-buttons">
          <div className="skeleton btn-skeleton"></div>
          <div className="skeleton btn-skeleton"></div>
        </div>
      </div>
    </div>
  );
}

export default Cover;
