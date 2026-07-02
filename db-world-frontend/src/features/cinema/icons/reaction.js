import React, { useState, useEffect } from 'react';
import { addLike, removeLike } from '../api/cinemaApi';
import { Tooltip, Zoom, IconButton, Box, Popover } from '@mui/material';
import { motion } from 'framer-motion';
import { iconButtonStyles, spinnerIcon } from "./IconButtonStyles";
import useRecordStore from '@app/store/recordStore';
import ThumbUp from '@mui/icons-material/ThumbUp';
import Favorite from '@mui/icons-material/Favorite';
import ThumbDown from '@mui/icons-material/ThumbDown';
import SentimentSatisfiedAltOutlined from '@mui/icons-material/SentimentSatisfiedAltOutlined';

const reactions = [
  { type: 'like', Icon: ThumbUp, label: 'Like' },
  { type: 'love', Icon: Favorite, label: 'Love' },
  { type: 'dislike', Icon: ThumbDown, label: 'Dislike' }
];

const Reaction = ({
  recordId,
  initialReaction = null,
  size = "medium",
  showLabel = false,
  color = "inherit"
}) => {
  const [reaction, setReaction] = useState(initialReaction);
  const [loading, _setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const { records: allRecords, updateRecord } = useRecordStore();

  const open = Boolean(anchorEl);

  useEffect(() => {
    setReaction(initialReaction);
  }, [initialReaction]);

  const onUpdate = (newReaction) => {
    //console.log(`Updating reaction for record ${recordId} to`, newReaction);
    let record = allRecords[recordId];
    if (!record) {
      console.warn(`Record with ID ${recordId} not found in store.`);
      return;
    } else {
      if (newReaction?.reaction === 'like') {
        record.isLiked = true;
      } else {
        record.isLiked = false;
      }
    }
    updateRecord(record);
  }

  // Immediate UI update with optimistic UI pattern
  const handleReaction = async (selectedType) => {
    const previousReaction = reaction;

    // Immediate UI update
    if (selectedType === reaction) {
      setReaction(null);
      onUpdate?.({ reaction: null });
    } else {
      setReaction(selectedType);
      onUpdate?.({ reaction: selectedType });
    }

    setAnchorEl(null); // Close popover immediately

    try {
      // Remove previous reaction if exists
      if (previousReaction) {
        await removeCurrentReaction(previousReaction);
      }

      // Add new reaction if different from previous
      if (selectedType !== previousReaction) {
        await addNewReaction(selectedType);
      }
    } catch (error) {
      console.error(error);
      // Revert on error
      setReaction(previousReaction);
      onUpdate?.({ reaction: previousReaction });
    }
  };

  const removeCurrentReaction = async (type) => {
    switch (type) {
      case 'like': return removeLike(recordId);
      default: return Promise.resolve();
    }
  };

  const addNewReaction = async (type) => {
    switch (type) {
      case 'like': return addLike(recordId);
      default: return Promise.resolve();
    }
  };

  const handleMouseEnter = (event) => {
    clearTimeout(hoverTimeout);
    setAnchorEl(event.currentTarget);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setAnchorEl(null);
    }, 300); // Small delay to prevent accidental closing
    setHoverTimeout(timeout);
  };

  const currentReaction = reactions.find(r => r.type === reaction);

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Tooltip
        title={reaction ? `Remove ${reaction}` : 'Add reaction'}
        TransitionComponent={Zoom}
      >
        <IconButton
          size={size}
          color={color}
          sx={{
            '&:hover': {
              backgroundColor: iconButtonStyles.hoverColor,
            }
          }}
        >
          {loading ? (
            spinnerIcon
          ) : reaction && currentReaction ? (
            <>
              <currentReaction.Icon
                sx={{
                  fontSize: iconButtonStyles.iconSize,
                  color: iconButtonStyles.activeColor
                }}
              />
              {showLabel && (
                <span style={{ marginLeft: '8px' }}>
                  {currentReaction.label}
                </span>
              )}
            </>
          ) : (
            <>
              <SentimentSatisfiedAltOutlined
                sx={{
                  fontSize: iconButtonStyles.iconSize,
                  color: iconButtonStyles.inactiveColor
                }}
              />
              {showLabel && (
                <span style={{ marginLeft: '8px' }}>React</span>
              )}
            </>
          )}
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        disableScrollLock={true}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        disableRestoreFocus
        sx={{
          zIndex: 2000,
          pointerEvents: 'none', // Allows hover through the popover
          '& .MuiPopover-paper': {
            pointerEvents: 'auto',
            borderRadius: '24px',
            padding: '8px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)'
          }
        }}
        onMouseEnter={() => clearTimeout(hoverTimeout)}
        onMouseLeave={handleMouseLeave}
      >
        <Box sx={{ display: 'flex', gap: '8px' }}>
          {reactions.map(({ type, Icon, label }) => (
            <motion.div
              key={type}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              <Tooltip title={label} TransitionComponent={Zoom}>
                <IconButton
                  onClick={() => handleReaction(type)}
                  sx={{
                    backgroundColor: reaction === type ?
                      'rgba(255,255,255,0.2)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  <Icon
                    sx={{
                      fontSize: iconButtonStyles.iconSize,
                      color: reaction === type ?
                        iconButtonStyles.activeColor :
                        iconButtonStyles.inactiveColor
                    }}
                  />
                </IconButton>
              </Tooltip>
            </motion.div>
          ))}
        </Box>
      </Popover>
    </Box>
  );
};

export default Reaction;