import React from 'react';
import { CardContent, Grid, useMediaQuery, useTheme } from '@mui/material';
import MediaCarousel from './MediaCarousel';
import VideoTrailers from './VideoTrailers';
import { DetailCard, SectionTitle } from './CustomComponents';

const MediaSection = ({ record }) => {
    const theme = useTheme();
    const isMdDown = useMediaQuery(theme.breakpoints.down('md'));

    // Use common object for movie/series (normalized at fetch time into record.tmdb)
    const tmdb = record?.tmdb || record?.movieTmdb || record?.seriesTmdb || {};
    const posters = tmdb?.images?.posters || [];
    const backdrops = tmdb?.images?.backdrops || [];
    const videos = tmdb?.videos || [];

    return (
        <DetailCard sx={{ mt: 3 }}>
            <CardContent sx={{ width: '100%' }}>
                <SectionTitle>Media</SectionTitle>

                <Grid container spacing={2}>
                    {/* Posters */}
                    <Grid item xs={12} md={isMdDown ? 6 : 4}>
                        <MediaCarousel
                            items={posters}
                            type="poster"
                            title="Posters"
                            fixedHeight={isMdDown ? 240 : 320}
                        />
                    </Grid>

                    {/* Backdrops */}
                    <Grid item xs={12} md={isMdDown ? 6 : 4}>
                        <MediaCarousel
                            items={backdrops}
                            type="backdrop"
                            title="Backdrops"
                            fixedHeight={isMdDown ? 240 : 320}
                        />
                    </Grid>

                    {/* Trailers */}
                    <Grid item xs={12} md={isMdDown ? 12 : 4}>
                        <VideoTrailers videos={videos} />
                    </Grid>
                </Grid>
            </CardContent>
        </DetailCard>
    );
};

export default MediaSection;
