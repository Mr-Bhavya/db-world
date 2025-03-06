import React, { useState } from 'react';
import {
    watchlistRecord,
    removeWatchlistRecord,
} from '../../ApiServices';

function Watchlist(props) {
    const { recordId, onUpdate } = props;

    // Initialize state from props (default to false if not provided)
    const [isWatchListed, setIsWatchListed] = useState(props.isAddedToWatchList || false);

    // Separate loader states for each action
    const [watchlistLoader, setWatchlistLoader] = useState(false);

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

    // Handler for toggling watchlist status
    const onToggleWatchlist = async () => {
        setWatchlistLoader(true);
        if (!isWatchListed) {
            const response = await watchlistRecord(recordId);
            if (response.httpStatusCode === 200) {
                setIsWatchListed(true);
                onUpdate && onUpdate({isWatchListed: true})
            } else {
                console.log(response.message);
            }
        } else {
            const response = await removeWatchlistRecord(recordId);
            if (response.httpStatusCode === 200) {
                setIsWatchListed(false);
                onUpdate && onUpdate({isWatchListed: false})
            } else {
                console.log(response.message);
            }
        }
        setWatchlistLoader(false);
    };
    
    return (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Watchlist Icon Button */}
            <button
                onClick={onToggleWatchlist}
                title={isWatchListed ? 'Remove from Watchlist' : 'Add to Watchlist'}
                className='icon-button'
            >
                {watchlistLoader ? (
                    spinnerIcon
                ) : isWatchListed ? (
                    // Active: Solid bookmark icon (fas)
                    <i className="fas fa-bookmark" style={{ color: activeColor }}></i>
                ) : (
                    // Inactive: Regular bookmark icon (far)
                    <i className="far fa-bookmark" style={{ color: inactiveColor }}></i>
                )}
            </button>
        </div>
    );
}

export default Watchlist;
