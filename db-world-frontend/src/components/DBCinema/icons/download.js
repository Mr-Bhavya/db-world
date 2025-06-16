import React from "react";
import { useNavigate } from "react-router-dom";
import Constants from "../../Constants";
import {
    IconButton,
    Tooltip,
    Zoom
} from '@mui/material';
import {
    Download as DownloadIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

function Download({ record, userId }) {
    const navigate = useNavigate();

    return (
        <Tooltip title="Download" TransitionComponent={Zoom}>
            <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <IconButton
                    aria-label="download"
                    color="primary"
                    onClick={() => navigate(
                        `${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(":recordId", record.recordId)}`,
                        { state: { movie: record, userRole: "" } }
                    )}
                    sx={{
                        '&:hover': {
                            backgroundColor: 'primary.light',
                        }
                    }}
                >
                    <DownloadIcon />
                </IconButton>
            </motion.div>
        </Tooltip>
    );
}

export default Download;