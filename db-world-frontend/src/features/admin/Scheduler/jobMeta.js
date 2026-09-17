import { Schedule, Sync } from '@mui/icons-material';
import DeleteSweepRounded from '@mui/icons-material/DeleteSweepRounded';
import MovieRounded from '@mui/icons-material/MovieRounded';
import TvRounded from '@mui/icons-material/TvRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import SellRounded from '@mui/icons-material/SellRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';

/**
 * Per-job colour, label and icon. Lives in its own module so both the page and the
 * card can read it without importing each other.
 *
 * A job id missing from here still renders — the caller falls back to the name the
 * API sends and the neutral teal — so adding a job to SchedulerAdminService.DEFAULTS
 * never requires a matching frontend change.
 */
export const JOB_META = {
  TagScheduler:          { color: '#f59e0b', label: 'Tag Scheduler',        icon: SellRounded },
  TmdbMovieSync:         { color: '#6366f1', label: 'TMDB Movie Sync',      icon: MovieRounded },
  TmdbTvSync:            { color: '#a855f7', label: 'TMDB TV Sync',         icon: TvRounded },
  PersonSyncScheduler:   { color: '#0d9488', label: 'Person Detail Sync',   icon: PersonRounded },
  MediaSync:             { color: '#10b981', label: 'Media File Sync',      icon: Sync },
  'ipo-poll':            { color: '#0284c7', label: 'IPO Tracker Poll',     icon: TrendingUpRounded },
  'ipo-live':            { color: '#f43f5e', label: 'IPO Live Refresh',     icon: BoltRounded },
  SchedulerHistoryPrune: { color: '#64748b', label: 'Run History Cleanup',  icon: DeleteSweepRounded },
};

export const metaFor = (job, fallbackColor) => ({
  color: fallbackColor,
  label: job?.name ?? job?.id,
  icon: Schedule,
  ...(JOB_META[job?.id] ?? {}),
  // The admin can rename a job in the DB; that override always wins over the
  // hardcoded label above.
  ...(job?.name && job.name !== job?.defaultName ? { label: job.name } : {}),
});
