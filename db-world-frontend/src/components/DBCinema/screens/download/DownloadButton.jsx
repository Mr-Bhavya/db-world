// DownloadButton.js
import React from "react";
// import { Button } from "react-bootstrap";
import { toast } from "react-toastify";
import AndroidPlugins from "../../../../android-app-components/AndroidPlugins";
import { Download } from "@mui/icons-material";
import { Button } from "@mui/material";
import Constants from "../../../Constants";

const DownloadButton = ({ downloadUrl, fileName }) => {
  const handleDownload = async () => {
    if (!downloadUrl) {
      Constants.showToast.error("Download URL is not available.");
      return;
    }
    try {
      const result = await AndroidPlugins.MyDownloadManager.startDownload({
        url: downloadUrl,
        fileName
      });
    } catch (error) {
      Constants.showToast.error("Error starting download");
      console.error("Download error:", error);
    }
  };

  return (
    // <Button size="sm" variant="outline-success" onClick={handleDownload}>
    //   <i className="fas fa-download"></i> Download
    // </Button>
    <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleDownload()}
                    // sx={{
                    //   minWidth: isMobile ? 'auto' : 120,
                    //   px: isMobile ? 1 : 2,
                    //   '& .MuiButton-startIcon': {
                    //     mr: isMobile ? 0 : 0.5
                    //   }
                    // }}
                  >
                    Download
                    {/* {isMobile ? <PlayArrow fontSize="small" /> : "Play"} */}
                  </Button>
  );
};

export default DownloadButton;