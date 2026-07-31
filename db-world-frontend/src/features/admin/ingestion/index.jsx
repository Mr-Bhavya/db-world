import React, { memo, useMemo } from 'react';
import { Box, Chip, Tab, Tabs } from '@mui/material';
import {
  AddRounded,
  DownloadingRounded,
  HistoryRounded,
  LinkOffRounded,
  DriveFileMoveRounded,
  WifiRounded,
  WifiOffRounded,
  SyncRounded,
  ErrorOutlineRounded,
} from '@mui/icons-material';
import { useT } from '@shared/theme';
import {
  AdminPage,
  StickyBar,
  adminSurface,
  useSwipeNav,
} from '@features/admin/adminUi';

import { useIngestionWS } from './hooks/useIngestionWS';
import useIngestionStore from './store/ingestionStore';
import IngestionForm from './form/IngestionForm';
import JobList from './jobs/JobList';
import JobHistory from './history/JobHistory';
import UnassignedFiles from './files/UnassignedFiles';
import LinkFileForm from './files/LinkFileForm';

// ─────────────────────────────────────────────────────────────────────────────
// Tabs (index-based — the store keeps a numeric activeTab). Icons are Rounded
// variants that match each function: add / download / history / unlink / move.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'New Job', Icon: AddRounded, id: 'new-job' },
  { label: 'Live Jobs', Icon: DownloadingRounded, id: 'live' },
  { label: 'History', Icon: HistoryRounded, id: 'history' },
  { label: 'Unassigned', Icon: LinkOffRounded, id: 'unassigned' },
  { label: 'Link File', Icon: DriveFileMoveRounded, id: 'link-file' },
];

// ─────────────────────────────────────────────────────────────────────────────
// WS status chip — token-coloured, flat (no gradients / alpha decorative fills).
// Surfaced as the AdminPage top-bar action so the live connection state stays
// visible without a hero. Reads the same Zustand store slice as before.
// ─────────────────────────────────────────────────────────────────────────────

function wsConfig(T, S, status) {
  switch (status) {
    case 'connected':
      return { text: 'Live', color: T.success, bg: T.successBg, Icon: WifiRounded };
    case 'connecting':
      return { text: 'Connecting…', color: T.warning, bg: T.warningBg, Icon: SyncRounded };
    case 'error':
      return { text: 'WS error', color: T.error, bg: T.errorBg, Icon: ErrorOutlineRounded };
    case 'disconnected':
    default:
      return { text: 'Offline', color: T.textFaint, bg: S.inset, Icon: WifiOffRounded };
  }
}

const WsStatusChip = memo(function WsStatusChip() {
  const T = useT();
  const S = adminSurface(T);
  const wsStatus = useIngestionStore((s) => s.wsStatus);
  const cfg = wsConfig(T, S, wsStatus);
  const spinning = wsStatus === 'connecting';

  return (
    <Chip
      size="small"
      icon={(
        <cfg.Icon
          sx={{
            fontSize: '15px !important',
            color: `${cfg.color} !important`,
            animation: spinning ? 'wsSpin 1s linear infinite' : 'none',
            '@keyframes wsSpin': { to: { transform: 'rotate(360deg)' } },
          }}
        />
      )}
      label={cfg.text}
      sx={{
        height: 30,
        fontWeight: 700,
        fontSize: '0.74rem',
        color: cfg.color,
        bgcolor: cfg.bg,
        borderRadius: 2,
        '& .MuiChip-label': { px: 0.9 },
      }}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main page — clean & flat shell on the shared Admin UI kit. Single-header model
// (title/icon/actions live in the top bar). The tabs bar pins to the top in a
// StickyBar; the panels render DIRECTLY below (each child renders its own cards,
// so there's no card-in-card double wrapper). All WS / Zustand / query / mutation
// logic in the child tabs is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export default function IngestionPage() {
  useIngestionWS();

  const T = useT();

  const activeTab = useIngestionStore((s) => s.activeTab);
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);
  const jobs = useIngestionStore((s) => s.jobs);

  const liveCount = useMemo(() => Object.keys(jobs).length, [jobs]);

  // Swipe between tabs on touch devices (clamped to range).
  const goTo = (i) => setActiveTab(Math.max(0, Math.min(TABS.length - 1, i)));
  const swipe = useSwipeNav({
    onPrev: () => goTo(activeTab - 1),
    onNext: () => goTo(activeTab + 1),
  });

  const panels = useMemo(
    () => [
      <IngestionForm key="new-job" onSubmitted={() => setActiveTab(1)} />,
      <JobList key="live" />,
      <JobHistory key="history" />,
      <UnassignedFiles key="unassigned" />,
      <LinkFileForm key="link-file" />,
    ],
    [setActiveTab]
  );

  return (
    <AdminPage
      title="Media Ingestion"
      subtitle="Download, process, enrich, link and track ingestion jobs"
      icon={DownloadingRounded}
      actions={<WsStatusChip />}
      maxWidth={1440}
    >
      {/* Tabs — pinned to the top of the scroll area (direct AdminPage child) */}
      <StickyBar sx={{ p: 0, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: { xs: 44, sm: 48 },
            px: { xs: 0.5, sm: 1 },
            '& .MuiTab-root': {
              minHeight: { xs: 44, sm: 48 },
              fontSize: { xs: 12, sm: 13 },
              fontWeight: 600,
              textTransform: 'none',
              color: T.textMuted,
              minWidth: { xs: 'auto', md: 110 },
              px: { xs: 1.25, sm: 2 },
              gap: 0.75,
            },
            '& .Mui-selected': { color: `${T.teal} !important` },
            '& .MuiTabs-indicator': { bgcolor: T.teal, height: 2 },
          }}
        >
          {TABS.map(({ label, Icon, id }, i) => (
            <Tab
              key={id}
              value={i}
              id={`ingestion-tab-${i}`}
              aria-controls={`ingestion-panel-${i}`}
              iconPosition="start"
              icon={<Icon sx={{ fontSize: 18 }} />}
              label={
                id === 'live' && liveCount > 0 ? (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                    {label}
                    <Chip
                      label={liveCount}
                      size="small"
                      sx={{
                        height: 18,
                        minWidth: 20,
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        bgcolor: T.tealBg,
                        color: T.teal,
                        '& .MuiChip-label': { px: 0.7 },
                      }}
                    />
                  </Box>
                ) : (
                  label
                )
              }
            />
          ))}
        </Tabs>
      </StickyBar>

      {/* Tab content (swipe-navigable) — children render their own cards, so this
          panel adds no card frame or heavy padding (avoids card-in-card). */}
      <Box
        {...swipe}
        role="tabpanel"
        id={`ingestion-panel-${activeTab}`}
        aria-labelledby={`ingestion-tab-${activeTab}`}
        sx={{ minHeight: { xs: 380, md: 520 } }}
      >
        {panels[activeTab]}
      </Box>
    </AdminPage>
  );
}
