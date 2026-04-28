import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Avatar, IconButton, Tooltip,
  TextField, MenuItem, Collapse, LinearProgress, Skeleton,
  Button, InputAdornment,
} from '@mui/material';
import DownloadIcon    from '@mui/icons-material/CloudDownload';
import PlayArrowIcon   from '@mui/icons-material/PlayArrow';
import SearchIcon      from '@mui/icons-material/Search';
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore';
import ExpandLessIcon  from '@mui/icons-material/ExpandLess';
import LinkIcon        from '@mui/icons-material/Link';
import PersonIcon      from '@mui/icons-material/Person';
import { useQuery }    from '@tanstack/react-query';
import { useT }        from '@shared/theme/ThemeContext';
import {
  fetchCinemaRecent, fetchCinemaUsers, fetchUserActivities,
  ACTIVITY_TYPES, TYPE_META, fmtBytes, fmtAgo, fileName,
} from './activityApi';

// ─── Type chip ────────────────────────────────────────────────────────────────
function TypeChip({ type }) {
  const T    = useT();
  const meta = TYPE_META[type] ?? { color: T.textMuted, label: type };
  const Icon = type === 'DOWNLOAD' ? DownloadIcon
             : type === 'STREAM'   ? PlayArrowIcon
             : SearchIcon;
  return (
    <Chip
      size="small"
      label={meta.label}
      icon={<Icon sx={{ fontSize: '11px !important' }} />}
      sx={{
        bgcolor: `${meta.color}18`, color: meta.color,
        fontWeight: 700, fontSize: 11, height: 22,
        '& .MuiChip-icon': { color: meta.color },
      }}
    />
  );
}

