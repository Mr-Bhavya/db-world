import React, { useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import Carousel from 'react-material-ui-carousel';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const MediaCarousel = ({ items, type, title, fixedHeight }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [lightboxIndex, setLightboxIndex] = useState(-1);

    const handleImageClick = (index) => {
        setLightboxIndex(index);
    };

    const slides = items.map(img => ({
        src: `https://image.tmdb.org/t/p/original${img.file_path}`,
        alt: img?.title || type,
    }));

    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>{title}</Typography>

            <Carousel
                navButtonsAlwaysVisible={!isMobile}
                animation="fade"
                duration={500}
                indicatorContainerProps={{ style: { position: 'static' } }}
            >
                {items?.slice(0, 10).map((media, index) => (
                    <Box
                        key={index}
                        onClick={() => handleImageClick(index)}
                        sx={{
                            position: 'relative',
                            width: '100%',
                            height: fixedHeight || 300,
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.9 },
                        }}
                    >
                        <img
                            src={`https://image.tmdb.org/t/p/w500${media.file_path}`}
                            alt={type}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: theme.shape.borderRadius,
                            }}
                        />

                        {media.vote_average > 0 && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 8,
                                    left: 8,
                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                    padding: '4px 8px',
                                    borderRadius: 1,
                                }}
                            >
                                <Typography variant="caption" color="white">
                                    {media.vote_average.toFixed(1)} ({media.vote_count} votes)
                                </Typography>
                            </Box>
                        )}
                    </Box>
                ))}
            </Carousel>

            <Lightbox
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
                index={lightboxIndex}
                slides={slides}
                animation={{ swipe: 300 }}
                styles={{
                    container: { backgroundColor: 'rgba(0, 0, 0, 0.95)' },
                }}
            />
        </Box>
    );
};

export default MediaCarousel;
