import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Button,
  Typography,
  Divider,
  IconButton,
  Collapse,
  Box,
  Grid,
  useTheme,
  useMediaQuery,
  alpha,
  Chip
} from "@mui/material";
import { Capacitor } from "@capacitor/core";
import { motion } from "framer-motion";
import { ExpandMore } from "@mui/icons-material";
import AndroidPlugins from "../../../../android-app-components/AndroidPlugins";
import VideoModal from "../download/VideoModal";
import CommonServices from "../../../CommonServices";
import Constants from "../../../Constants";
import { MediaInfoContent } from "./MediaInfoContent";
import Copy from "../../icons/copy";
import Download from "../../icons/download";
import Play from "../../icons/play";

export const MediaInfoRender = ({
  mediaInfo,
  expandCard = false,
  onPlay,
  onCopy,
  showActions = true,
  showHeader = true,
  cardStyle = {}
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expandedCards, setExpandedCards] = useState({ [mediaInfo.id]: expandCard });
  const [showPlayerFor, setShowPlayerFor] = useState(null);

  const toggleCard = (id) => setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Grid item xs={12} sm={6} md={4} lg={3} sx={{ display: 'flex' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ width: '100%' }}
      >
        <Card sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          boxShadow: theme.shadows[2],
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          width: '100%',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: theme.shadows[4],
            borderColor: theme.palette.primary.main
          },
          ...cardStyle
        }}>
          {showHeader && (
            <CardHeader
              sx={{
                px: 2,
                py: 1,
                bgcolor: alpha(theme.palette.background.default, 0.5),
                borderBottom: expandedCards[mediaInfo.id] ? `1px solid ${theme.palette.divider}` : 'none',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                cursor: 'pointer'
              }}
              title={
                <Box onClick={() => toggleCard(mediaInfo.id)} sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  width: '100%'
                }}>
                  <Typography
                    variant="subtitle2"
                    title={mediaInfo.general?.fileName}
                    sx={{
                      fontWeight: 600,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: isMobile ? 2 : 1,
                      WebkitBoxOrient: 'vertical',
                      whiteSpace: 'normal',
                      lineHeight: 1.3
                    }}
                  >
                    {mediaInfo.general?.fileName?.replace(/[._]/g, ' ') || 'Media File'}
                  </Typography>
                  <IconButton size="small" sx={{
                    transform: expandedCards[mediaInfo.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main', bgcolor: 'transparent' }
                  }}>
                    <ExpandMore fontSize="small" />
                  </IconButton>
                </Box>
              }
            />
          )}

          <Collapse in={expandedCards[mediaInfo.id]} timeout="auto" unmountOnExit>
            <MediaInfoContent mediaInfo={mediaInfo} />
          </Collapse>

          {showActions && (
            <CardActions sx={{
              justifyContent: 'space-between',
              px: 2,
              py: 1,
              bgcolor: alpha(theme.palette.background.default, 0.3),
              borderTop: `1px solid ${theme.palette.divider}`
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Play streamUrl={mediaInfo.streamUrl} mediaId={mediaInfo.id} variant="contained" label="Play" size="small" />
                <Copy text={mediaInfo.streamUrl} variant="icon" label="Copy" tooltip="Copy Stream URL" size="small" />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Download
                  downloadUrl={mediaInfo.downloadUrl}
                  mode="direct" variant="button"
                  label="Download" tooltip="Download File"
                  fileName={mediaInfo?.fileName}
                  color="success" />
                <Copy text={mediaInfo.downloadUrl} variant="icon" label="Copy" tooltip="Copy Download URL" size="small" />
              </Box>
            </CardActions>
          )}
        </Card>

        {showPlayerFor === mediaInfo.id && Capacitor.getPlatform() !== "android" && (
          <VideoModal
            url={mediaInfo.streamUrl}
            title={mediaInfo.general?.fileName}
            onExit={() => setShowPlayerFor(null)}
          />
        )}
      </motion.div>
    </Grid>
  );
};