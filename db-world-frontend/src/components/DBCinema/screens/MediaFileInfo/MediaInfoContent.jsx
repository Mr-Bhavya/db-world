import React, { useState } from "react";
import CommonServices from "../../../CommonServices";
import {
    CardContent,
    Typography,
    Divider,
    IconButton,
    Collapse,
    Box,
    Grid,
    useTheme,
    useMediaQuery,
    alpha,
    Chip,
    Button
} from "@mui/material";
import { ChevronRight } from "@mui/icons-material";
import Constants from "../../../Constants";

export const MediaInfoContent = ({ mediaInfo }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [expandedSeasons, setExpandedSeasons] = useState({});

    const toggleSeason = (seasonId) => {
        setExpandedSeasons((prev) => ({ ...prev, [seasonId]: !prev[seasonId] }));
    };

    // Reusable Info Section Component
    const InfoSection = ({ title, color = 'primary', children, sx = {} }) => (
        <Box
            sx={{
                p: 1.5,
                bgcolor: alpha(theme.palette.background.default, 0.5),
                borderRadius: 1,
                borderLeft: `3px solid ${theme.palette[color].main}`,
                mb: 1.5,
                ...sx
            }}
        >
            {title && (
                <Typography variant="subtitle2" color={color} sx={{ mb: 1 }}>
                    {title}
                </Typography>
            )}
            {children}
        </Box>
    );

    // Reusable Info Row Component
    const InfoRow = ({ label, value, sx = {} }) => (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, ...sx }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{label}:</Box> {value || 'N/A'}
        </Typography>
    );

    // Reusable Track Chip Component
    const TrackChip = ({ label, color = 'default' }) => (
        <Chip
            label={label}
            size="small"
            color={color}
            sx={{ height: 20, fontSize: '0.65rem', ml: 1 }}
        />
    );

    if (!mediaInfo) return null;

    return (
        <CardContent sx={{ py: 1, px: 2, maxHeight:'70vh', overflow:'auto', display:'flex' }} >
            <Grid container spacing={1}>
                {/* File Information */}
                <Grid item xs={12}>
                    <InfoSection title="File Information" color="secondary">
                        <InfoRow label="File Name" value={mediaInfo.general?.fileName} />
                        <InfoRow label="Format" value={`${mediaInfo.general?.format} ${mediaInfo.general?.formatVersion ? `(v${mediaInfo.general.formatVersion})` : ''}`} />

                        <Grid container spacing={1}>
                            <Grid item xs={6} sm={3}>
                                <InfoRow label="Size" value={mediaInfo.general?.fileSize} />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <InfoRow label="Duration" value={mediaInfo.general?.duration ? CommonServices.formatDuration(mediaInfo.general.duration) : 'N/A'} />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <InfoRow label="Bitrate" value={mediaInfo.general?.overallBitrate} />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <InfoRow label="Framerate" value={mediaInfo.general?.frameRate ? `${mediaInfo.general.frameRate} fps` : 'N/A'} />
                            </Grid>
                        </Grid>
                    </InfoSection>
                </Grid>

                {/* Video Information */}
                {mediaInfo.video && (
                    <Grid item xs={12} md={6}>
                        <InfoSection title="Video" color="primary">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {mediaInfo.video.resolution || 'N/A'}
                                </Typography>
                                {mediaInfo.video.formatProfile && <TrackChip label={mediaInfo.video.formatProfile} />}
                                {mediaInfo.video.hdrDetails && <TrackChip label="HDR" color="primary" />}
                            </Box>

                            <InfoRow label="Codec" value={mediaInfo.video.format} />
                            <InfoRow
                                label="Bitrate"
                                value={mediaInfo.video.bitRate ?
                                    `${CommonServices.bytesToReadbleFormat(mediaInfo.video.bitRate).value} ${CommonServices.bytesToReadbleFormat(mediaInfo.video.bitRate).suffix}/s` :
                                    'N/A'
                                }
                            />
                            <InfoRow
                                label="Color"
                                value={`${mediaInfo.video.colorSpace || 'N/A'} ${mediaInfo.video.chromaSubsampling || ''} ${mediaInfo.video.bitDepth ? `(${mediaInfo.video.bitDepth}-bit)` : ''}`}
                            />
                            {mediaInfo.video.hdrDetails && <InfoRow label="HDR" value={mediaInfo.video.hdrDetails} />}
                        </InfoSection>
                    </Grid>
                )}

                {/* Audio Information */}
                <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Audio</Typography>
                    <Box sx={{ maxHeight: 300, overflowY: 'auto', pr: 1 }}>
                        {mediaInfo.audio?.slice(0, 3).map((a, i) => (
                            <InfoSection key={i} color="info">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                        {a.language || `Audio ${i + 1}`}
                                    </Typography>
                                    {a.channels && <TrackChip label={CommonServices.getChannelDescription(a.channels)} />}
                                </Box>
                                <InfoRow label="Format" value={a.format} />
                                <InfoRow label="Bitrate" value={a.bitRate} />
                                <InfoRow label="Layout" value={a.channelLayout} />
                                {a.samplingRate && <InfoRow label="Sample Rate" value={`${Math.round(a.samplingRate / 1000)} kHz`} />}
                            </InfoSection>
                        ))}
                        {mediaInfo.audio?.length > 3 && (
                            <Typography variant="caption" color="text.secondary">
                                +{mediaInfo.audio.length - 3} more audio tracks
                            </Typography>
                        )}
                    </Box>
                </Grid>

                {/* Subtitles Information */}
                {mediaInfo.subtitle?.length > 0 && (
                    <Grid item xs={12}>
                        <Divider sx={{ my: 1.5, bgcolor: 'divider' }} />
                        <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Subtitles</Typography>
                        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                            <Grid container spacing={1}>
                                {mediaInfo.subtitle.slice(0, 4).map((sub, i) => (
                                    <Grid item xs={12} sm={6} key={i}>
                                        <InfoSection color="success">
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {sub.language || `Sub ${i + 1}`}
                                                </Typography>
                                                {sub.forced === "Yes" && <TrackChip label="Forced" color="error" />}
                                                {sub.defaultFlag === "Yes" && <TrackChip label="Default" color="primary" />}
                                            </Box>
                                            <InfoRow label="Format" value={`${sub.format}${sub.codecID ? ` (${sub.codecID})` : ''}`} />
                                            <InfoRow label="Bitrate" value={sub.bitRate || 'N/A'} />
                                        </InfoSection>
                                    </Grid>
                                ))}
                            </Grid>
                            {mediaInfo.subtitle.length > 4 && (
                                <Typography variant="caption" color="text.secondary">
                                    +{mediaInfo.subtitle.length - 4} more
                                </Typography>
                            )}
                        </Box>
                    </Grid>
                )}

                {/* Seasons Information */}
                {mediaInfo.seasons?.length > 0 && (
                    <Grid item xs={12}>
                        <Divider sx={{ my: 1.5, bgcolor: 'divider' }} />
                        <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Seasons</Typography>
                        <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                            {mediaInfo.seasons.map((season) => (
                                <Box key={season.id} mb={1}>
                                    <Button
                                        fullWidth
                                        onClick={() => toggleSeason(season.id)}
                                        startIcon={
                                            <ChevronRight sx={{
                                                transform: expandedSeasons[season.id] ? "rotate(90deg)" : "rotate(0deg)",
                                                transition: "transform 0.3s"
                                            }} />
                                        }
                                        sx={{
                                            justifyContent: "flex-start",
                                            textTransform: "none",
                                            color: 'text.secondary',
                                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                                        }}
                                    >
                                        {season.name}
                                    </Button>
                                    <Collapse in={expandedSeasons[season.id]}>
                                        <Box pl={3}>
                                            {season.episodes?.map((ep) => (
                                                <Typography
                                                    key={ep.id}
                                                    variant="body2"
                                                    color="text.secondary"
                                                    mb={0.5}
                                                    sx={{ '&:hover': { color: 'text.primary' } }}
                                                >
                                                    {ep.number}. {ep.title}
                                                </Typography>
                                            ))}
                                        </Box>
                                    </Collapse>
                                </Box>
                            ))}
                        </Box>
                    </Grid>
                )}
            </Grid>
        </CardContent>
    );
};