import { describe, it, expect } from 'vitest';
import { mediaInfoOf, videoSpecs, fileSpecs, techBadges, qualityLabel, variantDetail } from './mediaSpecs';

/** A converted MediaInfo (what the record page reads for a file). */
const info = {
  general: {
    fileName: 'Show.S01E01.2160p.mkv', format: 'Matroska', formatVersion: 'Version 4',
    fileSize: '8.42 GB', overallBitrate: '12.1 MB/s', duration: 3120,
    encodedLibrary: 'x265 3.5', isStreamable: true,
  },
  video: {
    resolution: '3840x2160', aspectRatio: '16:9', format: 'HEVC (V_MPEGH/ISO/HEVC)',
    formatProfile: 'Main 10', formatLevel: '5.1', bitDepth: 10,
    colourPrimaries: 'BT.2020', colorSpace: 'YUV', chromaSubsampling: '4:2:0',
    transferCharacteristics: 'PQ', hdrDetails: 'SMPTE ST 2086 | HDR10 compatible',
    frameRate: 23.976, frameRateMode: 'CFR', bitRate: 11200000, size: '7.90 GB',
  },
  audio: [{ format: 'E-AC-3 (A_EAC3)', formatCommercial: 'Dolby Digital Plus with Dolby Atmos' }],
};

const row = (rows, name) => rows.find(([k]) => k === name)?.[1];

describe('videoSpecs', () => {
  it('reports the exact geometry with the tier alongside', () => {
    expect(row(videoSpecs(info), 'Resolution')).toBe('3840 × 2160 (4K)');
  });

  it('formats the technical fields MediaInfo stores raw', () => {
    const rows = videoSpecs(info);
    expect(row(rows, 'Codec')).toBe('HEVC');
    expect(row(rows, 'Profile')).toBe('Main 10 · Level 5.1');
    expect(row(rows, 'Bit depth')).toBe('10-bit');
    expect(row(rows, 'Colour')).toBe('BT.2020 · YUV · 4:2:0');
    expect(row(rows, 'Frame rate')).toBe('23.976 fps · CFR');
    expect(row(rows, 'Bitrate')).toBe('11.2 Mb/s');
    expect(row(rows, 'HDR format')).toBe('SMPTE ST 2086 | HDR10 compatible');
  });

  it('drops rows MediaInfo could not fill instead of printing dashes', () => {
    const sparse = { video: { resolution: '1920x1080' } };
    expect(videoSpecs(sparse).map(([k]) => k)).toEqual(['Resolution']);
  });

  it('is empty without a video track', () => {
    expect(videoSpecs(null)).toEqual([]);
    expect(videoSpecs({ general: {} })).toEqual([]);
  });
});

describe('fileSpecs', () => {
  it('describes the container', () => {
    const rows = fileSpecs(info);
    expect(row(rows, 'Container')).toBe('Matroska · Version 4');
    expect(row(rows, 'Size')).toBe('8.42 GB');
    expect(row(rows, 'Duration')).toBe('52m 0s');
    expect(row(rows, 'Encoder')).toBe('x265 3.5');
    expect(row(rows, 'Fast start')).toBe('Yes');
  });

  it('omits fast start when the file is not flagged', () => {
    const rows = fileSpecs({ general: { ...info.general, isStreamable: false } });
    expect(row(rows, 'Fast start')).toBeUndefined();
  });
});

describe('techBadges', () => {
  it('matches the record page: resolution, HDR, object audio, codec', () => {
    expect(techBadges(info).map(b => b.label)).toEqual(['4K', 'HDR10', 'ATMOS', 'H.265']);
  });

  it('fills only the resolution chip', () => {
    expect(techBadges(info).map(b => b.filled)).toEqual([true, false, false, false]);
  });

  it('skips what the file does not have', () => {
    const plain = { general: { fileName: 'Movie.720p.mkv' }, video: { resolution: '1280x720' }, audio: [] };
    expect(techBadges(plain).map(b => b.label)).toEqual(['720p']);
  });

  it('is empty without MediaInfo', () => {
    expect(techBadges(null)).toEqual([]);
  });
});

describe('mediaInfoOf', () => {
  it('converts the raw MediaFileDto the resolve endpoint returns', () => {
    const dto = {
      id: 'abc', fileName: 'Ep.mkv',
      tracks: [
        { type: 'General', format: 'Matroska', fileSize: 1073741824, duration: 60000 },
        { type: 'Video', width: 1920, height: 1080, format: 'AVC', duration: 60000, bitDepth: 8 },
        { type: 'Audio', format: 'AAC', channels: 2 },
      ],
    };
    const converted = mediaInfoOf(dto);

    expect(converted.video.resolution).toBe('1920x1080');
    expect(converted.audio).toHaveLength(1);
    expect(row(videoSpecs(converted), 'Resolution')).toBe('1920 × 1080 (1080p)');
  });

  it('returns null when the resolve carried no file', () => {
    expect(mediaInfoOf(null)).toBeNull();
  });
});

describe('qualityLabel', () => {
  it('names bit depth only above 8, so two 1080p masters read differently', () => {
    const base = { label: '1080p', codec: 'H.265', hdr: [] };
    expect(qualityLabel({ ...base, depth: 8 })).toBe('1080p · H.265');
    expect(qualityLabel({ ...base, depth: 10 })).toBe('1080p · H.265 · 10-bit');
  });

  it('keeps the HDR tags last', () => {
    expect(qualityLabel({ label: '4K', codec: 'H.265', depth: 10, hdr: ['DV', 'HDR10'] }))
      .toBe('4K · H.265 · 10-bit · DV · HDR10');
  });

  it('skips whatever is missing', () => {
    expect(qualityLabel({ label: '720p' })).toBe('720p');
  });
});

describe('variantDetail', () => {
  it('spells out the geometry and bitrate the tier label hides', () => {
    expect(variantDetail({ resolution: '1920x1080', bitRate: 8_400_000 }))
      .toBe('1920 × 1080 · 8.4 Mb/s');
  });

  it('shows whichever half MediaInfo knows', () => {
    expect(variantDetail({ resolution: '1280x720' })).toBe('1280 × 720');
    expect(variantDetail({ bitRate: 2_500_000 })).toBe('2.5 Mb/s');
    expect(variantDetail({})).toBe('');
  });
});