// ─── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow({ a, showUser = true }) {
  const T        = useT();
  const [open, setOpen] = useState(false);
  const isSearch  = a.activityType === 'SEARCH';
  const hasExtra  = a.bytesTransferred > 0 || a.fileSize > 0 || a.updateCount > 1 || a.sessionId || a.remoteAddr;

  return (
    <>
      <TableRow
        hover
        onClick={() => hasExtra && setOpen(o => !o)}
        sx={{
          cursor: hasExtra ? 'pointer' : 'default',
          '& td': { borderColor: T.border, py: 1.2 },
          '&:hover': { bgcolor: `${T.glassBorder}40` },
        }}
      >
        {/* Type */}
        <TableCell sx={{ width: 95, pl: 1.5 }}>
          <TypeChip type={a.activityType} />
        </TableCell>

        {/* File / search — min width so it never collapses to nothing */}
        <TableCell sx={{ minWidth: 160, maxWidth: 320 }}>
          <Tooltip title={a.filePath || a.activityValue || ''} placement="top">
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isSearch ? `"${a.activityValue}"` : fileName(a.filePath || a.activityValue)}
            </Typography>
          </Tooltip>
          {!isSearch && a.fileSize > 0 && (
            <Typography sx={{ fontSize: 10, color: T.textFaint }}>{fmtBytes(a.fileSize)}</Typography>
          )}
        </TableCell>

        {/* User — always visible, avatar + short email */}
        {showUser && (
          <TableCell sx={{ minWidth: 120, maxWidth: 180 }}>
            <Tooltip title={a.userEmail ?? ''}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Avatar sx={{ width: 20, height: 20, bgcolor: '#0d9488', fontSize: 9, flexShrink: 0 }}>
                  {a.userEmail?.[0]?.toUpperCase() ?? '?'}
                </Avatar>
                <Typography sx={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.userEmail}
                </Typography>
              </Box>
            </Tooltip>
          </TableCell>
        )}

        {/* Transferred — always visible */}
        <TableCell sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>
          {a.bytesTransferred > 0 ? (
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.text }}>{fmtBytes(a.bytesTransferred)}</Typography>
              {a.updateCount > 1 && (
                <Chip
                  size="small"
                  icon={<LinkIcon sx={{ fontSize: '9px !important' }} />}
                  label={`${a.updateCount}×`}
                  sx={{ height: 14, fontSize: 9, mt: 0.2, bgcolor: `#0d948818`, color: '#0d9488', '& .MuiChip-icon': { color: '#0d9488' } }}
                />
              )}
            </Box>
          ) : <Typography sx={{ fontSize: 11, color: T.textFaint }}>—</Typography>}
        </TableCell>

        {/* When */}
        <TableCell sx={{ minWidth: 72, whiteSpace: 'nowrap', pr: 1 }}>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>{fmtAgo(a.lastUpdated)}</Typography>
        </TableCell>

        {/* Expand */}
        <TableCell sx={{ width: 28, px: 0 }}>
          {hasExtra && (
            <IconButton size="small" sx={{ color: T.textFaint, p: 0.25 }}>
              {open ? <ExpandLessIcon sx={{ fontSize: 15 }} /> : <ExpandMoreIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      {hasExtra && (
        <TableRow>
          <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? `1px solid ${T.border}` : 'none' }}>
            <Collapse in={open} timeout="auto">
              <Box sx={{ bgcolor: `${T.glassBorder}30`, px: 3, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {a.filePath && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>Path</Typography>
                    <Typography sx={{ fontSize: 12, color: T.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>{a.filePath}</Typography>
                  </Box>
                )}
                {a.sessionId && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>Session</Typography>
                    <Typography sx={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>{a.sessionId?.slice(-32)}</Typography>
                  </Box>
                )}
                {a.remoteAddr && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>IP</Typography>
                    <Typography sx={{ fontSize: 12, color: T.text }}>{a.remoteAddr}</Typography>
                  </Box>
                )}
                {a.updateCount > 1 && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>Connections</Typography>
                    <Chip size="small" label={`${a.updateCount} parallel connections merged into 1`}
                      sx={{ bgcolor: `#0d948820`, color: '#0d9488', fontSize: 11 }} />
                  </Box>
                )}
                {a.createdTime && (
                  <Box>
                    <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>Started</Typography>
                    <Typography sx={{ fontSize: 12, color: T.textMuted }}>{new Date(a.createdTime).toLocaleString()}</Typography>
                  </Box>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── User drill-down panel ────────────────────────────────────────────────────
function UserDrilldown({ userEmail, hours, onClose }) {
  const T = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['cinema-user-activities', userEmail, hours],
    queryFn: () => fetchUserActivities({ userEmail, hours, limit: 50 }),
    enabled: !!userEmail,
  });
  const list = data?.activities ?? [];

  return (
    <Box sx={{ border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden', mt: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.25, bgcolor: `${T.glassBorder}40`, borderBottom: `1px solid ${T.border}` }}>
        <Avatar sx={{ width: 26, height: 26, bgcolor: '#0d9488', fontSize: 11, mr: 1 }}>
          {userEmail?.[0]?.toUpperCase()}
        </Avatar>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1 }}>{userEmail}</Typography>
        <Button size="small" onClick={onClose} sx={{ color: T.textFaint, fontSize: 11 }}>Close</Button>
      </Box>
      {isLoading ? <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: '#0d9488' } }} /> : null}
      <TableContainer sx={{ maxHeight: 320 }}>
        <Table size="small">
          <TableBody>
            {list.map((a, i) => <ActivityRow key={a.id ?? i} activity={a} showUser={false} a={a} />)}
            {!isLoading && list.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: T.textFaint, fontSize: 13 }}>No activities</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Users table ──────────────────────────────────────────────────────────────
function UsersPanel({ hours }) {
  const T = useT();
  const [drillUser, setDrillUser] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['cinema-users', hours],
    queryFn: () => fetchCinemaUsers(hours),
    staleTime: 30_000,
  });
  const users = data?.users ?? [];

  return (
    <Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['User', 'Downloads', 'Streams', 'Searches', 'Total'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: T.textFaint, borderColor: T.border }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            ))}
            {!isLoading && users.map((u, i) => {
              const total = (u.downloadCount ?? 0) + (u.streamCount ?? 0) + (u.searchCount ?? 0);
              return (
                <TableRow
                  key={i} hover
                  onClick={() => setDrillUser(prev => prev === u.userEmail ? null : u.userEmail)}
                  sx={{ cursor: 'pointer', '& td': { borderColor: T.border, py: 1 },
                    bgcolor: drillUser === u.userEmail ? `${'#0d9488'}10` : 'transparent',
                    '&:hover': { bgcolor: `${T.glassBorder}40` } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Avatar sx={{ width: 22, height: 22, bgcolor: '#0d9488', fontSize: 10 }}>
                        {u.userEmail?.[0]?.toUpperCase() ?? '?'}
                      </Avatar>
                      <Typography sx={{ fontSize: 12, color: T.text }}>{u.userEmail}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0d9488' }}>{u.downloadCount ?? 0}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{u.streamCount ?? 0}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{u.searchCount ?? 0}</Typography></TableCell>
                  <TableCell><Chip label={total} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: `${T.glassBorder}60`, color: T.textMuted }} /></TableCell>
                </TableRow>
              );
            })}
            {!isLoading && users.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: T.textFaint }}>No active users</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {drillUser && <UserDrilldown userEmail={drillUser} hours={hours} onClose={() => setDrillUser(null)} />}
    </Box>
  );
}

