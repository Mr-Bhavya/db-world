import React, { useState } from 'react';
import { watchlistRecord, removeWatchlistRecord } from '../../ApiServices';
import { iconButtonStyles, spinnerIcon } from "./IconButtonStyles";
import { Tooltip, Zoom, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import useRecordStore from '../../../store/recordStore';

function Watchlist({ recordId, isAddedToWatchList = false, size = "medium" }) {
  const [isWatchListed, setIsWatchListed] = useState(isAddedToWatchList);
  const { records: allRecords, updateRecord } = useRecordStore();
  const [loading, setLoading] = useState(false);

  const handleToggleWatchlist = async () => {
    setLoading(true);
    try {
      const response = isWatchListed
        ? await removeWatchlistRecord(recordId)
        : await watchlistRecord(recordId);

      if (response.httpStatusCode === 200) {
        setIsWatchListed(!isWatchListed);
        onUpdate?.({ isWatchListed: !isWatchListed });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onUpdate = ({ isWatchListed }) => {
    let record = allRecords[recordId];
    if (!record) {
      console.warn(`Record with ID ${recordId} not found in store.`);
      return;
    } else {
      if (isWatchListed === true) {
        record.isWatchListed = true;
      } else {
        record.isWatchListed = false;
      }
    }
    updateRecord(record);
  }

  return (
    <Tooltip
      title={isWatchListed ? 'Remove from Watchlist' : 'Add to Watchlist'}
      TransitionComponent={Zoom}
    >
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <IconButton
          onClick={handleToggleWatchlist}
          disabled={loading}
          size={size}
          sx={{
            '&:hover': {
              backgroundColor: iconButtonStyles.hoverColor,
            }
          }}
        >
          {loading ? (
            spinnerIcon
          ) : isWatchListed ? (
            <i
              className="fas fa-bookmark"
              style={{
                fontSize: iconButtonStyles.iconSize,
                color: iconButtonStyles.activeColor
              }}
            />
          ) : (
            <i
              className="far fa-bookmark"
              style={{
                fontSize: iconButtonStyles.iconSize,
                color: iconButtonStyles.inactiveColor
              }}
            />
          )}
        </IconButton>
      </motion.div>
    </Tooltip>
  );
}

export default Watchlist;