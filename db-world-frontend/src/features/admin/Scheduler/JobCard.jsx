import React from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Switch, Tooltip, IconButton,
  Button, CircularProgress, LinearProgress, alpha,
} from '@mui/material';
import {
  PlayArrow, CheckCircle, Error as ErrorIcon, History, Edit as EditIcon,
  DragIndicator, StickyNote2, Autorenew, Code, PauseCircleOutlineRounded,
} from '@mui/icons-material';
import { Reorder, useDragControls } from 'framer-motion';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { metaFor } from './jobMeta';
import {
  clockTime, counterLabel, describeSchedule, formatDuration, fullTime,
  highlightCounters, isFailureCounter, relativeTime,
} from './schedulerUtils';

/**
 * A labelled column of the desktop row.
 *
 * On mobile the label sits INLINE to the left of its value on a fixed-width
 * gutter, so the values line up in a column instead of becoming orphans. Hiding
 * the labels on small screens (the first cut) left bare "Never run" and "—"
 * floating under the description with nothing to say what they meant.
 */
function Field({ label, children }) {
  const T = useT();
  return (
    <Box sx={{
      minWidth: 0,
      display: { xs: 'flex', md: 'block' },
      alignItems: 'baseline',
      gap: 1,
    }}>
      <Typography sx={{
        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: T.textFaint,
        mb: { xs: 0, md: 0.35 },
        flex: { xs: '0 0 72px', md: 'unset' },
      }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0, flex: { xs: 1, md: 'unset' } }}>{children}</Box>
    </Box>
  );
}

/** Did the last run succeed, fail, or has it never run? */
function LastRunStatus({ job }) {
  const T = useT();
  const streak = job.consecutiveFailures ?? 0;

  if (!job.lastStatus) {
    return <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>Never run</Typography>;
  }
  if (job.lastStatus === 'FAILED') {
    return (
      <Tooltip title={streak > 1
        ? `${streak} consecutive failures — this job has been broken for a while`
        : 'The last run failed'}>
        <Chip
          size="small"
          icon={<ErrorIcon sx={{ fontSize: 11 }} />}
          label={streak > 1 ? `Failed ×${streak}` : 'Failed'}
          sx={{
            height: 20, fontSize: '0.65rem', fontWeight: 700,
            bgcolor: T.errorBg, color: T.error,
            '& .MuiChip-icon': { color: T.error, ml: 0.5 },
          }}
        />
      </Tooltip>
    );
  }
  return (
    <Chip
      size="small"
      icon={<CheckCircle sx={{ fontSize: 11 }} />}
      label="Succeeded"
      sx={{
        height: 20, fontSize: '0.65rem',
        bgcolor: T.successBg, color: T.success,
        '& .MuiChip-icon': { color: T.success, ml: 0.5 },
      }}
    />
  );
}

/**
 * One scheduler job.
 *
 * Laid out as a row of columns on desktop — identity, schedule, last run, next run,
 * actions — and stacked on mobile. The previous card stacked everything at every
 * width, which on a 1600px page meant a full-width "Run now" button and roughly six
 * jobs on screen. It also had nowhere to put the facts that make this page useful:
 * whether the last run worked, what it did, and when the next one is.
 */
