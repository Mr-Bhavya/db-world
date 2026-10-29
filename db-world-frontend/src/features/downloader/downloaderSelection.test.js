import { describe, expect, it } from 'vitest';
import { newSelection, outputSummary, requestFor, selectedSize, selectionError, trackLabel } from './downloaderSelection';

const preview = {
  entries: [],
  videoFormats: [{ id: '401', height: 4320, codec: 'av01.0', fps: 60, extension: 'mp4', bytes: 8000 }],
  audioFormats: [{ id: '251', codec: 'opus', extension: 'webm', bitrate: 128, bytes: 2000 }],
};

describe('downloader selection', () => {
  it('starts in recommended video mode', () => {
    const selection = newSelection();
    expect(outputSummary(selection, preview)).toBe('Recommended');
    expect(requestFor(selection, preview, 'https://example.com/video', []).preset).toBe('recommended');
  });

  it('keeps draft video choices while omitting them from music requests', () => {
    const selection = { ...newSelection(), mode: 'audio', audioPreset: 'mp3', videoFormat: '401', audioFormat: '251', container: 'webm', subtitles: true };
    expect(requestFor(selection, preview, 'url', [])).toMatchObject({ preset: 'mp3', videoFormat: null, audioFormat: '251', container: 'auto', subtitles: false });
    expect(selection.videoFormat).toBe('401');
    expect(outputSummary(selection, preview)).toBe('MP3');
  });

  it('validates actual codec combinations and missing tracks', () => {
    const selection = { ...newSelection(), videoFormat: '401', audioFormat: '251', container: 'webm' };
    expect(selectionError(selection, preview)).toBe('');
    expect(selectionError({ ...selection, container: 'mp4' }, preview)).toContain('codecs');
    expect(selectionError({ ...selection, videoFormat: 'missing' }, preview)).toContain('no longer available');
    expect(outputSummary(selection, preview)).toBe('Manual tracks');
    expect(selectedSize(selection, preview)).toBe(10000);
    expect(trackLabel(preview.videoFormats[0])).toContain('8K');
  });

  it('uses item URLs and presets for playlists, never shared exact IDs', () => {
    const playlist = { ...preview, entries: [{ url: 'one' }, { url: 'two' }] };
    expect(requestFor({ ...newSelection(), videoFormat: '401', audioFormat: '251' }, playlist, 'playlist', ['two']))
      .toMatchObject({ urls: ['two'], videoFormat: null, audioFormat: null });
  });

  it('validates clip ranges before submission', () => {
    expect(selectionError({ ...newSelection(), startSeconds: '30', endSeconds: '10' }, preview)).toContain('End time');
    expect(selectionError({ ...newSelection(), startSeconds: '0', endSeconds: '10' }, preview)).toBe('');
  });
});