// ─── Top files panel ──────────────────────────────────────────────────────────
function TopFilesPanel({ files = [], loading }) {
  const T   = useT();
  const max = Math.max(...files.map(f => f.downloadCount ?? 0), 1);
  if (loading) return <Box sx={{ p: 2 }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={38} sx={{ mb: 0.5 }} />)}</Box>;
  if (files.length === 0) return <Typography sx={{ fontSize: 13, color: T.textFaint, textAlign: 'center', py: 4 }}>No data</Typography>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {files.slice(0, 10).map((f, i) => (
        <Box key={i}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Tooltip title={f.filePath || f.fileName || ''}>
              <Typography sx={{ fontSize: 12, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                {fileName(f.filePath || f.fileName)}
              </Typography>
            </Tooltip>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0d9488', ml: 1 }}>{f.downloadCount}×</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(f.downloadCount / max) * 100}
            sx={{ height: 4, borderRadius: 2, bgcolor: `${'#0d9488'}18`, '& .MuiLinearProgress-bar': { bgcolor: '#0d9488' } }}
          />
        </Box>
      ))}
    </Box>
  );
}

// ─── Keywords panel ───────────────────────────────────────────────────────────
function KeywordsPanel({ keywords = [], loading }) {
  const T = useT();
  if (loading) return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} width={90} height={32} sx={{ borderRadius: 4 }} />)}</Box>;
  if (keywords.length === 0) return <Typography sx={{ fontSize: 13, color: T.textFaint }}>No search data</Typography>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
      {keywords.map((k, i) => (
        <Chip
          key={i}
          icon={<SearchIcon sx={{ fontSize: '13px !important' }} />}
          label={`${k.keyword}  ·  ${k.count}`}
          sx={{ bgcolor: `${'#f59e0b'}15`, color: '#b45309', fontWeight: 600, fontSize: 12, border: `1px solid ${'#f59e0b'}30`, '& .MuiChip-icon': { color: '#b45309' } }}
        />
      ))}
    </Box>
  );
}

