import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';

import { getQuality, getCodec, getHdrTags, objectAudioTag, qualityRank } from '../../../media/helpers';
import { QBadge, HdrBadge, CodecBadge } from '../../../media/Badges';

/**
 * "What do I actually get if I press play" — resolution, HDR, object audio, codec.
 * Derived from the best file on the record rather than any one variant, so a title with
 * a 4K and a 1080p copy advertises the 4K.
 *
 * The age rating used to ride along here and no longer does: it describes the title, not
 * the file, and among the tech badges a bare "A" read as one more technical tag. It now
 * sits in the hero's meta row as CertBadge, with a key of its own.
 */

export default function TechBadgeRow({ files = [], sx }) {
  const specs = useMemo(() => {
    if (!files?.length) return null;

    // Rank on quality alone — a 4K HDR copy and a 4K SDR copy are the same tier,
    // and the HDR/codec tags below are read off whichever wins.
    const best = files.reduce((winner, file) => {
      const q = getQuality(file?.video, file?.general?.fileName);
      return !winner || qualityRank(q) < qualityRank(winner.quality)
        ? { file, quality: q }
        : winner;
    }, null);

    if (!best) return null;

    const { file, quality } = best;
    return {
      quality: quality === 'Unknown' ? null : quality,
      hdrTags: getHdrTags(
        file?.video?.hdrDetails ?? file?.video?.hdrFormat ?? file?.video?.hdrFormatCompatibility,
        file?.general?.fileName,
      ),
      codec: getCodec(file?.video?.format),
      objectAudio: objectAudioTag(file?.audio),
    };
  }, [files]);

  const hasAnything = specs?.quality || specs?.hdrTags?.length || specs?.codec || specs?.objectAudio;
  if (!hasAnything) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.6, ...sx }}>
      {specs?.quality && <QBadge quality={specs.quality} />}
      {specs?.hdrTags?.map((tag) => <HdrBadge key={tag} tag={tag} />)}
      {specs?.objectAudio && (
        <Box sx={{
          display: 'inline-flex', alignItems: 'center',
          px: 0.9, py: 0.2, borderRadius: 1,
          bgcolor: alpha('#8b5cf6', 0.18), color: '#c4b5fd',
          border: `1px solid ${alpha('#8b5cf6', 0.4)}`,
          fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
        }}>
          {specs.objectAudio}
        </Box>
      )}
      {specs?.codec && <CodecBadge codec={specs.codec} />}
    </Box>
  );
}
