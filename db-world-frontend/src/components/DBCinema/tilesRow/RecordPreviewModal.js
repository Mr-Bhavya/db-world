import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import Constants from '../../Constants';
import Reaction from '../icons/reaction';
import Watchlist from '../icons/watchlist';
import Watched from '../icons/watched';

const RecordPreviewModal = ({ title, record, onClose, onUpdateRecord }) => {
  const tmdb = record?.tmdb;
  const navigate = useNavigate();
  const [showProviders, setShowProviders] = useState(false);

  // Extract providers from movieTmdb (assumes movieTmdb exists for movies)
  const providers = record.movieTmdb?.providers;
  const hasProviders =
    providers &&
    ((providers.flatrate && providers.flatrate.length > 0) ||
      (providers.buy && providers.buy.length > 0) ||
      (providers.rent && providers.rent.length > 0));

  // Inline styles for provider logos and sidebar title
  const sidebarTitleStyle = { fontSize: "1.25rem", fontWeight: "bold", color: "#fff" };
  const providerLogoStyle = { width: "50px", height: "auto" };

  // Callback functions for updates
  const handleReactionUpdate = (newData) => {
    onUpdateRecord({ ...record, ...newData });
  };

  const handleWatchlistWatchedUpdate = (newData) => {
    onUpdateRecord({ ...record, ...newData });
  };

  return (
    <div className="preview-modal-content">
      <button className="close-button" onClick={onClose} aria-label="Close">
        &times;
      </button>

      <div className="trailer-container">
        {(tmdb?.videos?.find(vid => vid.type === 'Trailer' && vid.official)?.key ||
          tmdb?.videos[0]?.key) ? (
          <YouTube
            videoId={
              tmdb?.videos?.find(vid => vid.type === 'Trailer' && vid.official)?.key ||
              tmdb?.videos[0]?.key
            }
            opts={{
              width: '100%',
              height: '200',
              playerVars: { autoplay: 1, mute: 0, controls: 0, rel: 0 }
            }}
          />
        ) : (
          <img
            src={`https://image.tmdb.org/t/p/w500${tmdb?.backdrop_path || tmdb?.poster_path}`}
            alt={tmdb.title}
            className="thumbnail horizontal"
            loading="lazy"
            style={{ width: "100%", height: "200px" }}
          />
        )}
      </div>

      <div className="content-wrapper">
        <h3 className="title mb-3">{tmdb.title || tmdb.name}</h3>

        {/* Button Row: Streaming on first then Download */}
        <div className="btn-group w-100 gap-1" role="group" aria-label="Default button group">
          {hasProviders && (
            <button
              type="button"
              className="btn btn-dark w-50"
              onClick={() => setShowProviders(!showProviders)}
            >
              <i className="fas fa-tv mx-2" /> Streaming on
            </button>
          )}
          <button
            type="button"
            className="btn btn-dark w-50"
            onClick={() =>
              navigate(
                `${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(":recordId", record.recordId)}`,
                { state: { movie: record, userRole: "" } }
              )
            }
          >
            <i className="fas fa-download mx-2" /> Download
          </button>
        </div>

        {/* Provider Information */}
        {hasProviders && showProviders && (
          <div className="mt-3">
            {providers.flatrate?.length > 0 && (
              <div className="d-flex align-items-center mx-1 my-3">
                <span className="text-light me-2">Streaming on</span>
                {providers.flatrate.map((provider) => (
                  <img
                    key={provider.provider_id}
                    src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                    alt={provider.provider_name}
                    style={providerLogoStyle}
                    className="me-2"
                  />
                ))}
              </div>
            )}
            {(providers.buy?.length > 0 || providers.rent?.length > 0) && (
              <div className="d-flex align-items-center mx-1 my-2">
                <span className="text-light me-2">Buy and Rent from</span>
                {providers.buy?.map((provider) => (
                  <img
                    key={provider.provider_id}
                    src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                    alt={provider.provider_name}
                    style={providerLogoStyle}
                    className="me-2"
                  />
                ))}
                {providers.rent?.map((provider) => (
                  <img
                    key={provider.provider_id}
                    src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                    alt={provider.provider_name}
                    style={providerLogoStyle}
                    className="me-2"
                  />
                ))}
              </div>
            )}
            <hr />
          </div>
        )}

        <div className="meta-info">
          <span>{tmdb.release_date?.split("-")?.[0] || tmdb.first_air_date?.split("-")?.[0]}</span>
          {tmdb?.runtime ? <span>&nbsp;|&nbsp;&nbsp;{tmdb.runtime} min</span> : ""}
          {tmdb.vote_count && tmdb.vote_count > 0 ? (
            <span> &nbsp;|&nbsp;&nbsp; Rating: {tmdb.vote_average}/10</span>
          ) : ""}
        </div>

        <div className="meta-info">
          <span>{tmdb.genres ? tmdb.genres.map(genre => genre.name).join(', ') : ''}</span>
        </div>

        <div className="action-buttons">
          <Reaction
            isLiked={record?.isLiked}
            recordId={record.recordId}
            userId={""}
            onUpdate={handleReactionUpdate}
          />
          <Watchlist
            isAddedToWatchList={record?.isWatchListed}
            recordId={record.recordId}
            onUpdate={handleWatchlistWatchedUpdate}
          />
          <Watched
            isWatched={record?.isWatched}
            recordId={record.recordId}
            onUpdate={handleWatchlistWatchedUpdate}
          />
          <button
            className="icon-button float-left"
            aria-label="info"
            onClick={() => navigate(
              record.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE
                ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(
                    ":title",
                    `${record.recordId}-${record.name.toLowerCase().replace(/ /g, "-")}`
                  )
                : Constants.DB_SERIES_DETIALS_ROUTE.replace(
                    ":title",
                    `${record.recordId}-${record.name.toLowerCase().replace(/ /g, "-")}`
                  )
            )}
          >
            <i className="fas fa-info" />
          </button>
        </div>

        <p className="description">{tmdb.overview}</p>
      </div>
    </div>
  );
};

export default RecordPreviewModal;