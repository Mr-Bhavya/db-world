import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Button,
  Alert,
  Spinner
} from "react-bootstrap";
import {
  Grid,
  Box,
  Typography,
  Chip,
  Tabs,
  Tab,
  useTheme,
  alpha
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { loadStreamFileInfoByRecordId } from "../../../ApiServices";
import { MediaInfoRender } from "../MediaFileInfo/MediaInfoRender";
import CommonServices from "../../../CommonServices";
import Constants from "../../../Constants";

const MediaDownloadViewer = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const record = props.record || location.state?.record;
  const showBack = props.showBack ?? true;
  const onBack = props.onBack;

  const [mediaFileList, setMediaFileList] = useState([]);
  const [mediaListLoader, setMediaListLoader] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (record?.recordId) {
      setMediaListLoader(true);
      loadStreamFileInfoByRecordId(record.recordId).then((response) => {
        if (response.httpStatusCode === 200) {
          const formatted = CommonServices.convertMediaInfoToCustomFormat(response.data);
          setMediaFileList(formatted);
        }
        setMediaListLoader(false);
      });
    } else {
      navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    }
  }, [record, navigate]);

  const getQualityAndFormat = (fileName, videoInfo) => {
    const qualityMatch = fileName.match(/(\d{3,4}p|4K|8K)/i);
    const baseQuality = qualityMatch ? qualityMatch[0] : "Unknown";
    const hdrDetails = videoInfo?.hdrDetails || '';
    const videoFormat = videoInfo?.format || '';
    const isHDR = fileName.includes('HDR') || hdrDetails.includes('HDR');
    const isDV = fileName.includes('DV') || hdrDetails.includes('DV');
    const isH265 = videoFormat.includes('HEVC');
    const isH264 = videoFormat.includes('AVC');
    const isAV1 = videoFormat.includes('AV1');
    const formats = [];

    // console.log("File Name:", fileName);

    if (isAV1) formats.push('AV1');
    else if (isH265) formats.push('H265');
    else if (isH264) formats.push('H264');

    if (isDV) formats.push('DV');
    else if (isHDR) formats.push('HDR');

    if (isHDR && isDV) formats.push('HDR+DV');

    return {
      baseQuality,
      fullQuality: baseQuality + (formats.length ? ` (${formats.join(' + ')})` : ''),
      formats
    };
  };

  const groupedBySeason = record?.type?.toLowerCase() === "series"
    ? mediaFileList.reduce((acc, ep) => {
      const seasonMatch = ep?.general?.fileName?.match(/S(\d{2})/i);
      const season = seasonMatch ? seasonMatch[1] : "Unknown";
      const { baseQuality, formats } = getQualityAndFormat(ep.general.fileName, ep.video);
      if (!acc[season]) acc[season] = { qualities: {}, allFormats: new Set() };

      formats.forEach(f => acc[season].allFormats.add(f));
      if (!acc[season].qualities[baseQuality]) {
        acc[season].qualities[baseQuality] = { formats: {}, allFiles: [] };
      }

      acc[season].qualities[baseQuality].allFiles.push(ep);
      if (formats.length > 0) {
        const key = formats.join('+');
        if (!acc[season].qualities[baseQuality].formats[key]) {
          acc[season].qualities[baseQuality].formats[key] = [];
        }
        acc[season].qualities[baseQuality].formats[key].push(ep);
      }
      return acc;
    }, {})
    : {};

  const RenderQualityGroup = ({ qualityData }) => {
    const formatKeys = Object.keys(qualityData.formats);

    if (formatKeys.length <= 1) {
      return (
        <Grid container spacing={2}>
          {qualityData.allFiles.map((ep, idx) => (
            <MediaInfoRender key={idx} mediaInfo={ep} />
          ))}
        </Grid>
      );
    }

    return (
      <Box sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mb: 2,
            '& .MuiTabs-indicator': { backgroundColor: theme.palette.primary.main },
            '& .MuiTab-root': { color: theme.palette.text.secondary },
            '& .Mui-selected': { color: theme.palette.primary.main }
          }}
        >
          {formatKeys.map((formatKey, index) => (
            <Tab
              key={formatKey}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {formatKey}
                  <Chip
                    label={qualityData.formats[formatKey].length}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: activeTab === index
                        ? alpha(theme.palette.primary.main, 0.2)
                        : alpha(theme.palette.text.secondary, 0.1),
                      color: activeTab === index ? theme.palette.primary.main : theme.palette.text.secondary
                    }}
                  />
                </Box>
              }
              sx={{ textTransform: 'none', minHeight: 'auto', py: 1, px: 1.5, fontSize: '0.875rem' }}
            />
          ))}
        </Tabs>

        <Grid container spacing={2}>
          {qualityData.formats[formatKeys[activeTab]].map((ep, idx) => (
            <MediaInfoRender key={idx} mediaInfo={ep} />
          ))}
        </Grid>
      </Box>
    );
  };

  const RenderSeries = () => {
    return Object.keys(groupedBySeason).sort().map((season) => {
      const seasonData = groupedBySeason[season];
      const qualityKeys = Object.keys(seasonData.qualities).sort((a, b) => {
        const order = ['8K', '4K', '2160p', '1440p', '1080p', '720p', '480p'];
        return order.indexOf(b) - order.indexOf(a);
      });

      return (
        <Grid item xs={12} key={season}>
          <Typography variant="h6" sx={{
            my: 2,
            pl: 1,
            position: 'relative',
            color: theme.palette.text.primary,
            '&:before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: '60%',
              width: '3px',
              bgcolor: 'primary.main',
              borderRadius: '3px'
            }
          }}>
            Season {parseInt(season, 10)}
          </Typography>
          {qualityKeys.map(quality => (
            <Box key={quality} sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{
                fontWeight: 600,
                mb: 2,
                px: 1,
                color: theme.palette.text.primary
              }}>
                {quality}
                <Chip
                  label={`${seasonData.qualities[quality].allFiles.length} files`}
                  size="small"
                  sx={{ ml: 1, bgcolor: theme.palette.grey[900] }}
                />
              </Typography>
              <RenderQualityGroup qualityData={seasonData.qualities[quality]} />
            </Box>
          ))}
        </Grid>
      );
    });
  };

  const RenderMovie = () => (
    <Grid container spacing={2}>
      {mediaFileList.map((mediaInfo, idx) => (
        <MediaInfoRender key={idx} mediaInfo={mediaInfo} />
      ))}
    </Grid>
  );

  return (
    <Box sx={{
      backgroundColor: '#000000', // Pure black for AMOLED
      minHeight: '100vh',
      color: theme.palette.text.primary
    }}>
      <Container fluid className="p-3">
        {showBack && (
          <Button
            variant="outline-light"
            onClick={() => (onBack ? onBack() : navigate(-1))}
            className="mb-3"
            style={{ borderColor: theme.palette.primary.main, color: theme.palette.primary.main }}
          >
            <i className="fas fa-arrow-left me-2"></i> Back
          </Button>
        )}

        <Row className="align-items-center mb-4">
          <Col xs={12} md={3} className="text-center">
            <img
              src={`https://image.tmdb.org/t/p/w300${record?.tmdb?.poster_path || record?.tmdb?.backdrop_path}`}
              alt={record?.tmdb?.title}
              className="img-fluid rounded"
              style={{
                maxWidth: "200px",
                boxShadow: `0 0 10px ${theme.palette.primary.main}`
              }}
            />
          </Col>
          <Col xs={12} md={9}>
            <Typography variant="h4" sx={{ color: theme.palette.text.primary }}>
              {record?.tmdb?.title}
            </Typography>
            {record?.tmdb?.release_date && (
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                <strong>Release:</strong> {record?.tmdb?.release_date}
              </Typography>
            )}
            {record?.tmdb?.overview && (
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                {record?.tmdb?.overview}
              </Typography>
            )}
          </Col>
        </Row>

        <Typography variant="h5" sx={{
          color: theme.palette.text.primary,
          mb: 3,
          borderBottom: `1px solid ${theme.palette.primary.main}`,
          pb: 1
        }}>
          Downloadable Files
        </Typography>

        {mediaListLoader ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
            <Spinner animation="border" variant="light" />
          </Box>
        ) : mediaFileList.length === 0 ? (
          <Alert variant="danger" className="text-center my-5">
            No media available to download for this record
          </Alert>
        ) : record.type.toLowerCase() === "series" ? (
          <Grid container spacing={2}>{RenderSeries()}</Grid>
        ) : (
          RenderMovie()
        )}
      </Container>
      {Constants.TOAST_CONTAINER}
    </Box>
  );
};

export default MediaDownloadViewer;