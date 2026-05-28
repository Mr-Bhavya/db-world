import React from 'react';
import { Box } from '@mui/material';
import { ScrollContainer, SectionTitle } from './CustomComponents';

const VideoTrailers = ({ videos }) => {
    const youtubeVideos = (videos || []).filter(video => video.site === 'YouTube');
    if (youtubeVideos.length === 0) return null;

    return (
        <Box sx={{ width: '100%' }}>
            <SectionTitle>Trailers</SectionTitle>
            <ScrollContainer>
                {youtubeVideos.map((video) => (
                    <Box
                        key={video.id}
                        sx={{
                            position: 'relative',
                            width: 300,
                            flex: '0 0 auto',
                            aspectRatio: '16 / 9',
                            borderRadius: 2,
                            overflow: 'hidden'
                        }}
                    >
                        <iframe
                            src={`https://www.youtube.com/embed/${video.key}`}
                            title={video.name}
                            allowFullScreen
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 'none',
                            }}
                        />
                    </Box>
                ))}
            </ScrollContainer>
        </Box>
    );
};

export default VideoTrailers;