// components/ImageCardItem.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import LazyImage from '../components/LazyImage';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';

const ImageCardItem = React.memo(({ record, horizontal, onClick }) => {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    const url = CommonServices.getImageUrlFromTmdb(
      record?.tmdb,
      horizontal ? Constants.IMAGE_TYPE_BACKDROP : Constants.IMAGE_TYPE_POSTER,
      "w500"
    );
    setImageUrl(url);
  }, [record, horizontal]);

  const handleError = useCallback(() => {
    const imagePath = !horizontal ? record?.tmdb.poster_path : record?.tmdb.backdrop_path;
    setImageUrl(
      Constants.TMDB_IMAGE_BASE_URL
        .replace('{quality}', 'w500')
        .replace('{imagePath}', imagePath)
    );
  }, [record, horizontal]);

  return (
    <motion.div 
      className="card bg-dark text-white"
      whileHover={!horizontal ? { scale: 1.05 } : undefined}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    >
      <LazyImage
        className={`thumbnail ${horizontal ? "horizontal" : ""} card-img`}
        skeleton={
          <div className="item-container">
            <div className={`skeleton-card ${horizontal ? "horizontal" : ""}`}></div>
          </div>
        }
        src={imageUrl}
        alt={record.title}
        horizontal={horizontal}
        handleError={handleError}
      />
      {horizontal && (
        <div className="card-img-overlay d-flex align-items-end m-0 p-0">
          <p className="card-title text-sm m-0 p-0">{record?.name}</p>
        </div>
      )}
    </motion.div>
  );
});

export default ImageCardItem;