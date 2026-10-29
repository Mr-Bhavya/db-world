import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, CircularProgress,
  Container, FormControlLabel, IconButton, InputAdornment, LinearProgress, MenuItem, Radio,
  RadioGroup, Stack, Step, StepButton, Stepper, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowBack, ArrowForward, AudioFile, CheckCircleOutline, ContentPaste, Edit, ExpandMore,
  HighQuality, Link as LinkIcon, MusicNote, Queue, Search, Tune, VideoFile,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { createMediaJobs, DOWNLOADS_KEY, errorMessage, formatBytes, inspectMedia } from './downloaderApi';
import {
  AUDIO_PRESETS, VIDEO_PRESETS, newSelection, outputSummary, requestFor, resolutionLabel,
  selectedSize, selectedTracks, selectionError, trackLabel,
} from './downloaderSelection';

const steps = ['Link', 'Content', 'Output', 'Review'];
const icons = { recommended: CheckCircleOutline, best: HighQuality, small: VideoFile, audio: AudioFile, music: MusicNote };

export default function MediaDownloader() {
  const T = useT();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const [url, setUrl] = useState(params.get('url') || '');
  const [playlist, setPlaylist] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [selection, setSelection] = useState(newSelection);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef(null);
  const submittingRef = useRef(false);
  const entries = preview?.entries || [];
  const isPlaylist = entries.length > 0;
  const count = isPlaylist ? selected.length : preview ? 1 : 0;
  const issue = preview ? selectionError(selection, preview) : '';
  const audioOnly = selection.mode === 'audio';
  const { video, audio } = selectedTracks(selection, preview);
  const filtered = entries.filter((entry) => (entry.title || entry.url).toLowerCase().includes(query.toLowerCase()));
  const update = (patch) => { setSelection((previous) => ({ ...previous, ...patch })); setError(''); };

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  const invalidate = () => {
    setPreview(null); setSelected([]); setFurthest(0); setStep(0); setError(''); setQuery('');
    setSelection((previous) => ({ ...previous, videoFormat: '', audioFormat: '', container: 'auto', audioLanguage: '' }));
  };

  const inspect = async (event) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await inspectMedia(url.trim(), playlist);
      setPreview(result);
      setSelected([...new Set((result.entries || []).map((entry) => entry.url))]);
      setSelection((previous) => ({
        ...previous, videoFormat: '', audioFormat: '', container: 'auto', audioLanguage: '',
        quality: String(result.resolutions?.includes(1080) ? 1080 : result.resolutions?.[0] || 1080),
      }));
      setStep(1); setFurthest(1); setQuery('');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const go = (next) => {
    if (busy || submitting || (next > 0 && !preview) || (next > 1 && count === 0)) return;
    if (next === 3 && issue) { setError(issue); return; }
    setError(''); setStep(next); setFurthest((previous) => Math.max(previous, next));
  };

  const paste = async () => {
    try { const value = await navigator.clipboard.readText(); invalidate(); setUrl(value.trim()); }
    catch { setError('Clipboard access is unavailable. Paste the URL into the field.'); }
  };

  const prepare = async () => {
    if (!preview || !count || submittingRef.current) return;
    if (issue) { setError(issue); setStep(2); return; }
    submittingRef.current = true; setSubmitting(true); setError('');
    try {
      await createMediaJobs(requestFor(selection, preview, url.trim(), selected));
      await client.invalidateQueries({ queryKey: DOWNLOADS_KEY });
      navigate(Constants.DB_DOWNLOAD_CENTER_ROUTE);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };

  const choosePreset = (value) => update(audioOnly
    ? { audioPreset: value }
    : { videoPreset: value, videoFormat: '', audioFormat: '', container: 'auto' });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: T.bg, color: T.textPrimary, pt: { xs: 2, md: 4 }, pb: 2, letterSpacing: 0,
      '& .MuiInputBase-root': { color: T.textPrimary, bgcolor: T.surface || T.bg },
      '& .MuiInputLabel-root': { color: T.textMuted },
      '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
      '& .MuiFormControlLabel-label': { color: T.textPrimary },
    }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={3}>
          <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.35rem', md: '1.75rem' }, overflowWrap: 'anywhere' }}>Media Downloader</Typography>
          <Tooltip title="Open Download Center"><IconButton aria-label="Open Download Center" onClick={() => navigate(Constants.DB_DOWNLOAD_CENTER_ROUTE)} sx={{ color: T.textPrimary, width: 44, height: 44 }}><Queue /></IconButton></Tooltip>
        </Stack>

        <Stepper nonLinear activeStep={step} alternativeLabel sx={{ mb: { xs: 3, md: 4 }, '& .MuiStepLabel-label': { fontSize: '0.8rem', color: T.textMuted }, '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': { color: T.textPrimary, fontWeight: 700 }, '& .MuiStepConnector-line': { borderColor: T.border } }}>
          {steps.map((label, index) => <Step key={label} completed={furthest > index}>
            <StepButton disabled={busy || submitting || index > furthest || (index > 1 && !count)} onClick={() => go(index)} aria-current={step === index ? 'step' : undefined}>{label}</StepButton>
          </Step>)}
        </Stepper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: preview && step !== 3 ? 'minmax(0, 1fr) 280px' : 'minmax(0, 1fr)' }, gap: { xs: 2, md: 4 }, alignItems: 'start' }}>
          <Box sx={{ minWidth: 0, minHeight: { xs: 320, md: 380 } }}>
            <Typography ref={heading} tabIndex={-1} component="h2" sx={{ fontSize: '1.15rem', fontWeight: 750, mb: 2, outline: 'none' }}>
              {['Add a link', 'Choose content', 'Choose output', 'Review & prepare'][step]}
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }} role="alert">{error}</Alert>}

            {step === 0 && <Box component="form" onSubmit={inspect}>
              <TextField fullWidth required type="url" label="Video or playlist URL" value={url} disabled={busy || submitting}
                onChange={(event) => { setUrl(event.target.value); invalidate(); }}
                slotProps={{ input: {
                  startAdornment: <InputAdornment position="start"><LinkIcon sx={{ color: T.textMuted }} /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><Tooltip title="Paste URL"><span><IconButton aria-label="Paste URL" disabled={busy} onClick={paste} edge="end"><ContentPaste /></IconButton></span></Tooltip></InputAdornment>,
                } }} />
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={playlist} disabled={busy || submitting} onChange={(event) => { setPlaylist(event.target.checked); invalidate(); }} />} label="Include playlist" />
              <Box mt={2}><Button type="submit" variant="contained" disabled={busy || submitting || !url.trim()} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <Search />} sx={{ minHeight: 48, minWidth: 145 }}>{busy ? 'Inspecting' : 'Inspect'}</Button></Box>
              {busy && <LinearProgress aria-label="Inspecting media" sx={{ mt: 3 }} />}
            </Box>}

            {step === 1 && preview && <>
              <MediaPreview preview={preview} />
              {isPlaylist && <Box mt={3}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }} mb={1}>
                  <TextField size="small" fullWidth label="Search playlist" value={query} onChange={(event) => setQuery(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }} />
                  <Typography sx={{ color: T.textMuted, flexShrink: 0, fontSize: '0.85rem' }} aria-live="polite">{selected.length} of {entries.length} selected</Typography>
                </Stack>
                <FormControlLabel control={<Checkbox checked={selected.length === new Set(entries.map((entry) => entry.url)).size} indeterminate={selected.length > 0 && selected.length < new Set(entries.map((entry) => entry.url)).size}
                  onChange={(event) => setSelected(event.target.checked ? [...new Set(entries.map((entry) => entry.url))] : [])} />} label="Select all" />
                <Box sx={{ maxHeight: 390, overflowY: 'auto', borderTop: `1px solid ${T.border}` }}>
                  {filtered.map((entry, index) => <Stack key={`${entry.url}-${index}`} direction="row" alignItems="center" sx={{ borderBottom: `1px solid ${T.border}`, py: 0.75 }}>
                    <FormControlLabel sx={{ m: 0, minWidth: 0, flex: 1, '& .MuiFormControlLabel-label': { overflowWrap: 'anywhere', fontSize: '0.9rem' } }}
                      control={<Checkbox checked={selected.includes(entry.url)} onChange={(event) => setSelected((previous) => event.target.checked ? [...new Set([...previous, entry.url])] : previous.filter((value) => value !== entry.url))} />}
                      label={entry.title || entry.url} />
                    {entry.duration > 0 && <Typography sx={{ color: T.textMuted, fontSize: '0.8rem', ml: 1 }}>{duration(entry.duration)}</Typography>}
                  </Stack>)}
                  {!filtered.length && <Typography sx={{ py: 3, color: T.textMuted }}>No matching items</Typography>}
                </Box>
              </Box>}
            </>}

            {step === 2 && preview && <>
              <ToggleButtonGroup exclusive fullWidth value={selection.mode} onChange={(_, value) => value && update({ mode: value })} aria-label="Media type" sx={{ mb: 3, '& .MuiToggleButton-root': { minHeight: 48, textTransform: 'none', color: T.textMuted, borderColor: T.border }, '& .MuiToggleButton-root.Mui-selected': { color: 'primary.main', bgcolor: 'action.selected' } }}>
                <ToggleButton value="video"><VideoFile sx={{ mr: 1 }} />Video</ToggleButton>
                <ToggleButton value="audio"><MusicNote sx={{ mr: 1 }} />Audio Only</ToggleButton>
              </ToggleButtonGroup>
              <PresetOptions presets={audioOnly ? AUDIO_PRESETS : VIDEO_PRESETS} value={audioOnly ? selection.audioPreset : selection.videoFormat || selection.audioFormat ? '' : selection.videoPreset} onChange={choosePreset} />
              {audioOnly && ['mp3', 'm4a'].includes(selection.audioPreset) && <Typography sx={{ mt: 1.5, color: T.textMuted, fontSize: '0.85rem' }}><Tune sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />{selection.audioPreset === 'mp3' || !audio?.codec?.startsWith('mp4a') ? 'Audio conversion may be required' : 'AAC audio'}</Typography>}

              <Accordion expanded={advanced} onChange={(_, value) => setAdvanced(value)} disableGutters elevation={0} sx={{ mt: 3, bgcolor: 'transparent', borderBlock: `1px solid ${T.border}`, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore sx={{ color: T.textMuted }} />} sx={{ px: 0 }}><Tune sx={{ color: T.textMuted, mr: 1 }} /><Typography fontWeight={650}>Advanced</Typography></AccordionSummary>
                <AccordionDetails sx={{ px: 0, pb: 3 }}>
                  <Stack gap={2.5}>
                    {!audioOnly && <>
                      <Typography component="h3" fontSize="0.95rem" fontWeight={700}>Video</Typography>
                      <TextField select fullWidth label="Maximum resolution" value={selection.videoPreset === 'custom' && !selection.videoFormat ? selection.quality : 'auto'} disabled={!!selection.videoFormat}
                        onChange={(event) => update(event.target.value === 'auto' ? { videoPreset: 'best', videoFormat: '', container: 'auto' } : { videoPreset: 'custom', quality: event.target.value, videoFormat: '', container: 'auto' })}>
                        <MenuItem value="auto">Automatic</MenuItem>
                        {(preview.resolutions?.length ? preview.resolutions : [4320, 2160, 1440, 1080, 720, 480, 360]).map((height) => <MenuItem key={height} value={String(height)}>{resolutionLabel(height)}</MenuItem>)}
                      </TextField>
                      {!isPlaylist && <TrackSelect label="Video track" tracks={preview.videoFormats} value={selection.videoFormat} onChange={(value) => update({ videoFormat: value, container: 'auto' })} />}
                    </>}
                    <Typography component="h3" fontSize="0.95rem" fontWeight={700}>Audio</Typography>
                    {!isPlaylist && <TrackSelect label="Audio track" tracks={preview.audioFormats} value={selection.audioFormat} onChange={(value) => update({ audioFormat: value, container: 'auto' })} />}
                    {!!preview.audioLanguages?.length && <TextField select fullWidth label="Audio language" value={selection.audioLanguage} disabled={!!selection.audioFormat} onChange={(event) => update({ audioLanguage: event.target.value })}>
                      <MenuItem value="">Default</MenuItem>{preview.audioLanguages.map((language) => <MenuItem key={language} value={language}>{language}</MenuItem>)}
                    </TextField>}
                    {isPlaylist && <Typography sx={{ color: T.textMuted, fontSize: '0.85rem' }}>Automatic tracks per playlist item</Typography>}
                    {!audioOnly && <TextField select fullWidth label="Video container" value={selection.container} onChange={(event) => update({ container: event.target.value })}>
                      <MenuItem value="auto">Auto</MenuItem><MenuItem value="mkv">MKV</MenuItem>
                      <MenuItem value="mp4" disabled={!video || !audio}>MP4</MenuItem><MenuItem value="webm" disabled={!video || !audio}>WebM</MenuItem>
                    </TextField>}
                    <Typography component="h3" fontSize="0.95rem" fontWeight={700}>Extras</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }}>
                      {!audioOnly && <FormControlLabel control={<Checkbox checked={selection.subtitles} onChange={(event) => update({ subtitles: event.target.checked })} />} label="Subtitles" />}
                      <FormControlLabel control={<Checkbox checked={selection.thumbnailFile} onChange={(event) => update({ thumbnailFile: event.target.checked })} />} label="Thumbnail file" />
                    </Stack>
                    {!audioOnly && selection.subtitles && <TextField select fullWidth label="Subtitle language" value={selection.subtitleLanguage} onChange={(event) => update({ subtitleLanguage: event.target.value })}>
                      {[...new Set(['en', ...(preview.subtitleLanguages || [])])].map((language) => <MenuItem key={language} value={language}>{language}</MenuItem>)}
                    </TextField>}
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                      <TextField fullWidth type="number" label="Start time (seconds)" value={selection.startSeconds} onChange={(event) => update({ startSeconds: event.target.value })} slotProps={{ htmlInput: { min: 0, step: 0.1 } }} />
                      <TextField fullWidth type="number" label="End time (seconds)" value={selection.endSeconds} onChange={(event) => update({ endSeconds: event.target.value })} slotProps={{ htmlInput: { min: 0, step: 0.1 } }} />
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
              {issue && <Alert severity="error" sx={{ mt: 2 }} role="alert">{issue}</Alert>}
            </>}

            {step === 3 && preview && <>
              <MediaPreview preview={preview} compact />
              <SelectionSummary selection={selection} preview={preview} count={count} url={url} edit={go} />
            </>}
          </Box>
          {preview && step !== 3 && <Box component="aside" aria-label="Selection summary" sx={{ display: { xs: 'none', md: 'block' }, position: 'sticky', top: 96, pl: 3, borderLeft: `1px solid ${T.border}`, minWidth: 0 }}>
            <Typography fontWeight={700} mb={1}>Your selection</Typography>
            <SelectionSummary selection={selection} preview={preview} count={count} url={url} edit={go} compact />
          </Box>}
        </Box>

        {step > 0 && <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ position: 'sticky', bottom: 0, zIndex: 5, bgcolor: T.bg, borderTop: `1px solid ${T.border}`, mt: 3, pt: 2, pb: 'max(16px, env(safe-area-inset-bottom))' }}>
          <Button startIcon={<ArrowBack />} disabled={submitting} onClick={() => go(step - 1)} sx={{ minHeight: 48 }}>Back</Button>
          {step < 3 ? <Button variant="contained" endIcon={<ArrowForward />} disabled={!count || (step === 2 && !!issue)} onClick={() => go(step + 1)} sx={{ minHeight: 48 }}>{step === 2 ? 'Review' : 'Choose output'}</Button>
            : <Button variant="contained" startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Queue />} disabled={submitting || !count || !!issue} onClick={prepare} sx={{ minHeight: 48 }}>{submitting ? 'Adding to queue' : count === 1 ? 'Prepare File' : `Prepare ${count} Files`}</Button>}
        </Stack>}
      </Container>
    </Box>
  );
}