// ─── CinemaFeed main export ───────────────────────────────────────────────────
export default function CinemaFeed({ hours, activityType, onHoursChange, onTypeChange }) {
  const T    = useT();
  const [subTab, setSubTab]   = useState('feed');
  const [search, setSearch]   = useState('');
  const [limit, setLimit]     = useState(100);

  const { data: recent, isLoading: rLoading, refetch } = useQuery({
    queryKey: ['cinema-recent', hours, activityType, limit],
    queryFn:  () => fetchCinemaRecent({ limit, activityType, hours }),
    staleTime: 15_000,
  });

  const { data: stats, isLoading: sLoading } = useQuery({
    queryKey: ['cinema-dashboard', Math.max(1, Math.round(hours / 24))],
    queryFn:  () => import('./activityApi').then(m => m.fetchCinemaDashboard(Math.max(1, Math.round(hours / 24)))),
    staleTime: 30_000,
  });

  const activities = useMemo(() => {
    const list = recent?.activities ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(a =>
      fileName(a.filePath || a.activityValue)?.toLowerCase().includes(q) ||
      a.userEmail?.toLowerCase().includes(q) ||
      a.activityValue?.toLowerCase().includes(q)
    );
  }, [recent, search]);

  const SUB_TABS = [
    { id: 'feed',     label: 'Feed'      },
    { id: 'users',    label: 'Users'     },
    { id: 'files',    label: 'Top Files' },
    { id: 'keywords', label: 'Keywords'  },
  ];

  const TH = ({ children }) => (
    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: T.textFaint, bgcolor: T.glass, borderColor: T.border }}>
      {children}
    </TableCell>
  );

  return (
    <Box>
      {/* Sub-tab bar */}
      <Box sx={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, px: 2 }}>
        {SUB_TABS.map(t => (
          <Box
            key={t.id}
            onClick={() => setSubTab(t.id)}
            sx={{
              px: 2, py: 1.25, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: subTab === t.id ? '#0d9488' : T.textMuted,
              borderBottom: subTab === t.id ? '2px solid #0d9488' : '2px solid transparent',
              transition: 'all .15s',
              '&:hover': { color: '#0d9488' },
            }}
          >
            {t.label}
          </Box>
        ))}
      </Box>

      {/* Feed */}
      {subTab === 'feed' && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1.5, p: 2, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small" placeholder="Filter by file, user, keyword…"
              value={search} onChange={e => setSearch(e.target.value)}
              sx={{ flex: '1 1 200px' }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: T.textFaint }} /></InputAdornment> }}
            />
            <TextField select size="small" label="Limit" value={limit} onChange={e => setLimit(Number(e.target.value))} sx={{ minWidth: 88 }}>
              {[50, 100, 200, 500].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
            <Typography sx={{ fontSize: 12, color: T.textFaint, ml: 'auto' }}>
              {activities.length}{search ? ' filtered' : ''} entries
            </Typography>
          </Box>

          {rLoading && <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: '#0d9488' } }} />}

          <TableContainer sx={{ maxHeight: { xs: 420, md: 580 }, overflowY: 'auto', overflowX: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TH>Type</TH>
                  <TH>File / Search</TH>
                  <TH>User</TH>
                  <TH>Transferred</TH>
                  <TH>When</TH>
                  <TableCell sx={{ bgcolor: T.glass, borderColor: T.border, width: 28 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rLoading && Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
                ))}
                {!rLoading && activities.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: T.textFaint, fontSize: 13 }}>No activities found</TableCell></TableRow>
                )}
                {activities.map((a, i) => <ActivityRow key={a.id ?? i} a={a} />)}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Users */}
      {subTab === 'users' && (
        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 1.5 }}>
            Click a user to see their individual activity
          </Typography>
          <UsersPanel hours={hours} />
        </Box>
      )}

      {/* Top Files */}
      {subTab === 'files' && (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 2 }}>
            Most downloaded files — parallel connections counted as one
          </Typography>
          <TopFilesPanel files={stats?.topFiles ?? []} loading={sLoading} />
        </Box>
      )}

      {/* Keywords */}
      {subTab === 'keywords' && (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 2 }}>Popular search keywords</Typography>
          <KeywordsPanel keywords={stats?.popularKeywords ?? []} loading={sLoading} />
        </Box>
      )}
    </Box>
  );
}
