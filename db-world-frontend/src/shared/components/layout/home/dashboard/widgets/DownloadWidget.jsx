import React, { useState } from 'react';
import { Box, IconButton, InputBase, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { Search } from '@mui/icons-material';
import { useT } from '@shared/theme';
import { activeStatuses, formatBytes, formatEta, statusLabel, useMediaJobs } from '@features/downloader/downloaderApi';
import { useActiveDownloadCount } from '@features/cinema/download-queue/useActiveDownloadCount';
import WidgetShell from '../WidgetShell';
import { SignedOutPanel, Stat, StatRow } from '../widgetParts';

export default function DownloadWidget({ widget, isAuthenticated, onSignIn, onNavigate, summary: _summary, isLoading: _loading, apps: _apps, recent: _recent, onRegister: _register, ...shell }) {
  const T = useT();
  const media = useMediaJobs(false, isAuthenticated);
  const deviceCount = useActiveDownloadCount();
  const [url, setUrl] = useState('');
  const downloader = widget.id === 'media-downloader';
  const jobs = isAuthenticated ? media.data || [] : [];
  const queued = jobs.filter((job) => job.status === 'QUEUED').length;
  const ready = jobs.filter((job) => job.status === 'READY').length;
  const active = jobs.find((job) => activeStatuses.includes(job.status) && job.status !== 'QUEUED');
  const open = (event) => {
    event.preventDefault(); event.stopPropagation();
    if (url.trim()) onNavigate?.(`${widget.route}?url=${encodeURIComponent(url.trim())}`);
  };
  return <WidgetShell widget={widget} {...shell}>
    {!isAuthenticated ? <SignedOutPanel widget={widget} onSignIn={onSignIn} /> : <>
      {downloader && widget.size !== 'sm' ? <Box component="form" onSubmit={open} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
        sx={{ display: 'flex', alignItems: 'center', border: `1px solid ${T.glassBorder}`, borderRadius: 1, minHeight: 40 }}>
        <InputBase type="url" required value={url} placeholder="Video or playlist URL" inputProps={{ 'aria-label': 'Video or playlist URL' }} onChange={(event) => setUrl(event.target.value)} sx={{ flex: 1, minWidth: 0, px: 1, fontSize: '0.85rem' }} />
        <Tooltip title="Inspect URL"><IconButton type="submit" aria-label="Inspect URL" size="small" sx={{ width: 40, height: 40 }}><Search /></IconButton></Tooltip>
      </Box> : <StatRow>
        <Stat value={(active ? 1 : 0) + (downloader ? 0 : deviceCount)} label="Active" compact loading={media.isLoading} />
        <Stat value={queued} label="Queued" compact loading={media.isLoading} />
        {widget.size !== 'sm' && <Stat value={ready} label="Ready" compact loading={media.isLoading} />}
      </StatRow>}
      {widget.size === 'md' && !downloader && active && <Box mt={1}>
        <LinearProgress variant={active.progress == null ? 'indeterminate' : 'determinate'} value={active.progress || 0} sx={{ height: 3 }} />
      </Box>}
      {widget.size === 'lg' && <Box sx={{ mt: 1.5, minWidth: 0 }}>
        {downloader && <StatRow><Stat value={queued} label="Queued" compact /><Stat value={ready} label="Ready" compact /></StatRow>}
        {jobs.slice(0, 3).map((job) => <Stack key={job.id} direction="row" gap={1} alignItems="center" sx={{ py: 0.75, minWidth: 0 }}>
          {job.thumbnail && <Box component="img" src={job.thumbnail} alt="" sx={{ width: 40, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 0.5 }} />}
          <Box sx={{ minWidth: 0, flex: 1 }}><Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{job.title}</Typography>
            <Typography noWrap sx={{ fontSize: '0.68rem', color: T.textMuted }}>{statusLabel(job)}{job.speed > 0 ? ` / ${formatBytes(job.speed)}/s / ${formatEta(job.eta)}` : ''}</Typography></Box>
        </Stack>)}
        {active && <LinearProgress variant={active.progress == null ? 'indeterminate' : 'determinate'} value={active.progress || 0} sx={{ mt: 1 }} />}
      </Box>}
    </>}
  </WidgetShell>;
}