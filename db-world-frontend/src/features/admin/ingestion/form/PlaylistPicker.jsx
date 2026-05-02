import React from 'react';
import {
  Avatar, Box, Checkbox, Chip, Divider, FormControlLabel,
  Skeleton, Stack, Typography, alpha,
} from '@mui/material';
import { AccessTime, Person, PlaylistPlay } from '@mui/icons-material';
import { useT } from '@shared/theme';

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Renders a selectable list of yt-dlp playlist entries.
 *
 * Props:
 *   entries        — YtPlaylistEntry[] from backend
 *   selected       — Set<number> of entry.index values
 *   onChange       — (Set<number>) => void
 *   loading        — bool
 */
export default function PlaylistPicker({ entries = [], selected, onChange, loading }) {
  const T = useT();

  const allSelected  = entries.length > 0 && selected.size === entries.length;
  const someSelected = selected.size > 0 && selected.size < entries.length;

  const toggle = (index) => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index); else next.add(index);
    onChange(next);
  };

  const toggleAll = () => {
    onChange(allSelected ? new Set() : new Set(entries.map((e) => e.index)));
  };

  if (loading) {
    return (
      <Stack spacing={1}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
        ))}
      </Stack>
    );
  }

  if (!entries.length) {
    return (
      <Typography variant="body2" color="text.secondary">No playlist entries found.</Typography>
    );
  }

  return (
    <Box>
      {/* Header row */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <PlaylistPlay sx={{ fontSize: 17, color: T.teal }} />
          <Typography variant="body2" fontWeight={600}>
            {entries.length} item{entries.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          {selected.size > 0 && (
            <Chip
              label={`${selected.size} selected`}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
                sx={{ p: 0.25 }}
              />
            }
            label={
              <Typography variant="caption">
                {allSelected ? 'Deselect all' : 'Select all'}
              </Typography>
            }
            sx={{ m: 0 }}
          />
        </Stack>
      </Stack>

      <Divider sx={{ mb: 1 }} />

      {/* Entry list */}
      <Stack spacing={0.5} sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}>
        {entries.map((entry) => {
          const isChecked = selected.has(entry.index);
          return (
            <Box
              key={entry.index}
              onClick={() => toggle(entry.index)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 0.75,
                borderRadius: 1,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: isChecked ? alpha(T.teal, 0.4) : 'transparent',
                bgcolor:      isChecked ? alpha(T.teal, 0.06) : 'transparent',
                '&:hover': {
                  bgcolor: isChecked ? alpha(T.teal, 0.1) : alpha(T.textFaint ?? '#888', 0.05),
                },
                transition: 'all 0.15s',
              }}
            >
              <Checkbox
                size="small"
                checked={isChecked}
                onChange={() => toggle(entry.index)}
                onClick={(e) => e.stopPropagation()}
                sx={{ p: 0.25, flexShrink: 0 }}
              />

              <Avatar
                src={entry.thumbnail}
                variant="rounded"
                sx={{ width: 64, height: 36, flexShrink: 0, bgcolor: alpha(T.teal, 0.12) }}
              >
                <PlaylistPlay sx={{ fontSize: 16 }} />
              </Avatar>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight={isChecked ? 600 : 400}
                  sx={{
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.index}. {entry.title}
                </Typography>
                <Stack direction="row" spacing={1} mt={0.25} alignItems="center">
                  {entry.duration && (
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <AccessTime sx={{ fontSize: 11, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.disabled">
                        {formatDuration(entry.duration)}
                      </Typography>
                    </Stack>
                  )}
                  {entry.uploader && (
                    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ minWidth: 0 }}>
                      <Person sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 130,
                        }}
                      >
                        {entry.uploader}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