export default function JobCard({ job, onTrigger, onToggle, onEdit, onShowHistory, triggering }) {
  const T = useT();
  const S = adminSurface(T);
  const dragControls = useDragControls();

  const meta = metaFor(job, T.teal);
  const Icon = meta.icon;
  const isRunning = job.status === 'RUNNING' || triggering;
  const isFixedDelay = job.jobType === 'FIXED_DELAY';
  const enabled = job.enabled !== false;
  const failed = job.lastStatus === 'FAILED';
  const highlights = highlightCounters(job.lastSummary, 2);

  return (
    <Reorder.Item
      value={job}
      id={job.id}
      dragListener={false}
      dragControls={dragControls}
      style={{ listStyle: 'none' }}
    >
      <Card sx={{
        bgcolor: S.card,
        // A failing job outranks a running one for border colour: "this is broken"
        // is a more urgent fact than "this is busy".
        border: `1px solid ${failed ? alpha(T.error, 0.45)
          : isRunning ? `${meta.color}55` : S.border}`,
        borderRadius: 2,
        mb: 1.25,
        opacity: enabled ? 1 : 0.62,
        transition: 'border-color 0.2s, opacity 0.2s',
        '&:hover': { borderColor: failed ? alpha(T.error, 0.7) : `${meta.color}66` },
        userSelect: 'none',
      }}>
        <CardContent sx={{
          p: { xs: 1.5, sm: 1.75 },
          '&:last-child': { pb: { xs: 1.5, sm: 1.75 } },
          display: 'flex', gap: 1.25, alignItems: 'stretch',
        }}>
          {/* Drag handle — outside the grid so it never takes a column's width. */}
          <Box
            onPointerDown={(e) => dragControls.start(e)}
            sx={{
              display: 'flex', alignItems: 'center', cursor: 'grab',
              color: T.textFaint, flexShrink: 0, touchAction: 'none',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicator sx={{ fontSize: 18 }} />
          </Box>

          <Box sx={{
            flex: 1, minWidth: 0,
            display: 'grid',
            // minmax(0, …) on every track: a bare `1fr`/`auto` refuses to shrink below
            // its content, which is what pushes overflow onto a neighbouring column.
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 1.5fr) minmax(0, 0.9fr) auto',
            },
            columnGap: 2,
            rowGap: 1.25,
            alignItems: { xs: 'stretch', md: 'center' },
          }}>

            {/* ── Identity ─────────────────────────────────────────────── */}
            <Box sx={{ minWidth: 0, display: 'flex', gap: 0.9, alignItems: 'flex-start' }}>
              <Icon sx={{ fontSize: 17, color: meta.color, flexShrink: 0, mt: 0.15 }} />
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: T.text, lineHeight: 1.3 }}>
                    {meta.label}
                  </Typography>
                  {!enabled && (
                    <Chip
                      size="small"
                      icon={<PauseCircleOutlineRounded sx={{ fontSize: 11 }} />}
                      label="Disabled"
                      sx={{
                        height: 18, fontSize: '0.6rem', fontWeight: 700,
                        bgcolor: S.inset, color: T.textMuted,
                        '& .MuiChip-icon': { color: T.textMuted, ml: 0.5 },
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.71rem', color: T.textFaint, mt: 0.25, lineHeight: 1.45 }}>
                  {job.description}
                </Typography>
                {job.notes && (
                  <Box sx={{
                    mt: 0.5, display: 'flex', gap: 0.5, alignItems: 'flex-start',
                    bgcolor: alpha(meta.color, 0.06),
                    border: `1px solid ${alpha(meta.color, 0.18)}`,
                    borderRadius: 0.75, px: 0.75, py: 0.5,
                  }}>
                    <StickyNote2 sx={{ fontSize: 12, color: meta.color, mt: 0.15, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.69rem', color: T.textMuted, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {job.notes}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* ── Schedule ─────────────────────────────────────────────── */}
            <Field label="Schedule">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                {isFixedDelay
                  ? <Autorenew sx={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }} />
                  : <Code sx={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }} />}
                <Tooltip title={isFixedDelay
                  ? `Self-scheduled, every ${job.intervalSeconds}s`
                  : (job.cronExpression ?? '')}>
                  <Typography noWrap sx={{ fontSize: '0.73rem', color: T.textMuted, minWidth: 0 }}>
                    {describeSchedule(job)}
                  </Typography>
                </Tooltip>
              </Box>
            </Field>

            {/* ── Last run ─────────────────────────────────────────────── */}
            <Field label="Last run">
              {isRunning ? (
                <Box sx={{ minWidth: 0 }}>
                  <Chip
                    size="small"
                    label="Running"
                    icon={<CircularProgress size={9} sx={{ color: `${meta.color} !important` }} />}
                    sx={{
                      height: 20, fontSize: '0.65rem',
                      bgcolor: alpha(meta.color, 0.14), color: meta.color,
                      '& .MuiChip-icon': { ml: 0.5 },
                    }}
                  />
                  <LinearProgress sx={{
                    height: 2, borderRadius: 1, mt: 0.6, bgcolor: S.inset,
                    '& .MuiLinearProgress-bar': { bgcolor: meta.color },
                  }} />
                </Box>
              ) : (
                <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                    <LastRunStatus job={job} />
                    {job.lastRunAt && (
                      <Tooltip title={fullTime(job.lastRunAt)}>
                        <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>
                          {relativeTime(job.lastRunAt)}
                          {job.lastDurationMs != null && ` · ${formatDuration(job.lastDurationMs)}`}
                        </Typography>
                      </Tooltip>
                    )}
                  </Box>

                  {/* What the run actually did, at a glance. */}
                  {failed ? (
                    job.lastMessage && (
                      <Tooltip title={job.lastMessage}>
                        <Typography noWrap sx={{ fontSize: '0.68rem', color: T.error, minWidth: 0 }}>
                          {job.lastMessage}
                        </Typography>
                      </Tooltip>
                    )
                  ) : highlights.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                      {highlights.map((h) => (
                        <Chip
                          key={h.key}
                          size="small"
                          label={`${counterLabel(h.key)} ${h.value}`}
                          sx={{
                            height: 17, fontSize: '0.6rem', borderRadius: 0.75,
                            bgcolor: isFailureCounter(h.key) ? T.errorBg : S.inset,
                            color: isFailureCounter(h.key) ? T.error : T.textMuted,
                            '& .MuiChip-label': { px: 0.7 },
                          }}
                        />
                      ))}
                    </Box>
                  ) : job.lastSummary?.note ? (
                    <Tooltip title={job.lastSummary.note}>
                      <Typography noWrap sx={{ fontSize: '0.68rem', color: T.textFaint, minWidth: 0 }}>
                        {job.lastSummary.note}
                      </Typography>
                    </Tooltip>
                  ) : null}
                </Box>
              )}
            </Field>

            {/* ── Next run ─────────────────────────────────────────────── */}
            <Field label="Next run">
              {job.nextRunAt ? (
                <Tooltip title={fullTime(job.nextRunAt)}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.73rem', color: T.text, fontWeight: 600 }}>
                      {relativeTime(job.nextRunAt)}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.66rem', color: T.textFaint }}>
                      {clockTime(job.nextRunAt)}
                    </Typography>
                  </Box>
                </Tooltip>
              ) : (
                <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
                  {enabled ? '—' : 'Paused'}
                </Typography>
              )}
            </Field>

            {/* ── Actions ──────────────────────────────────────────────── */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              justifyContent: { xs: 'flex-start', md: 'flex-end' },
              flexShrink: 0,
            }}>
              {/* Edit opens the whole job — name, notes, schedule and the job's own
                  knobs. It used to live inside the Schedule column, which made it read
                  as "edit the cron" and hid everything else the dialog can do. */}
              <Tooltip title="Edit job settings">
                <IconButton size="small" onClick={() => onEdit(job)}
                  sx={{ color: T.textFaint, '&:hover': { color: meta.color } }}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Run history and logs">
                <IconButton size="small" onClick={() => onShowHistory(job)}
                  sx={{ color: T.textFaint, '&:hover': { color: meta.color } }}>
                  <History sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayArrow sx={{ fontSize: 14 }} />}
                disabled={isRunning}
                onClick={() => onTrigger(job)}
                sx={{
                  flex: { xs: 1, md: 'unset' },
                  borderColor: alpha(meta.color, 0.35), color: meta.color,
                  fontSize: '0.72rem', textTransform: 'none', fontWeight: 700,
                  py: 0.25, px: 1, whiteSpace: 'nowrap',
                  '&:hover': { borderColor: meta.color, bgcolor: alpha(meta.color, 0.08) },
                }}
              >
                {isRunning ? 'Running' : 'Run now'}
              </Button>

              <Tooltip title={enabled ? 'Disable job' : 'Enable job'}>
                <Switch
                  size="small"
                  checked={enabled}
                  onChange={() => onToggle(job)}
                  sx={{
                    '& .MuiSwitch-thumb': { bgcolor: enabled ? meta.color : undefined },
                    '& .MuiSwitch-track': { bgcolor: enabled ? `${meta.color}55` : undefined },
                  }}
                />
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Reorder.Item>
  );
}
