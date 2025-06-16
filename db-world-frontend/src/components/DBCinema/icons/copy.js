import React, { useState } from 'react';
import CommonServices from '../../CommonServices';
import { toast } from 'react-toastify';
import Constants from '../../Constants';
import { 
  Button, 
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

const CopyButton = styled(Button)(({ theme, copied }) => ({
  minWidth: 'unset',
  padding: '6px 12px',
  transition: 'all 0.3s ease',
  backgroundColor: copied ? theme.palette.success.main : 'transparent',
  color: copied ? theme.palette.success.contrastText : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: copied ? theme.palette.success.dark : theme.palette.action.hover,
  },
  border: `1px solid ${copied ? theme.palette.success.main : theme.palette.divider}`,
}));

const Copy = ({ text, label = "Copy URL" }) => {
  const [copyText, setCopyText] = useState(null);

  const handleCopy = (text) => {
    setCopyText(text);
    const result = CommonServices.handleCopy(text);
    if (result.success) {
      Constants.showToast.success(result.message, {
        position: 'top-center',
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        transition: Zoom,
      });
      setTimeout(() => {
        setCopyText(null);
      }, 2000);
    } else {
      Constants.showToast.error(result.message);
    }
  };

  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Tooltip title={copyText === text ? "Copied!" : `Copy ${label}`}>
        <CopyButton
          size="small"
          variant="outlined"
          copied={copyText === text}
          onClick={() => handleCopy(text)}
          startIcon={copyText === text ? <CheckIcon /> : <CopyIcon />}
        >
          {copyText === text ? 'Copied' : label}
        </CopyButton>
      </Tooltip>
    </motion.div>
  );
};

export default Copy;