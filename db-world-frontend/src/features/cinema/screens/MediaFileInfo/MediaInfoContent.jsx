import React, { useState, useMemo } from "react";
import CommonServices from '@shared/services/CommonServices';
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
    Button,
    Tooltip,
    Avatar
} from "@mui/material";
import {
    ChevronRight,
    ExpandMore,
    ExpandLess,
    Videocam,
    Audiotrack,
    Subtitles,
    Info,
    Folder,
    Movie
} from "@mui/icons-material";
import Constants from '@shared/constants';

export const MediaInfoContent = ({ mediaInfo }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    const [expandedSeasons, setExpandedSeasons] = useState({});
    const [expandedSections, setExpandedSections] = useState({
        audio: false,
        subtitles: false,
        seasons: false
    });

    const toggleSeason = (seasonId) => {
        setExpandedSeasons((prev) => ({ ...prev, [seasonId]: !prev[seasonId] }));
    };

    const toggleSection = (section) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Memoized file name processing for better performance
    const processedFileName = useMemo(() => {
        const fileName = mediaInfo.general?.fileName || '';
        if (!fileName) return 'Unknown File';

        // if (isMobile && fileName.length > 40) {
        //     // Smart truncation for mobile
        //     const parts = fileName.split('.');
        //     if (parts.length > 3) {
        //         // Keep first and last parts, truncate middle
        //         return `${parts[0]}...${parts[parts.length - 1]}`;
        //     }
        //     // Simple truncation with ellipsis
        //     return fileName.substring(0, 37) + '...';
        // }
        return fileName;
        // return fileName.replace(/[._]/g, ' ');
    }, [mediaInfo.general?.fileName, isMobile]);

    // Enhanced file info extraction
    const fileInfo = useMemo(() => {
        const general = mediaInfo.general || {};
        const video = mediaInfo.video || {};

        return {
            fileName: processedFileName,
            fullFileName: general.fileName,
            format: `${general.format || 'N/A'} ${general.formatVersion ? `(v${general.formatVersion})` : ''}`,
            size: general.fileSize,
            duration: general.duration ? CommonServices.formatDuration(general.duration) : 'N/A',
            bitrate: general.overallBitrate,
            framerate: general.frameRate ? `${general.frameRate} fps` : 'N/A',
            videoResolution: video.resolution,
            videoProfile: video.formatProfile,
            videoCodec: video.format,
            videoBitrate: video.bitRate ?
                `${CommonServices.bytesToReadbleFormat(video.bitRate).value} ${CommonServices.bytesToReadbleFormat(video.bitRate).suffix}/s` :
                'N/A',
            videoColor: `${video.colorSpace || 'N/A'} ${video.chromaSubsampling || ''} ${video.bitDepth ? `(${video.bitDepth}-bit)` : ''}`.trim(),
            hdrDetails: video.hdrDetails
        };
    }, [mediaInfo, processedFileName]);

    // Reusable Info Section Component
    const InfoSection = ({
        title,
        color = 'primary',
        children,
        icon,
        expandable = false,
        defaultExpanded = false,
        sx = {}
    }) => {
        const isExpanded = expandable ? expandedSections[title.toLowerCase()] ?? defaultExpanded : true;

        return (
            <Box
                sx={{
                    p: { xs: 1, sm: 1.5 },
                    bgcolor: alpha(theme.palette.background.default, 0.5),
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
                    borderLeft: `4px solid ${theme.palette[color].main}`,
                    mb: 1.5,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        borderColor: alpha(theme.palette[color].main, 0.4),
                        boxShadow: `0 2px 8px ${alpha(theme.palette[color].main, 0.1)}`
                    },
                    ...sx
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: expandable && !isExpanded ? 0 : 1
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {icon && React.cloneElement(icon, {
                            sx: { fontSize: 18, color: theme.palette[color].main }
                        })}
                        <Typography
                            variant="subtitle2"
                            color={color}
                            sx={{ fontWeight: 600 }}
                        >
                            {title}
                        </Typography>
                    </Box>

                    {expandable && (
                        <IconButton
                            size="small"
                            onClick={() => toggleSection(title.toLowerCase())}
                            sx={{
                                color: theme.palette[color].main,
                                p: 0.5
                            }}
                        >
                            {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                    )}
                </Box>

                {expandable ? (
                    <Collapse in={isExpanded} timeout="auto">
                        {children}
                    </Collapse>
                ) : (
                    children
                )}
            </Box>
        );
    };

    // Reusable Info Row Component
    const InfoRow = ({ label, value, tooltip, sx = {} }) => (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    minWidth: { xs: '70px', sm: '90px' },
                    mr: 1,
                    flexShrink: 0
                }}
            >
                {label}:
            </Typography>
            <Tooltip title={tooltip || value} placement="top" arrow>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        flex: 1,
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        ...sx
                    }}
                >
                    {value || 'N/A'}
                </Typography>
            </Tooltip>
        </Box>
    );

    // Reusable Track Chip Component
    const TrackChip = ({ label, color = 'default', icon }) => (
        <Chip
            icon={icon}
            label={label}
            size="small"
            color={color}
            variant="outlined"
            sx={{
                height: 22,
                fontSize: '0.6rem',
                mx: 0.5,
                '& .MuiChip-icon': { fontSize: '0.8rem' }
            }}
        />
    );

    // Compact Grid for mobile
    const CompactGrid = ({
        children,
        layout = "auto", // "auto" | "dense" | "balanced"
        maxColumns = { xs: 1, sm: 2, md: 3, lg: 4 },
        spacing = { xs: 1, sm: 1.5, md: 2 },
        sx = {}
    }) => {
        const theme = useTheme();

        // Smart column calculation based on content and screen size
        const getResponsiveConfig = () => {
            const childCount = React.Children.count(children);

            return {
                // Mobile: Always single column for best readability
                xs: 12,

                // Tablet: 2 columns for most content, 1 for very wide items
                sm: childCount <= 2 ? 12 : 6,

                // Small desktop: 2-3 columns based on content density
                md: layout === "dense" && childCount > 4 ? 4 : 6,

                // Large desktop: 3-4 columns
                lg: layout === "dense" && childCount > 6 ? 3 : 4,

                // Extra large: Up to 4 columns
                xl: layout === "dense" && childCount > 8 ? 3 : 4
            };
        };

        const gridConfig = getResponsiveConfig();

        return (
            <Grid
                container
                spacing={spacing.xs || 1}
                sx={{
                    // Optimize for touch devices
                    '& .MuiGrid-item': {
                        display: 'flex',
                        flexDirection: 'column',
                        // Ensure touch targets are adequate on mobile
                        minHeight: { xs: 'auto', sm: 'unset' }
                    },
                    // Prevent overflow on small screens
                    overflow: 'hidden',
                    ...sx
                }}
            >
                {React.Children.map(children, (child, index) => (
                    <Grid
                        item
                        xs={gridConfig.xs}
                        sm={gridConfig.sm}
                        md={gridConfig.md}
                        lg={gridConfig.lg}
                        xl={gridConfig.xl}
                        key={index}
                    >
                        {child}
                    </Grid>
                ))}
            </Grid>
        );
    };

    if (!mediaInfo) return null;

    return (
        <CardContent sx={{
            py: { xs: 1, sm: 2 },
            px: { xs: 1.5, sm: 2 },
            maxHeight: '70vh',
            overflow: 'auto',
            '&::-webkit-scrollbar': {
                width: '6px'
            },
            '&::-webkit-scrollbar-track': {
                background: alpha(theme.palette.background.default, 0.5)
            },
            '&::-webkit-scrollbar-thumb': {
                background: alpha(theme.palette.primary.main, 0.3),
                borderRadius: '3px'
            }
        }}>
            {/* File Information - Always Visible */}
            <InfoSection
                title="File Information"
                color="secondary"
                icon={<Folder />}
            >
                <Tooltip title={mediaInfo.general?.fileName} placement="top" arrow>
                    <InfoRow
                        label="Name"
                        value={fileInfo.fileName}
                        sx={{
                            fontFamily: 'monospace',
                            fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                            bgcolor: alpha(theme.palette.background.paper, 0.5),
                            p: 1,
                            borderRadius: 1,
                            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                        }}
                    />
                </Tooltip>

                <CompactGrid>
                    <InfoRow label="Format" value={fileInfo.format} />
                    <InfoRow label="Size" value={fileInfo.size} />
                    <InfoRow label="Duration" value={fileInfo.duration} />
                    <InfoRow label="Bitrate" value={fileInfo.bitrate} />
                    <InfoRow label="Framerate" value={fileInfo.framerate} />
                </CompactGrid>
            </InfoSection>

            {/* Video Information */}
            {mediaInfo.video && (
                <InfoSection
                    title="Video"
                    color="primary"
                    icon={<Videocam />}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {fileInfo.videoResolution || 'N/A'}
                        </Typography>
                        {fileInfo.videoProfile && (
                            <TrackChip label={fileInfo.videoProfile} color="primary" />
                        )}
                        {fileInfo.hdrDetails && (
                            <TrackChip label="HDR" color="warning" />
                        )}
                    </Box>

                    <CompactGrid>
                        <InfoRow label="Codec" value={fileInfo.videoCodec} />
                        <InfoRow label="Bitrate" value={fileInfo.videoBitrate} />
                        <InfoRow label="Color" value={fileInfo.videoColor} />
                        {fileInfo.hdrDetails && (
                            <InfoRow label="HDR Format" value={fileInfo.hdrDetails} />
                        )}
                    </CompactGrid>
                </InfoSection>
            )}

            {/* Audio Information - Expandable on Mobile */}
            <InfoSection
                title={`Audio (${mediaInfo.audio?.length || 0})`}
                color="info"
                icon={<Audiotrack />}
                expandable={isMobile}
                defaultExpanded={!isMobile}
            >
                <Box sx={{
                    maxHeight: isMobile ? 'none' : 300,
                    overflowY: 'auto',
                    pr: 1
                }}>
                    {mediaInfo.audio?.slice(0, isMobile ? 8 : 6).map((a, i) => (
                        <Box
                            key={i}
                            sx={{
                                p: 1,
                                mb: 1,
                                bgcolor: alpha(theme.palette.info.main, 0.05),
                                borderRadius: 1,
                                border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {a.language || `Audio ${i + 1}`}
                                </Typography>
                                {a.channels && (
                                    <TrackChip
                                        label={CommonServices.getChannelDescription(a.channels)}
                                        color="info"
                                    />
                                )}
                                {a.default === "Yes" && (
                                    <TrackChip label="Default" color="primary" />
                                )}
                            </Box>

                            <CompactGrid>
                                <InfoRow label="Format" value={a.format} />
                                <InfoRow label="Bitrate" value={a.bitRate} />
                                {a.samplingRate && (
                                    <InfoRow label="Sample Rate" value={`${Math.round(a.samplingRate / 1000)} kHz`} />
                                )}
                                {a.channelLayout && (
                                    <InfoRow label="Layout" value={a.channelLayout} />
                                )}
                            </CompactGrid>
                        </Box>
                    ))}

                    {mediaInfo.audio?.length > (isMobile ? 8 : 6) && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                            +{mediaInfo.audio.length - (isMobile ? 8 : 6)} more audio tracks
                        </Typography>
                    )}
                </Box>
            </InfoSection>

            {/* Subtitles Information - Expandable on Mobile */}
            {mediaInfo.subtitle?.length > 0 && (
                <InfoSection
                    title={`Subtitles (${mediaInfo.subtitle.length})`}
                    color="success"
                    icon={<Subtitles />}
                    expandable={isMobile}
                    defaultExpanded={!isMobile}
                >
                    <Box sx={{
                        maxHeight: isMobile ? 'none' : 200,
                        overflowY: 'auto'
                    }}>
                        <Grid container spacing={1}>
                            {mediaInfo.subtitle.slice(0, isMobile ? 6 : 4).map((sub, i) => (
                                <Grid item xs={12} sm={6} key={i}>
                                    <Box
                                        sx={{
                                            p: 1,
                                            bgcolor: alpha(theme.palette.success.main, 0.05),
                                            borderRadius: 1,
                                            border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {sub.language || `Sub ${i + 1}`}
                                            </Typography>
                                            {sub.forced === "Yes" && (
                                                <TrackChip label="Forced" color="error" />
                                            )}
                                            {sub.defaultFlag === "Yes" && (
                                                <TrackChip label="Default" color="primary" />
                                            )}
                                        </Box>
                                        <CompactGrid>
                                            <InfoRow label="Format" value={`${sub.format}${sub.codecID ? ` (${sub.codecID})` : ''}`} />
                                            <InfoRow label="Bitrate" value={sub.bitRate || 'N/A'} />
                                        </CompactGrid>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>

                        {mediaInfo.subtitle.length > (isMobile ? 6 : 4) && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                                +{mediaInfo.subtitle.length - (isMobile ? 6 : 4)} more subtitles
                            </Typography>
                        )}
                    </Box>
                </InfoSection>
            )}

            {/* Seasons Information - Expandable on Mobile */}
            {mediaInfo.seasons?.length > 0 && (
                <InfoSection
                    title={`Seasons (${mediaInfo.seasons.length})`}
                    color="warning"
                    icon={<Movie />}
                    expandable={isMobile}
                    defaultExpanded={!isMobile}
                >
                    <Box sx={{ maxHeight: isMobile ? 'none' : 300, overflowY: 'auto' }}>
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
                                        bgcolor: alpha(theme.palette.warning.main, 0.05),
                                        borderRadius: 1,
                                        py: 1,
                                        px: 2,
                                        '&:hover': {
                                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                                            color: 'text.primary'
                                        }
                                    }}
                                >
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {season.name}
                                    </Typography>
                                </Button>
                                <Collapse in={expandedSeasons[season.id]}>
                                    <Box sx={{ pl: 3, pt: 1 }}>
                                        {season.episodes?.map((ep) => (
                                            <Box
                                                key={ep.id}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    py: 0.5,
                                                    px: 1,
                                                    borderRadius: 0.5,
                                                    '&:hover': {
                                                        bgcolor: alpha(theme.palette.warning.main, 0.05)
                                                    }
                                                }}
                                            >
                                                <Avatar
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        bgcolor: theme.palette.warning.main,
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {ep.number}
                                                </Avatar>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        flex: 1,
                                                        '&:hover': { color: 'text.primary' }
                                                    }}
                                                >
                                                    {ep.title}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </Collapse>
                            </Box>
                        ))}
                    </Box>
                </InfoSection>
            )}
        </CardContent>
    );
};