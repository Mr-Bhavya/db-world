import React, { useState } from 'react';
import CommonServices from '../../CommonServices';
import Constants from '../../Constants';
import {
  IconButton,
  Tooltip,
  Zoom,
  styled
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { iconButtonStyles } from "./IconButtonStyles";

const Copy = ({
  text,
  label = null,
  tooltip = "Copy URL",
  size = "medium",
  variant = "icon", // 'icon' | 'button' | 'text'
  color = "inherit"
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    const result = CommonServices.handleCopy(text);

    if (result.success) {
      Constants.showToast.success(result.message, {
        position: 'top-center',
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        transition: Zoom,
      });
      setTimeout(() => setCopied(false), 2000);
    } else {
      Constants.showToast.error(result.message);
    }
  };

  const renderContent = () => {
    switch (variant) {
      case 'button':
        return (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <IconButton
              size={size}
              color={copied ? "success" : color}
              variant="contained"
              onClick={handleCopy}
              sx={{
                '&:hover': {
                  backgroundColor: iconButtonStyles.hoverColor,
                }
              }}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {label && <span style={{ marginLeft: '8px' }}>{copied ? 'Copied' : label}</span>}
            </IconButton>
          </motion.div>
        );
      case 'text':
        return (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <span
              onClick={handleCopy}
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                color: copied ? iconButtonStyles.activeColor : iconButtonStyles.inactiveColor
              }}
            >
              {copied ? <CheckIcon fontSize={size} /> : <CopyIcon fontSize={size} />}
              {label && <span style={{ marginLeft: '4px' }}>{copied ? 'Copied' : label}</span>}
            </span>
          </motion.div>
        );
      case 'icon':
      default:
        return (
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <IconButton
              size={size}
              color={copied ? "success" : color}
              onClick={handleCopy}
              sx={{
                '&:hover': {
                  backgroundColor: iconButtonStyles.hoverColor,
                }
              }}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </IconButton>
          </motion.div>
        );
    }
  };

  return (
    <Tooltip title={copied ? "Copied!" : tooltip} TransitionComponent={Zoom}>
      {renderContent()}
    </Tooltip>
  );
};

export default Copy;