import React from 'react';
import { Box, Drawer, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { notify } from '@shared/notify';
import {
  fmtDateTime, numStatus, numDuration, levelColor, methodColor, statusColor, parseMd5, isRequestEntry, parseRawLine,
} from './logUtils';

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };

const copy = (text) => {
  try { navigator.clipboard?.writeText(String(text)); notify.success('Copied'); } catch { /* ignore */ }
};

function Field({ label, value, copyable, monospace }) {
  const T = useT();
  const S = adminSurface(T);
  if (value === undefined || value === null || value === '') return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.9, borderBottom: `1px solid ${S.divider}`, '&:hover .copybtn': { opacity: 1 } }}>
      <Typography sx={{ flex: '0 0 104px', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.textFaint, pt: 0.2 }}>
        {label}
      </Typography>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: T.text, wordBreak: 'break-all', ...(monospace ? mono : {}) }}>
        {value}
      </Typography>
      {copyable && (
        <IconButton className="copybtn" size="small" onClick={() => copy(value)} sx={{ opacity: 0, transition: 'opacity .15s', color: T.textFaint, '&:hover': { color: T.teal } }} aria-label={`Copy ${label}`}>
          <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  );
}

function Body({ entry, dark }) {
  const T = useT();
  const S = adminSurface(T);
  const isStr = typeof entry === 'string';
  const req = !isStr && isRequestEntry(entry);
  const md5 = !isStr ? parseMd5(entry.md5) : null;
  const raw = isStr ? entry : JSON.stringify(entry, null, 2);
  const stack = !isStr && (entry.stacktrace || entry.exception);

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 3 }}>
      {isStr ? (
        (() => {
          const p = parseRawLine(entry);
          return (
            <>
              {p && (
                <>
                  <Field label="Level" value={p.level} />
                  <Field label="Logger" value={p.logger} copyable monospace />
                  <Field label="Thread" value={p.thread} monospace />
                  <Field label="Timestamp" value={fmtDateTime(p.timestamp)} monospace />
                  <Field label="Message" value={p.message} />
                </>
              )}
              <Box sx={{ mt: p ? 2 : 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', color: T.textFaint }}>Raw line</Typography>
                  <Tooltip title="Copy line"><IconButton size="small" onClick={() => copy(entry)} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}><ContentCopyRoundedIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                </Box>
                <Box component="pre" sx={{ ...mono, m: 0, p: 1.25, fontSize: '0.74rem', color: T.text, bgcolor: S.inset, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 320 }}>{entry}</Box>
              </Box>
            </>
          );
        })()
      ) : req ? (
        <>
          <Field label="Method" value={entry.method} />
          <Field label="URI" value={entry.uri} copyable monospace />
          <Field label="Status" value={`${numStatus(entry) || entry.status || '—'}${entry.errorStatus ? '  ·  error' : ''}`} monospace />
          <Field label="Duration" value={numDuration(entry) ? `${numDuration(entry)} ms` : entry.duration} monospace />
          <Field label="Error" value={entry.errorStatus === undefined ? undefined : entry.errorStatus ? 'Yes' : 'No'} />
          <Field label="User" value={entry.user && entry.user !== '-' ? entry.user : undefined} copyable monospace />
          <Field label="Request ID" value={entry.requestId} copyable monospace />
          <Field label="Trace ID" value={entry.traceId} copyable monospace />
          <Field label="Thread" value={entry.thread} monospace />
          <Field label="Logger" value={entry.logger} copyable monospace />
          {md5 && (
            <Box sx={{ display: 'flex', gap: 1, py: 0.9, borderBottom: `1px solid ${S.divider}` }}>
              <Typography sx={{ flex: '0 0 104px', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', color: T.textFaint }}>MD5</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {Object.entries(md5).map(([k, v]) => (
                  <Box key={k} onClick={() => copy(v)} sx={{ cursor: 'pointer', ...mono, fontSize: '0.7rem', px: 0.75, py: 0.35, borderRadius: 1, bgcolor: S.inset, border: `1px solid ${S.border}`, color: T.textMuted }}>
                    {k}: {v}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          <Field label="Message" value={entry.message} />
        </>
      ) : (
        <>
          <Field label="Level" value={entry.level} />
          <Field label="Logger" value={entry.logger} copyable monospace />
          <Field label="Thread" value={entry.thread} monospace />
          <Field label="Trace ID" value={entry.traceId} copyable monospace />
          <Field label="Request ID" value={entry.requestId} copyable monospace />
          <Field label="Timestamp" value={fmtDateTime(entry.timestamp)} monospace />
          <Field label="Message" value={entry.message} />
        </>
      )}

      {stack && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', color: T.error, mb: 0.75 }}>
            {entry.stacktrace ? 'Stacktrace' : 'Exception'}
          </Typography>
          <Box component="pre" sx={{ ...mono, m: 0, p: 1.25, fontSize: '0.72rem', color: dark ? '#fca5a5' : '#991b1b', bgcolor: T.errorBg, border: `1px solid ${T.error}44`, borderRadius: 2, overflow: 'auto', whiteSpace: 'pre-wrap', maxHeight: 260 }}>
            {stack}
          </Box>
        </Box>
      )}

      {!isStr && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', color: T.textFaint }}>Raw JSON</Typography>
            <Tooltip title="Copy JSON"><IconButton size="small" onClick={() => copy(raw)} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}><ContentCopyRoundedIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
          </Box>
          <Box component="pre" sx={{ ...mono, m: 0, p: 1.25, fontSize: '0.72rem', color: T.text, bgcolor: S.inset, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'auto', whiteSpace: 'pre', maxHeight: 320 }}>
            {raw}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Full-detail view of one entry — right drawer on desktop, bottom sheet on mobile. */
export default function LogDetailDrawer({ entry, onClose }) {
  const T = useT();
  const S = adminSurface(T);
  const dark = T.bg === '#000000';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isStr = typeof entry === 'string';
  const req = entry && !isStr && isRequestEntry(entry);

  const title = !entry ? '' : isStr ? 'Log line'
    : req
      ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          {entry.method && <Box component="span" sx={{ ...mono, fontSize: '0.72rem', fontWeight: 800, px: 0.6, py: '1px', borderRadius: 0.75, color: methodColor(entry.method, dark), bgcolor: `${methodColor(entry.method, dark)}1f` }}>{entry.method}</Box>}
          <Box component="span" sx={{ ...mono, fontSize: '0.78rem', fontWeight: 800, color: statusColor(numStatus(entry), dark) }}>{numStatus(entry) || ''}</Box>
          <Box component="span" sx={{ ...mono, fontSize: '0.8rem', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.uri}</Box>
        </Box>
      )
      : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Box component="span" sx={{ ...mono, fontSize: '0.72rem', fontWeight: 800, px: 0.6, py: '1px', borderRadius: 0.75, color: levelColor(entry.level, dark), bgcolor: `${levelColor(entry.level, dark)}1f` }}>{String(entry.level || 'LOG').slice(0, 4)}</Box>
          <Box component="span" sx={{ fontSize: '0.82rem', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.logger || 'Log entry'}</Box>
        </Box>
      );

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'} open={!!entry} onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: S.card, color: T.text, backgroundImage: 'none', display: 'flex', flexDirection: 'column',
          width: isMobile ? '100%' : 'min(480px, 92vw)',
          height: isMobile ? '86vh' : '100%',
          borderTopLeftRadius: isMobile ? 18 : 0, borderTopRightRadius: isMobile ? 18 : 0,
          borderLeft: isMobile ? 'none' : `1px solid ${S.border}`,
        },
      }}
    >
      {isMobile && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: S.border, mx: 'auto', mt: 1.25 }} />}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: `1px solid ${S.border}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textFaint, mb: 0.25 }}>
            {entry && !isStr ? fmtDateTime(entry.timestamp) : 'Detail'}
          </Typography>
          {title}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close" sx={{ color: T.textMuted, '&:hover': { color: T.text } }}>
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
      {entry && <Body entry={entry} dark={dark} />}
    </Drawer>
  );
}
