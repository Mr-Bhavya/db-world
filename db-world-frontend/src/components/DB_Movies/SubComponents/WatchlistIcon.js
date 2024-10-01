import React, { useState } from 'react';
import { removeWatchlistRecord, watchlistRecord } from '../../ApiServices';

function WatchlistIcon(props) {

    var { recordId, userId } = props;
    const [isAddedToWatchList, setIsAddedToWatchList] = useState(props.isAddedToWatchList)
    const [loader, setLoader] = useState(false);

    const onWatchList = async () => {
        setLoader(true)
        if (!isAddedToWatchList) {
            let response = await watchlistRecord(recordId, userId)
            if (response.httpStatusCode === 200) {
                setIsAddedToWatchList(true);
            } else {
                console.log(response.message);
            }
        }
        setLoader(false)
    }

    const onUnWatchList = async () => {
        setLoader(true)
        if (isAddedToWatchList) {
            let response = await removeWatchlistRecord(recordId, userId)
            if (response.httpStatusCode === 200) {
                setIsAddedToWatchList(false);
            } else {
                console.log(response.message);
            }
        }
        setLoader(false)
    }

    return (
        <>
            {
                loader ?
                    <button className='btn mx-3' style={{ width: "3rem" }}  >
                        <div class="spinner-border spinner-border-sm" role="status" >
                            <span class="sr-only">Loading...</span>
                        </div>
                    </button>
                    :
                    isAddedToWatchList ?
                        <button className='btn btn-sm' onClick={() => onUnWatchList()} >
                            <img src="https://img.icons8.com/material-rounded/96/checked--v1.png"
                                style={{ width: "1.5rem" }}
                                title="Added to watchlist" alt="Added to watchlist"
                            />
                            <br />
                            <b style={{ fontSize: "0.6rem" }}>
                                {/* Remove<br /> */}
                                ➖ Watchlist
                            </b>
                        </button>
                        :
                        <button className='btn btn-sm' onClick={() => onWatchList()}>
                            <img src="https://img.icons8.com/ios/96/add--v1.png"
                                style={{ width: "1.5rem" }}
                                title="Add to watchlist" alt="Add to watchlist"
                            />
                            <br />
                            <b style={{ fontSize: "0.6rem" }}>
                                {/* Add to<br /> */}
                                ➕ Watchlist
                            </b>
                        </button>
            }
        </>
    )

}

export default WatchlistIcon;