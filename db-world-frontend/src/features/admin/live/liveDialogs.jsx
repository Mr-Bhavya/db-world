import React, { useEffect } from 'react';
import {
  Box, Button, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  AddLinkRounded, CloseRounded, DeleteOutlineRounded, LiveTvRounded, PlaylistAddRounded,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import SheetDialog from '@shared/components/SheetDialog';
import {
  useAddChannelSource, useAddManualChannel, useAddPlaylist,
  useDeleteChannelSource, useUpdatePlaylist,
} from '@features/live/liveApi';

/** A playlist source may also be a local file path, so this only rejects obvious nonsense. */
const playlistSchema = z.object({
  url: z.string().trim().min(1, 'A playlist URL or file path is required').max(2048),
  name: z.string().trim().max(120).optional().or(z.literal('')),
  userAgent: z.string().trim().max(400).optional().or(z.literal('')),
  referer: z.string().trim().max(400).optional().or(z.literal('')),
});

/** A stream URL is fetched by the player, so it must actually be http(s). */
const httpUrl = z.string().trim()
  .min(1, 'A stream URL is required')
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v), 'Must start with http:// or https://');

const sourceSchema = z.object({
  url: httpUrl,
  userAgent: z.string().trim().max(400).optional().or(z.literal('')),
  referer: z.string().trim().max(400).optional().or(z.literal('')),
});

const channelSchema = z.object({
  name: z.string().trim().min(1, 'A channel name is required').max(300),
  url: httpUrl,
  group: z.string().trim().max(200).optional().or(z.literal('')),
  logoUrl: z.string().trim().max(2048).optional().or(z.literal('')),
});

/** Strips empty optionals so a blank field clears rather than storing "". */
const clean = (values) => Object.fromEntries(
  Object.entries(values).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v]),
);

const dialogPaper = (T) => ({ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } });

function Header({ icon: Icon, title, onClose, T }) {
  return (
    <DialogTitle sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon sx={{ fontSize: 18, color: T.teal }} />
        {title}
      </span>
      <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
        <CloseRounded sx={{ fontSize: 16 }} />
      </IconButton>
    </DialogTitle>
  );
}

/**
 * A themed TextField that accepts `{...register(name)}` directly.
 *
 * **It must stay a forwardRef.** `register()` returns a `ref` callback, and React drops
 * `ref` on a plain function component — it never appears in props. RHF then never gets a
 * DOM node, its `live()` check (`isHTMLElement(ref) && ref.isConnected`) fails against
 * the placeholder it holds instead, `_removeUnmounted()` decides the field left the page
 * and unregisters it, and the value is deleted from the form before validation runs. The
 * symptom is a filled-in box rejected with "expected string, received undefined".
 *
 * The ref goes to `inputRef` (the real `<input>`) rather than the root, so focus-on-error
 * and `setFocus()` land on the control instead of the wrapper.
 */
const Field = React.forwardRef(function Field({ T, error, ...props }, ref) {
  return (
    <TextField
      fullWidth
      size="small"
      inputRef={ref}
      error={Boolean(error)}
      helperText={error?.message}
      slotProps={{ input: { sx: { fontSize: 13 } } }}
      sx={{ '& .MuiOutlinedInput-root': { bgcolor: T.inputBg ?? 'transparent' } }}
      {...props}
    />
  );
});

/* ─── Add / edit a playlist source ────────────────────────────────────────── */

export function PlaylistDialog({ open, onClose, playlist }) {
  const T = useT();
  const editing = Boolean(playlist);
  const add    = useAddPlaylist();
  const update = useUpdatePlaylist();
  const busy   = add.isPending || update.isPending;

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(playlistSchema),
    defaultValues: { url: '', name: '', userAgent: '', referer: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      url: playlist?.url ?? '',
      name: playlist?.name ?? '',
      userAgent: playlist?.userAgent ?? '',
      referer: playlist?.referer ?? '',
    });
  }, [open, playlist, reset]);

  const submit = (values) => {
    const body = clean(values);
    const run = editing
      ? update.mutateAsync({ id: playlist.id, ...body })
      : add.mutateAsync(body);
    run
      .then(() => {
        notify.success(editing ? 'Playlist updated' : 'Playlist added — run a refresh to import its channels');
        onClose?.();
      })
      .catch((e) => notify.error(e?.response?.data?.message ?? 'Could not save the playlist'));
  };

  return (
    <SheetDialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={dialogPaper(T)}>
      <Header icon={PlaylistAddRounded} title={editing ? 'Edit playlist' : 'Add playlist'} onClose={onClose} T={T} />
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent sx={{ pb: 1 }}>
          <Stack spacing={2}>
            <Field T={T} {...register('url')} error={errors.url} autoFocus
              label="Playlist URL or file path"
              placeholder="https://iptv-org.github.io/iptv/index.m3u" />
            <Field T={T} {...register('name')} error={errors.name}
              label="Name (optional)" placeholder="Defaults to the host name" />
            <Typography sx={{ fontSize: 12, color: T.textFaint }}>
              Some providers only serve their streams to a specific browser identity. Leave
              these blank unless the channels from this playlist refuse to play.
            </Typography>
            <Field T={T} {...register('userAgent')} error={errors.userAgent} label="User-Agent (optional)" />
            <Field T={T} {...register('referer')} error={errors.referer} label="Referer (optional)" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button onClick={onClose} disabled={busy} sx={{ color: T.textMuted, fontSize: 13 }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}
            sx={{ bgcolor: T.teal, fontSize: 13, '&:hover': { bgcolor: T.tealHover } }}>
            {busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : (editing ? 'Save' : 'Add playlist')}
          </Button>
        </DialogActions>
      </form>
    </SheetDialog>
  );
}

