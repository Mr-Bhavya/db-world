import React, { useState } from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import LazyImage from '../shared/LazyImage';
import VideoDialog from '../shared/VideoDialog';
import ImageLightbox from '../shared/ImageLightbox';

const VISIBLE_IMAGES = 12;

export default function GallerySection({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const videos = tmdb.videos ?? [];
  const allImages = tmdb.images ?? [];

  const [activeVideo, setActiveVideo] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [showAllImages, setShowAllImages] = useState(false);

  const trailers    = videos.filter((v) => v.type === 'Trailer' || v.type === 'Teaser');
  const otherVideos = videos.filter((v) => v.type !== 'Trailer' && v.type !== 'Teaser');

  const imageGroups = allImages.reduce((acc, img) => {
    const type = img.imageType ?? 'Image';
    if (!acc[type]) acc[type] = [];
    acc[type].push(img);
    return acc;
  }, {});
  const imageGroupOrder = ['Backdrop', 'Poster', 'Still', 'Logo'];
  const sortedImageKeys = [
    ...imageGroupOrder.filter((k) => imageGroups[k]),
    ...Object.keys(imageGroups).filter((k) => !imageGroupOrder.includes(k)),
  ];

  const renderVideoRow = (list, label) => {
    if (!list.length) return null;
    return (
      <Box sx={{ mb: 4 }}>
        <SectionHeading>{label}</SectionHeading>
        <Box sx={{
          display: 'flex', gap: 2, overflowX: 'auto', pb: 1,
          scrollbarWidth: 'thin', scrollbarColor: `${alpha(T.text, 0.2)} transparent`,
          '&::-webkit-scrollbar': { height: 5 },
          '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
        }}>
          {list.map((v, i) => {
            const isYT = v.site === 'YouTube';
            const thumb = isYT ? `https://img.youtube.com/vi/${v.key}/hqdefault.jpg` : null;
            return (
              <Box
                key={v.key ?? i}
                component={motion.div}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.15 }}
                onClick={() => setActiveVideo(v)}
                sx={{
                  flexShrink: 0, width: { xs: 220, md: 260 },
                  bgcolor: T.glass, borderRadius: 2, overflow: 'hidden',
                  border: `1px solid ${alpha(T.text, 0.07)}`,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color .15s',
                  '&:hover': { boxShadow: '0 12px 32px rgba(0,0,0,0.4)', borderColor: alpha(T.teal, 0.4) },
                }}
              >
                <Box sx={{ position: 'relative', width: '100%', height: 140 }}>
                  {thumb ? (
                    <Box component="img" src={thumb} alt={v.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Box sx={{ width: '100%', height: '100%', bgcolor: alpha(T.text, 0.06), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayArrowIcon sx={{ fontSize: 48, color: alpha(T.text, 0.2) }} />
                    </Box>
                  )}
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
                    <Box sx={{
                      width: 48, height: 48, borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.25)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(4px)',
                      transition: 'transform .15s, background .15s',
                    }}>
                      <PlayArrowIcon sx={{ color: '#fff', fontSize: 28 }} />
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ p: 1.25 }}>
                  <Typography variant="body2" sx={{ color: T.text, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.82rem' }}>
                    {v.name}
                  </Typography>
                  <Chip label={v.type} size="small" sx={{ mt: 0.75, bgcolor: alpha(T.teal, 0.12), color: T.teal, fontSize: '0.65rem', height: 18 }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      {renderVideoRow(trailers, 'Trailers & Teasers')}
      {renderVideoRow(otherVideos, 'Other Videos')}
      {videos.length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint, mb: 4 }}>No videos available.</Typography>
      )}

      {sortedImageKeys.map((type) => {
        const imgs = imageGroups[type];
        const visible = showAllImages ? imgs : imgs.slice(0, VISIBLE_IMAGES);
        const isPortrait = type === 'Poster';
        return (
          <Box key={type} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <SectionHeading sx={{ mb: 0 }}>{type}s</SectionHeading>
              <Typography variant="caption" sx={{ color: T.textFaint }}>{imgs.length} images</Typography>
            </Box>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: isPortrait
                ? { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(6, 1fr)' }
                : { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1,
            }}>
              {visible.map((img, i) => (
                <LazyImage
                  key={i}
                  src={tmdbImg(img.filePath, 'w500')}
                  alt={type}
                  onClick={() => setLightbox({ images: imgs, startIndex: i })}
                  sx={{
                    borderRadius: 1.5,
                    aspectRatio: isPortrait ? '2/3' : '16/9',
                    border: `1px solid ${alpha(T.text, 0.07)}`,
                    transition: 'transform 0.15s, box-shadow .15s',
                    '&:hover': { transform: 'scale(1.03)', zIndex: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
                  }}
                />
              ))}
            </Box>
            {imgs.length > VISIBLE_IMAGES && (
              <Button
                size="small"
                onClick={() => setShowAllImages((v) => !v)}
                sx={{ mt: 1.5, color: T.teal, textTransform: 'none', fontSize: '0.82rem' }}
              >
                {showAllImages ? 'Show less' : `Show all ${imgs.length} images`}
              </Button>
            )}
          </Box>
        );
      })}

      {allImages.length === 0 && videos.length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint }}>No gallery content available.</Typography>
      )}

      {activeVideo && <VideoDialog video={activeVideo} onClose={() => setActiveVideo(null)} />}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          onClose={() => setLightbox(null)}
        />
      )}
    </Box>
  );
}
