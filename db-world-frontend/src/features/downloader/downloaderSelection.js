export const VIDEO_PRESETS = [
  { value: 'recommended', label: 'Recommended', detail: 'Up to 1080p', icon: 'recommended' },
  { value: 'best', label: 'Best available', detail: 'Highest source quality', icon: 'best' },
  { value: 'small', label: 'Smaller file', detail: 'Up to 720p', icon: 'small' },
];

export const AUDIO_PRESETS = [
  { value: 'audio', label: 'Original audio', detail: 'No re-encoding', icon: 'audio' },
  { value: 'mp3', label: 'MP3', detail: 'Broad compatibility', icon: 'music' },
  { value: 'm4a', label: 'M4A', detail: 'AAC audio', icon: 'music' },
];

export function newSelection() {
  return {
    mode: 'video', videoPreset: 'recommended', audioPreset: 'audio', quality: '1080',
    videoFormat: '', audioFormat: '', container: 'auto', subtitles: false, thumbnailFile: false,
    subtitleLanguage: 'en', audioLanguage: '', startSeconds: '', endSeconds: '',
  };
}

export function resolutionLabel(height) {
  return `${height}p${height === 4320 ? ' / 8K' : height === 2160 ? ' / 4K' : ''}`;
}

export function trackLabel(track) {
  if (!track) return 'Automatic';
  return [
    track.height && resolutionLabel(track.height), track.fps && `${track.fps} fps`,
    track.language, track.codec?.split('.')[0].toUpperCase(), track.extension?.toUpperCase(),
    track.bitrate && `${Math.round(track.bitrate)} kbps`, track.channels && `${track.channels} ch`,
    track.dynamicRange && track.dynamicRange !== 'SDR' && track.dynamicRange,
  ].filter(Boolean).join(' / ');
}

export function selectedTracks(selection, preview) {
  if (preview?.entries?.length) return { video: null, audio: null };
  return {
    video: selection.mode === 'video' ? preview?.videoFormats?.find((track) => track.id === selection.videoFormat) : null,
    audio: preview?.audioFormats?.find((track) => track.id === selection.audioFormat),
  };
}

export function selectionError(selection, preview) {
  const { video, audio } = selectedTracks(selection, preview);
  const playlist = !!preview?.entries?.length;
  if (!playlist && ((selection.mode === 'video' && selection.videoFormat && !video) || (selection.audioFormat && !audio))) {
    return 'A selected track is no longer available. Inspect the URL again.';
  }
  if (selection.mode === 'video' && ['mp4', 'webm'].includes(selection.container)) {
    if (!video || !audio) return 'Select both tracks before choosing MP4 or WebM.';
    const compatible = selection.container === 'mp4'
      ? /^(avc|h264|hev|hvc|av01|hevc)/i.test(video.codec) && /^(mp4a|aac)/i.test(audio.codec)
      : /^(vp0?8|vp0?9|av01)/i.test(video.codec) && /^(opus|vorbis)/i.test(audio.codec);
    if (!compatible) return 'These codecs do not fit this container. Choose Auto or MKV.';
  }
  const start = selection.startSeconds === '' ? 0 : Number(selection.startSeconds);
  const end = selection.endSeconds === '' ? null : Number(selection.endSeconds);
  if (!Number.isFinite(start) || start < 0 || (end !== null && (!Number.isFinite(end) || end <= start))) {
    return 'End time must be after start time.';
  }
  return '';
}

export function requestFor(selection, preview, url, selected) {
  const audioOnly = selection.mode === 'audio';
  const playlist = !!preview?.entries?.length;
  return {
    urls: playlist ? selected : [url],
    preset: audioOnly ? selection.audioPreset : selection.videoPreset,
    quality: selection.quality,
    videoFormat: !audioOnly && !playlist ? selection.videoFormat || null : null,
    audioFormat: !playlist ? selection.audioFormat || null : null,
    container: audioOnly ? 'auto' : selection.container,
    audioLanguage: !playlist && selection.audioFormat ? '' : selection.audioLanguage,
    subtitles: !audioOnly && selection.subtitles,
    thumbnailFile: selection.thumbnailFile,
    subtitleLanguage: selection.subtitleLanguage,
    startSeconds: selection.startSeconds === '' ? null : Number(selection.startSeconds),
    endSeconds: selection.endSeconds === '' ? null : Number(selection.endSeconds),
  };
}

export function outputSummary(selection, preview) {
  const { video, audio } = selectedTracks(selection, preview);
  if (selection.mode === 'audio') return AUDIO_PRESETS.find((preset) => preset.value === selection.audioPreset)?.label || 'Audio only';
  if (video || audio) return 'Manual tracks';
  if (selection.videoPreset === 'custom') return `Up to ${resolutionLabel(Number(selection.quality))}`;
  return VIDEO_PRESETS.find((preset) => preset.value === selection.videoPreset)?.label || 'Video';
}

export function selectedSize(selection, preview) {
  const { video, audio } = selectedTracks(selection, preview);
  if (selection.mode === 'audio' && audio?.bytes && selection.audioPreset === 'audio') return audio.bytes;
  if (selection.mode === 'video' && video?.bytes && audio?.bytes) return video.bytes + audio.bytes;
  return null;
}