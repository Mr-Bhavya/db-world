import React, { useState } from 'react';
import { addWatched, removeWatched } from '../api/cinemaApi';
import { iconButtonStyles, spinnerIcon } from "./IconButtonStyles";
import { Tooltip, Zoom, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import useRecordStore from '@app/store/recordStore';

function Watched({ recordId, isWatched = false, size = "medium" }) {
  const [isWatchedState, setIsWatchedState] = useState(isWatched);
  const [loading, setLoading] = useState(false);
  const { records: allRecords, updateRecord } = useRecordStore();


  const handleToggleWatched = async () => {
    setLoading(true);
    try {
      if (isWatchedState) {
        await removeWatched(recordId);
      } else {
        await addWatched(recordId);
      }
      setIsWatchedState(!isWatchedState);
      onUpdate?.({ isWatched: !isWatchedState });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onUpdate = ({ isWatched }) => {
    let record = allRecords[recordId];
    if (!record) {
      console.warn(`Record with ID ${recordId} not found in store.`);
      return;
    } else {
      if (isWatched === true) {
        record.isWatched = true;
      } else {
        record.isWatched = false;
      }
    }
    updateRecord(record);
  }

  return (
    <Tooltip
      title={isWatchedState ? 'Unmark as Watched' : 'Mark as Watched'}
      TransitionComponent={Zoom}
    >
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <IconButton
          onClick={handleToggleWatched}
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
          ) : isWatchedState ? (
            <i
              className="fas fa-eye"
              style={{
                fontSize: iconButtonStyles.iconSize,
                color: iconButtonStyles.activeColor
              }}
            />
          ) : (
            <i
              className="far fa-eye"
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

export default Watched;