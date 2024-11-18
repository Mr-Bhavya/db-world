import React, { useState } from 'react';
import watchMovie from "../../../images/WatchMovie.png";
import { unWatchedRecord, watchedRecord } from '../../ApiServices';

function WatchedIcon(props) {

    var { recordId, userId } = props;
    const [isWatched, setIsWatched] = useState(props.isWatched)
    const [loader, setLoader] = useState(false);

    const onWatched = async () => {
        setLoader(true)
        if (!isWatched) {
            let response = await watchedRecord(recordId)
            if (response.httpStatusCode === 200) {
                setIsWatched(true);
            } else {
                console.log(response.message);
            }
        }
        setLoader(false)
    }

    const onUnWatched = async () => {
        setLoader(true)
        if (isWatched) {
            let response = await unWatchedRecord(recordId)
            if (response.httpStatusCode === 200) {
                setIsWatched(false);
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
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    :
                    isWatched ?
                        <button type="button" className="btn btn-sm btn-success rounded-pill" onClick={() => onUnWatched()}>Watched</button>
                        :
                        <button className='btn btn-sm' onClick={() => onWatched()}>
                            <img src={watchMovie}
                                style={{ width: "1.8rem" }}
                                title="Add to watched" alt="Add to watched"
                            />
                            <br />
                            <b style={{ fontSize: "0.6rem" }}>
                                {/* Add to<br /> */}
                                + Watched
                            </b>
                        </button>
            }
        </>
    )

}

export default WatchedIcon;