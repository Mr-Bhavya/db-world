import React, { useState } from 'react';
import { addWatchlist, removeWatchlist } from '../api/cinemaApi';
import { iconButtonStyles, spinnerIcon } from "./IconButtonStyles";
import { Tooltip, Zoom, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import Bookmark from '@mui/icons-material/Bookmark';
import BookmarkBorder from '@mui/icons-material/BookmarkBorder';
import useRecordStore from '@app/store/recordStore';

function Watchlist({ recordId, isAddedToWatchList = false, size = "medium" }) {
  const [isWatchListed, setIsWatchListed] = useState(isAddedToWatchList);
  const { records: allRecords, updateRecord } = useRecordStore();
  const [loading, setLoading] = useState(false);

  const handleToggleWatchlist = async () => {
    setLoading(true);
    try {
      if (isWatchListed) {
        await removeWatchlist(recordId);
      } else {
        await addWatchlist(recordId);
      }
      setIsWatchListed(!isWatchListed);
      onUpdate?.({ isWatchListed: !isWatchListed });
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
            <Bookmark
              sx={{
                fontSize: iconButtonStyles.iconSize,
                color: iconButtonStyles.activeColor
              }}
            />
          ) : (
            <BookmarkBorder
              sx={{
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
