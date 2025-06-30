import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  IconButton, 
  Button,
  Tooltip, 
  Zoom 
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { iconButtonStyles } from "./IconButtonStyles";
import Constants from "../../Constants";

function Download({ 
  record,
  downloadUrl,
  fileName,
  color = "dark", 
  size = "small",
  variant = "icon",        // 'icon' | 'button' | 'text'
  buttonVariant = "contained", // 'contained' | 'outlined' | 'text'
  label = "Download",
  tooltip = "Download",
  mode = "navigate",      // 'navigate' | 'direct'
  sx = {},
  ...props
}) {
    const navigate = useNavigate();

    const handleDownload = () => {
        if (mode === "navigate") {
            if (!record?.recordId) {
                Constants.showToast.error("Record information is not available.");
                return;
            }
            navigate(
                `${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(":recordId", record.recordId)}`,
                { state: { record } }
            );
        } else {
            if (!downloadUrl) {
                Constants.showToast.error("Download URL is not available.");
                return;
            }
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            if (fileName) link.download = fileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const renderContent = () => {
        const commonProps = {
            size,
            color,
            onClick: handleDownload,
            sx: {
                ...sx,
                '&:hover': {
                    backgroundColor: iconButtonStyles.hoverColor,
                }
            },
            ...props
        };

        switch (variant) {
            case 'button':
                return (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                            {...commonProps}
                            variant={buttonVariant}
                            startIcon={<DownloadIcon />}
                        >
                            {label}
                        </Button>
                    </motion.div>
                );
            case 'text':
                return (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <span 
                            onClick={handleDownload}
                            style={{ 
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: iconButtonStyles.inactiveColor,
                                '&:hover': {
                                    color: iconButtonStyles.activeColor,
                                }
                            }}
                        >
                            <DownloadIcon fontSize={size} />
                            {label && <span style={{ marginLeft: '4px' }}>{label}</span>}
                        </span>
                    </motion.div>
                );
            case 'icon':
            default:
                return (
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <IconButton
                            {...commonProps}
                        >
                            <DownloadIcon fontSize={size} />
                        </IconButton>
                    </motion.div>
                );
        }
    };

    return (
        <Tooltip title={tooltip} TransitionComponent={Zoom}>
            {renderContent()}
            {Constants.TOAST_CONTAINER}
        </Tooltip>
    );
}

export default Download;