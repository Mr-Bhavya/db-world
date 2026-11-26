import React, { memo } from 'react';
import {
  Box,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Controller, useWatch } from 'react-hook-form';
import {
  DeleteRounded as Delete,
  DriveFileRenameOutlineRounded as DriveFileRenameOutline,
  LinkRounded as LinkIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { detectUrlType } from './UrlDetector';
import { EpisodePicker } from './EpisodePickers';
import { SourceBadge, getSourceColors } from './IngestionFormParts';

// ─────────────────────────────────────────────────────────────────────────────
// URL Row
// ─────────────────────────────────────────────────────────────────────────────

export const UrlRow = memo(function UrlRow({
  index,
  control,
  remove,
  canRemove,
  isYtMode,
  showPerUrlEpisode,
  tmdbSeasons = [],
  watchedSeason = null,
  compact = false,
}) {
  const T = useT();
  const S = adminSurface(T);
  const urlValue = useWatch({ control, name: `urls.${index}.url` });
  const renameValue = useWatch({ control, name: `urls.${index}.rename` });
  const type = detectUrlType(urlValue || '');
  const sourceColors = getSourceColors(T, type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -18, scale: 0.985 }}
      transition={{ duration: 0.18 }}
    >
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: compact ? { xs: 1, sm: 1.25 } : { xs: 1.1, sm: 1.35 },
          borderRadius: 3,
          borderColor: type !== 'unknown' ? sourceColors.border : S.border,
          bgcolor: type !== 'unknown' ? sourceColors.bg : S.inset,
        }}
      >
        <Stack spacing={1}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Controller
                name={`urls.${index}.url`}
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    label={index === 0 ? 'Source URL' : `Source URL ${index + 1}`}
                    placeholder={isYtMode ? 'YouTube / streaming URL…' : 'https://, magnet:, ftp:// …'}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || ' '}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment:
                        type !== 'unknown' ? (
                          <InputAdornment position="end">
                            <SourceBadge type={type} />
                          </InputAdornment>
                        ) : undefined,
                    }}
                  />
                )}
              />
            </Box>

            {canRemove && !isYtMode ? (
              <Tooltip title="Remove URL">
                <IconButton
                  size="small"
                  onClick={() => remove(index)}
                  sx={{
                    mt: { xs: -0.25, sm: 0.5 },
                    alignSelf: { xs: 'flex-end', sm: 'unset' },
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            {showPerUrlEpisode ? (
              <Box sx={{ width: { xs: '100%', md: 210 } }}>
                <Controller
                  name={`urls.${index}.episode`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <EpisodePicker
                      seasons={tmdbSeasons}
                      seasonNumber={watchedSeason}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || ' '}
                      sx={{ width: '100%' }}
                    />
                  )}
                />
              </Box>
            ) : null}

            {!isYtMode ? (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Controller
                  name={`urls.${index}.rename`}
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      sx={{ ml: 0.2, mr: 0 }}
                      control={
                        <Switch
                          checked={!!field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <DriveFileRenameOutline sx={{ fontSize: 16 }} />
                          <Typography variant="caption" fontWeight={600}>
                            Custom filename
                          </Typography>
                        </Stack>
                      }
                    />
                  )}
                />
              </Box>
            ) : null}
          </Stack>

          {!isYtMode && renameValue ? (
            <Controller
              name={`urls.${index}.customName`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  label="Output filename"
                  placeholder="output-filename.mkv"
                />
              )}
            />
          ) : null}
        </Stack>
      </Paper>
    </motion.div>
  );
});
