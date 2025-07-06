import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { motion } from "framer-motion";
import Constants from "../../../Constants";
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Checkbox, 
  FormControlLabel, 
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Container
} from "@mui/material";
import { styled } from "@mui/system";
import { ytDownload, ytInfo, adminSearchRecord } from "../../../ApiServices";
import FormatSelection from "./FormatSelection";

const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  paddingLeft: theme.spacing(0),
  paddingRight: theme.spacing(0),
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
}));

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } }
};

function YoutubeDownloader() {
  const navigate = useNavigate();
  const location = useLocation();

  const [link, setLink] = useState("");
  const [submitLoader, setSubmitLoader] = useState(false);
  const [getDetailsLoader, setGetDetailsLoader] = useState(false);
  const [videoDetails, setVideoDetails] = useState([]);
  const [onlyAudio, setOnlyAudio] = useState(false);
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState("");
  const [totalSize, setTotalSize] = useState(0);
  const [recordName, setRecordName] = useState("");
  const [recordList, setRecordList] = useState([]);
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);

  const onGetDetail = async () => {
    if (!link) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    setGetDetailsLoader(true);
    try {
      const ytInfoRes = await ytInfo(link);
      if (ytInfoRes.httpStatusCode === 200) {
        const result = ytInfoRes.data;
        setVideoDetails(result.formats.reverse());
        const generatedTitle = result.series && result?.series !== null || result.season_number && result?.season_number !== null
          ? `${result?.series} S${result.season_number}E${result.episode_number} - ${result.title}`
          : `${result.title}`;
        setTitle(generatedTitle);
        toast.success("Video details loaded successfully");
      } else if (ytInfoRes.httpStatusCode === 401) {
        toast.error(ytInfoRes.message + Constants.RE_LOGIN, {
          onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }),
          autoClose: 1000
        });
      } else {
        toast.error(ytInfoRes.message);
      }
    } catch (err) {
      toast.error("Failed to fetch video details");
      console.error("Error fetching video details:", err);
    } finally {
      setGetDetailsLoader(false);
    }
  };

  const onSubmit = async (videoITag, audioITag) => {
    // if (!recordName) {
    //   toast.error("Please select a record");
    //   return;
    // }

    setSubmitLoader(true);
    try {
      const ytDownloadRes = await ytDownload({
        url: link, 
        folderName: recordName, 
        fileName: title, 
        fileSize: isNaN(totalSize) ? 0 : totalSize, 
        videoITag, 
        audioITag, 
        onlyAudio
      });
      
      if (ytDownloadRes.httpStatusCode === 200) {
        toast.success(ytDownloadRes.message);
      } else {
        toast.error(ytDownloadRes.message);
      }
    } catch (err) {
      toast.error("Failed to start download");
      console.error("Download error:", err);
    } finally {
      setSubmitLoader(false);
    }
  };

  const searchDbCinemaRecord = async () => {
    if (recordName.length > 2) {
      try {
        const response = await adminSearchRecord(recordName);
        if (response.httpStatusCode === 200) {
          setRecordList(response.data);
          setShowRecordDropdown(true);
        }
      } catch (err) {
        console.error("Error searching records:", err);
      }
    } else {
      setShowRecordDropdown(false);
    }
  };

  const selectRecord = (record) => {
    setRecordName(`${record.recordId}-${record.name}`);
    setShowRecordDropdown(false);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (recordName) {
        searchDbCinemaRecord();
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [recordName]);

  return (
    <StyledContainer maxWidth="md" >
      <motion.div initial="hidden" animate="visible" variants={fadeIn}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
          YouTube Downloader
        </Typography>

        <StyledPaper elevation={3}>
          {/* Record Selector */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Record"
              variant="outlined"
              value={recordName}
              onChange={(e) => setRecordName(e.target.value)}
              placeholder="Select or Type Record"
            />
            
            {showRecordDropdown && recordList.length > 0 && (
              <Paper elevation={3} sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                <List>
                  {recordList.map((item, index) => (
                    <React.Fragment key={item.recordId}>
                      <ListItem button onClick={() => selectRecord(item)}>
                        <ListItemText 
                          primary={item.name}
                          secondary={`${item.recordId} | ${item.type}`}
                        />
                      </ListItem>
                      {index < recordList.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          {/* YouTube Link Input */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="YouTube Link"
              variant="outlined"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Enter YouTube Link"
            />
          </Box>

          {/* Get Video Details Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={onGetDetail} 
              disabled={getDetailsLoader}
              size="large"
            >
              {getDetailsLoader ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Get Video Details"
              )}
            </Button>
          </Box>
        </StyledPaper>

        {/* Video Details Section */}
        {!getDetailsLoader && videoDetails.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <StyledPaper elevation={3}>
              <Typography variant="h6" gutterBottom>
                {title}
              </Typography>

              {/* Rename File Option */}
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rename}
                      onChange={() => setRename(!rename)}
                      color="primary"
                    />
                  }
                  label="Rename File"
                />
                {rename && (
                  <TextField
                    fullWidth
                    variant="outlined"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter new file name"
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>

              {/* Only Audio Option */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={onlyAudio}
                    onChange={() => setOnlyAudio(!onlyAudio)}
                    color="primary"
                  />
                }
                label="Download Only Audio"
              />

              <Divider sx={{ my: 3 }} />

              {/* Format Selection Component */}
              <FormatSelection 
                formats={videoDetails} 
                onHandleSubmit={onSubmit} 
                isLoading={submitLoader}
              />
            </StyledPaper>
          </motion.div>
        )}
      </motion.div>
      {Constants.TOAST_CONTAINER}
    </StyledContainer>
  );
}

export default YoutubeDownloader;