function MediaPreview({ preview, compact = false }) {
  const T = useT();
  return <Stack direction={{ xs: compact ? 'row' : 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }} mb={2}>
    {preview.thumbnail && <Box component="img" src={preview.thumbnail} alt="" sx={{ width: compact ? 96 : { xs: '100%', sm: 220 }, maxWidth: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />}
    <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 700, fontSize: compact ? '1rem' : '1.1rem', overflowWrap: 'anywhere' }}>{preview.title || 'Media'}</Typography>
      <Typography sx={{ color: T.textMuted, fontSize: '0.85rem', mt: 0.5 }}>{[preview.source, preview.duration > 0 && duration(preview.duration), preview.entries?.length > 0 && `${preview.entries.length} items`].filter(Boolean).join(' / ')}</Typography>
    </Box>
  </Stack>;
}

function PresetOptions({ presets, value, onChange }) {
  const T = useT();
  return <RadioGroup aria-label="Output preset" value={value} onChange={(event) => onChange(event.target.value)} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
    {presets.map((preset) => {
      const Icon = icons[preset.icon];
      return <FormControlLabel key={preset.value} value={preset.value} control={<Radio size="small" />} sx={{ m: 0, p: 1, border: '1px solid', borderColor: value === preset.value ? 'primary.main' : T.border, borderRadius: 2, minHeight: 78, minWidth: 0, alignItems: 'flex-start', bgcolor: value === preset.value ? 'action.selected' : 'transparent', '& .MuiFormControlLabel-label': { minWidth: 0, flex: 1 } }}
        label={<Box sx={{ pt: 0.5 }}><Icon sx={{ fontSize: 20, color: value === preset.value ? 'primary.main' : T.textMuted, mb: 0.5 }} /><Typography sx={{ fontSize: '0.9rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{preset.label}</Typography><Typography sx={{ color: T.textMuted, fontSize: '0.78rem', mt: 0.25 }}>{preset.detail}</Typography></Box>} />;
    })}
  </RadioGroup>;
}

function TrackSelect({ label, tracks = [], value, onChange }) {
  return <TextField select fullWidth label={label} value={value} onChange={(event) => onChange(event.target.value)}
    slotProps={{ select: { renderValue: (id) => <Typography noWrap fontSize="0.9rem">{id ? trackLabel(tracks.find((track) => track.id === id)) : 'Automatic'}</Typography> } }}>
    <MenuItem value="">Automatic</MenuItem>
    {tracks.map((track) => <MenuItem key={track.id} value={track.id} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', fontSize: '0.85rem' }}>{trackLabel(track)}{track.bytes ? ` / ${track.estimated ? '~' : ''}${formatBytes(track.bytes)}` : ''}</MenuItem>)}
  </TextField>;
}

function SelectionSummary({ selection, preview, count, url, edit, compact = false }) {
  const T = useT();
  const { video, audio } = selectedTracks(selection, preview);
  const size = selectedSize(selection, preview);
  const audioOnly = selection.mode === 'audio';
  const rows = [
    ['Content', `${count} ${count === 1 ? 'file' : 'files'}`, 1],
    ['Output', `${audioOnly ? 'Audio Only' : 'Video'} / ${outputSummary(selection, preview)}`, 2],
    ...(!audioOnly && video ? [['Video track', trackLabel(video), 2]] : []),
    ...(audio ? [['Audio track', trackLabel(audio), 2]] : []),
    ...(!audioOnly ? [['Container', selection.container === 'auto' ? 'Auto' : selection.container.toUpperCase(), 2]] : []),
    ...(selection.audioLanguage && !audio ? [['Audio language', selection.audioLanguage, 2]] : []),
    ...(!audioOnly && selection.subtitles ? [['Subtitles', selection.subtitleLanguage, 2]] : []),
    ...(selection.thumbnailFile ? [['Thumbnail', 'Included', 2]] : []),
    ...(selection.startSeconds !== '' || selection.endSeconds !== '' ? [['Clip', `${selection.startSeconds || 0}s to ${selection.endSeconds === '' ? 'end' : `${selection.endSeconds}s`}`, 2]] : []),
    ['Estimated size', size ? `~${formatBytes(size)}` : 'Not available', null],
    ['Server retention', '7 days after preparation', null],
  ];
  return <Box sx={{ minWidth: 0 }}>
    {!compact && <SummaryRow label="Source" value={url} onEdit={() => edit(0)} />}
    {rows.map(([label, value, next]) => <SummaryRow key={label} label={label} value={value} onEdit={next === null || (next === 2 && !count) ? null : () => edit(next)} compact={compact} />)}
    {selection.mode === 'audio' && selection.audioPreset !== 'audio' && <Typography sx={{ color: T.textMuted, fontSize: '0.8rem', mt: 2 }}>Audio conversion may be required</Typography>}
  </Box>;
}

function SummaryRow({ label, value, onEdit, compact = false }) {
  const T = useT();
  return <Stack direction="row" gap={1} alignItems="center" sx={{ py: compact ? 1 : 1.5, borderBottom: `1px solid ${T.border}`, minWidth: 0 }}>
    <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ color: T.textMuted, fontSize: '0.75rem', mb: 0.25 }}>{label}</Typography><Typography sx={{ fontSize: compact ? '0.85rem' : '0.95rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</Typography></Box>
    {onEdit && <Tooltip title={`Edit ${label.toLowerCase()}`}><IconButton size="small" aria-label={`Edit ${label.toLowerCase()}`} onClick={onEdit} sx={{ color: T.textMuted, width: 44, height: 44 }}><Edit sx={{ fontSize: 18 }} /></IconButton></Tooltip>}
  </Stack>;
}

function duration(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}