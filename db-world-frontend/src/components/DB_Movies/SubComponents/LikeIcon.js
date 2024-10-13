import React, { useState } from 'react';
import likeIcon from "../../../images/like.gif";
import { likeRecord, unLikeRecord } from '../../ApiServices';

function LikeIcon(props) {
    var { recordId, userId } = props;
    const [isLiked, setIsLiked] = useState(props.isLiked)
    const [loader, setLoader] = useState(false);

    const onLike = async () => {
        setLoader(true);
        //isLiked = true then have to do Unlike else have to do like 
        if (!isLiked) { //isLike = false ==> then call like
            let likeResponse = await likeRecord(recordId, userId)
            if (likeResponse.httpStatusCode === 200) {
                setIsLiked(true);
            } else {
                console.log(likeResponse.message);
            }
        }
        setLoader(false);

    }

    const onUnLike = async () => {
        setLoader(true);
        if (isLiked) {
            let unLikeRes = await unLikeRecord(recordId, userId)
            if (unLikeRes.httpStatusCode === 200) {
                setIsLiked(false);
            } else {
                console.log(unLikeRes.message);
            }
        }
        setLoader(false);
    }

    return (
        <>
            {
                loader ?
                    <button className='btn' >
                        <div class="spinner-border spinner-border-sm" role="status" >
                            <span class="sr-only">Loading...</span>
                        </div>
                    </button>
                    :
                    isLiked ?
                        <button className='btn btn-sm' onClick={() => onUnLike()} >
                            <img src="https://img.icons8.com/fluency-systems-filled/96/facebook-like.png"
                                style={{ width: "1.5rem" }}
                                alt="movie liked" title="Liked movies"
                            />
                            <br />
                            <b style={{ fontSize: "0.6rem" }}>
                                Unlike
                            </b>
                        </button>

                        :
                        <button className='btn btn-sm' onClick={() => onLike()} >
                            <img src={likeIcon} style={{ width: "1.5rem" }}
                                title="Like movies" alt="Like movies"
                            />
                            <br />
                            <b style={{ fontSize: "0.6rem" }}>
                                Like
                            </b>
                        </button>
            }
        </>
    )

}

export default LikeIcon;