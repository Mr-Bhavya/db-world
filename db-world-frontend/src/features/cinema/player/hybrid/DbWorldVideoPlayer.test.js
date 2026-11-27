import { describe, expect, it } from 'vitest';

import { webAudioTracks, webTextTracks } from './DbWorldVideoPlayer';

describe('web player track metadata fallback', () => {
  it('keeps backend audio metadata when browser audioTracks is unavailable', () => {
    expect(webAudioTracks([
      { language: 'Hindi', format: 'E-AC-3', channels: 6, bitRate: 640000 },
    ])).toEqual([
      expect.objectContaining({
        language: 'Hindi',
        channels: 6,
        unavailableOnWeb: true,
      }),
    ]);
  });

  it('keeps embedded subtitle metadata visible but read-only', () => {
    expect(webTextTracks([
      { language: 'English', format: 'S_TEXT/UTF8', forced: 'No' },
    ])).toEqual([
      expect.objectContaining({
        language: 'English',
        unavailableOnWeb: true,
      }),
    ]);
  });
});