/* ─── Create a channel from a single stream URL ───────────────────────────── */

export function AddChannelDialog({ open, onClose }) {
  const T = useT();
  const addChannel = useAddManualChannel();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(channelSchema),
    defaultValues: { name: '', url: '', group: '', logoUrl: '' },
  });

  useEffect(() => {
    if (open) reset({ name: '', url: '', group: '', logoUrl: '' });
  }, [open, reset]);

  const submit = (values) => {
    addChannel.mutateAsync(clean(values))
      .then(() => { notify.success('Channel added'); onClose?.(); })
      .catch((e) => notify.error(e?.response?.data?.message ?? 'Could not add the channel'));
  };

  return (
    <SheetDialog open={open} onClose={addChannel.isPending ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={dialogPaper(T)}>
      <Header icon={LiveTvRounded} title="Add a single channel" onClose={onClose} T={T} />
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent sx={{ pb: 1 }}>
          <Stack spacing={2}>
            <Field T={T} {...register('name')} error={errors.name} autoFocus label="Channel name" />
            <Field T={T} {...register('url')} error={errors.url}
              label="Stream URL" placeholder="https://cdn.example.com/channel/index.m3u8" />
            <Field T={T} {...register('group')} error={errors.group} label="Category (optional)" placeholder="News" />
            <Field T={T} {...register('logoUrl')} error={errors.logoUrl} label="Logo URL (optional)" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button onClick={onClose} disabled={addChannel.isPending} sx={{ color: T.textMuted, fontSize: 13 }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={addChannel.isPending}
            sx={{ bgcolor: T.teal, fontSize: 13, '&:hover': { bgcolor: T.tealHover } }}>
            {addChannel.isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Add channel'}
          </Button>
        </DialogActions>
      </form>
    </SheetDialog>
  );
}

/* ─── Manage one channel's stream URLs ────────────────────────────────────── */

const HEALTH_COLOUR = { UP: 'success', DOWN: 'error', UNKNOWN: 'default' };

/**
 * The multi-URL editor. A channel plays the first URL that works and falls through the
 * rest on failure, so adding a mirror here is what makes a flaky channel reliable.
 */
export function ChannelSourcesDialog({ open, onClose, channel }) {
  const T = useT();
  const addSource    = useAddChannelSource();
  const deleteSource = useDeleteChannelSource();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(sourceSchema),
    defaultValues: { url: '', userAgent: '', referer: '' },
  });

  useEffect(() => {
    if (open) reset({ url: '', userAgent: '', referer: '' });
  }, [open, channel?.id, reset]);

  if (!channel) return null;
  const sources = channel.sources ?? [];

  const submit = (values) => {
    addSource.mutateAsync({ channelId: channel.id, ...clean(values) })
      .then(() => { notify.success('Stream URL added'); reset({ url: '', userAgent: '', referer: '' }); })
      .catch((e) => notify.error(e?.response?.data?.message ?? 'Could not add the URL'));
  };

  const remove = (source) => {
    const last = sources.length === 1;
    deleteSource.mutateAsync(source.id)
      .then(() => {
        notify.success(last ? 'Last URL removed — the channel was deleted too' : 'Stream URL removed');
        if (last) onClose?.();
      })
      .catch((e) => notify.error(e?.response?.data?.message ?? 'Could not remove the URL'));
  };

  return (
    <SheetDialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={dialogPaper(T)}>
      <Header icon={AddLinkRounded} title={`Stream URLs — ${channel.name}`} onClose={onClose} T={T} />
      <DialogContent sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 2 }}>
          Tried top to bottom. A URL that last checked out healthy is always tried before an
          untested one, so adding a backup mirror costs nothing when the first is working.
        </Typography>

        <Stack spacing={1} sx={{ mb: 3 }}>
          {sources.length === 0 && (
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>No URLs yet.</Typography>
          )}
          {sources.map((source, i) => (
            <Box key={source.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25,
              bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2,
            }}>
              <Chip size="small" label={i + 1}
                sx={{ bgcolor: T.inputBg, color: T.textMuted, fontWeight: 700, minWidth: 28 }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Tooltip title={source.url}>
                  <Typography sx={{
                    fontSize: 12.5, color: T.textPrimary, fontFamily: 'monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {source.url}
                  </Typography>
                </Tooltip>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>
                  {source.playlistName ? `from ${source.playlistName}` : 'added by hand'}
                  {source.failCount > 0 && ` · ${source.failCount} failed check${source.failCount === 1 ? '' : 's'}`}
                </Typography>
              </Box>
              <Chip size="small" label={source.health} color={HEALTH_COLOUR[source.health] ?? 'default'} variant="outlined" />
              <Tooltip title="Remove this URL">
                <span>
                  <IconButton size="small" onClick={() => remove(source)} disabled={deleteSource.isPending}
                    sx={{ color: T.error }}>
                    <DeleteOutlineRounded sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
        </Stack>

        <form onSubmit={handleSubmit(submit)} id="add-source-form">
          <Stack spacing={2}>
            <Field T={T} {...register('url')} error={errors.url}
              label="Add another stream URL" placeholder="https://mirror.example.com/channel/index.m3u8" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Field T={T} {...register('userAgent')} error={errors.userAgent} label="User-Agent (optional)" />
              <Field T={T} {...register('referer')} error={errors.referer} label="Referer (optional)" />
            </Stack>
          </Stack>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted, fontSize: 13 }}>Done</Button>
        <Button type="submit" form="add-source-form" variant="contained" disabled={addSource.isPending}
          sx={{ bgcolor: T.teal, fontSize: 13, '&:hover': { bgcolor: T.tealHover } }}>
          {addSource.isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Add URL'}
        </Button>
      </DialogActions>
    </SheetDialog>
  );
}
