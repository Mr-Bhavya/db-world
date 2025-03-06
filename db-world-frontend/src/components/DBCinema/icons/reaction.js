import React, { useState, useEffect } from "react";
import {
  likeRecord,
  unLikeRecord,
  // dislikeRecord,
  // unDislikeRecord,
} from "../../ApiServices";

function Reaction({ recordId, userId, isLiked, isDisliked, onUpdate }) {
  const initialReaction = isLiked ? "like" : isDisliked ? "dislike" : "none";
  const [reaction, setReaction] = useState(initialReaction);
  const [loader, setLoader] = useState(false);
  // const { updateRecordById } = useRecordStore();
  const activeColor = 'white';

  useEffect(() => {
    const newReaction = isLiked ? "like" : isDisliked ? "dislike" : "none";
    setReaction(newReaction);
  }, [isLiked, isDisliked]);

  const handleLike = async () => {
    setLoader(true);
    if (reaction === "like") {
      const res = await unLikeRecord(recordId, userId);
      if (res.httpStatusCode === 200) {
        setReaction("none");
        // Directly update the record in the store:
        onUpdate && onUpdate({ isLiked: false });
      }
    } else if (reaction === "none") {
      const res = await likeRecord(recordId, userId);
      if (res.httpStatusCode === 200) {
        setReaction("like");
        // Directly update the record in the store:
        onUpdate && onUpdate({ isLiked: true });
      }
    } else if (reaction === "dislike") {
      // const res1 = await unDislikeRecord(recordId, userId);
      // if (res1.httpStatusCode === 200) {
      //   const res2 = await likeRecord(recordId, userId);
      //   if (res2.httpStatusCode === 200) {
      //     setReaction("like");
      //     onUpdate && onUpdate({ isLiked: true, isDisliked: false });
      //   }
      // }
    }
    setLoader(false);
  };

  // const handleDislike = async () => {
  //   setLoader(true);
  //   if (reaction === "dislike") {
  //     const res = await unDislikeRecord(recordId, userId);
  //     if (res.httpStatusCode === 200) {
  //       setReaction("none");
  //       onUpdate && onUpdate({ isDisliked: false });
  //     }
  //   } else if (reaction === "none") {
  //     const res = await dislikeRecord(recordId, userId);
  //     if (res.httpStatusCode === 200) {
  //       setReaction("dislike");
  //       onUpdate && onUpdate({ isDisliked: true });
  //     }
  //   } else if (reaction === "like") {
  //     const res1 = await unLikeRecord(recordId, userId);
  //     if (res1.httpStatusCode === 200) {
  //       const res2 = await dislikeRecord(recordId, userId);
  //       if (res2.httpStatusCode === 200) {
  //         setReaction("dislike");
  //         onUpdate && onUpdate({ isLiked: false, isDisliked: true });
  //       }
  //     }
  //   }
  //   setLoader(false);
  // };

  const iconStyle = { fontSize: "1.5rem", lineHeight: "1.5rem", verticalAlign: "middle" };

  return loader ? (
    <button className="icon-button">
      <i className="fas fa-spinner fa-spin" style={{ ...iconStyle, color: activeColor }}></i>
    </button>
  ) : (
    <>
      <button className="icon-button" aria-label="Like" onClick={handleLike}>
        <i
          className="fas fa-thumbs-up"
          style={{ color: reaction === "like" ? "white" : "rgba(255, 255, 255, 0.2)" }}
        />
      </button>
      {/* <button className="icon-button" aria-label="Dislike" onClick={handleDislike}>
        <i
          className="fas fa-thumbs-down"
          style={{ color: reaction === "dislike" ? "white" : "rgba(255, 255, 255, 0.2)" }}
        />
      </button> */}
    </>
  );
}

export default Reaction;
