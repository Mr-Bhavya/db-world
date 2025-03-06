import React, { useState } from 'react';
import {
  watchlistRecord,
  removeWatchlistRecord,
  markRecordWatched,
  unmarkRecordWatched,
} from '../../ApiServices';

function Watched(props) {
    const { recordId, userId, onUpdate } = props;

  // Initialize state from props (default to false if not provided)
  const [isWatched, setIsWatched] = useState(props.isWatched || false);

  // Separate loader states for each action
  const [watchedLoader, setWatchedLoader] = useState(false);

  // Use the same inline style as your like/dislike icons
  const iconStyle = {
    fontSize: '1.5rem',
    lineHeight: '1.5rem',
    verticalAlign: 'middle',
  };

  const inactiveColor = 'rgba(255, 255, 255, 0.2)';
  const activeColor = 'white';

  // Spinner icon
  const spinnerIcon = (
    <i className="fas fa-spinner fa-spin" style={{ ...iconStyle, color: activeColor }}></i>
  );

  // Handler for toggling watched status
  const onToggleWatched = async () => {
    setWatchedLoader(true);
    if (!isWatched) {
      const response = await markRecordWatched(recordId, userId);
      if (response.httpStatusCode === 200) {
        setIsWatched(true);
        onUpdate && onUpdate({isWatched: true})
      } else {
        console.log(response.message);
      }
    } else {
      const response = await unmarkRecordWatched(recordId, userId);
      if (response.httpStatusCode === 200) {
        setIsWatched(false);
        onUpdate && onUpdate({isWatched: false})
      } else {
        console.log(response.message);
      }
    }
    setWatchedLoader(false);
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center'}}>
      {/* Watched Icon Button */}
      <button
        onClick={onToggleWatched}
        style={{ border: 'none', cursor: 'pointer' }}
        title={isWatched ? 'Unmark as Watched' : 'Mark as Watched'}
        className='icon-button'
      >
        {watchedLoader ? (
          spinnerIcon
        ) : isWatched ? (
          // Active: Solid eye icon (fas)
          <i className="fas fa-eye" style={{ color: activeColor }}></i>
        ) : (
          // Inactive: Regular eye icon (far)
          <i className="far fa-eye" style={{ color: inactiveColor }}></i>
        )}
      </button>
    </div>
  );
}

export default Watched;
