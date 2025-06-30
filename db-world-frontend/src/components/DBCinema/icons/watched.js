import React, { useState } from 'react';
import {
  markRecordWatched,
  unmarkRecordWatched,
} from '../../ApiServices';
import { iconButtonStyles, spinnerIcon } from "./IconButtonStyles";
import { Tooltip, Zoom, IconButton } from '@mui/material';
import { motion } from 'framer-motion';

function Watched({ recordId, isWatched = false, onUpdate, size = "medium" }) {
  const [isWatchedState, setIsWatchedState] = useState(isWatched);
  const [loading, setLoading] = useState(false);

  const handleToggleWatched = async () => {
    setLoading(true);
    try {
      const response = isWatchedState 
        ? await unmarkRecordWatched(recordId)
        : await markRecordWatched(recordId);
      
      if (response.httpStatusCode === 200) {
        setIsWatchedState(!isWatchedState);
        onUpdate?.({ isWatched: !isWatchedState });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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