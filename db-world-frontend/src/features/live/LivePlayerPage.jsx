import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';

import usePageMeta from '@shared/hooks/usePageMeta';
import Constants from '@shared/constants';
import notify from '@shared/notify';
import DbWorldVideoPlayer from '@features/cinema/player/hybrid/DbWorldVideoPlayer';
import { useLiveChannel, useLiveChannels } from './liveApi';
import { pushRecent } from './liveRecent';

/**
 * Live-TV player route.
 *
 * Wraps the SAME {@link DbWorldVideoPlayer} the cinema uses, in `live` mode — so the
 * scrims, gestures, volume, fullscreen, PiP, rotation and sheet styling are identical
 * and there is only ever one player to maintain. What this page adds is the thing only
 * live needs: source failover.
 *
 * A channel carries an ordered list of stream URLs. When one dies — geo-blocked, moved,
 * or simply switched off — the page steps to the next and reloads in place, so a dead
 * mirror costs a flicker rather than a black screen.
 */
export default function LivePlayerPage() {
  const { channelId } = useParams();
  const navigate = useNavigate();

  const { data: channel, isLoading, isError } = useLiveChannel(channelId);
  // The full list powers the in-player zapper. It is already cached by the grid the
  // viewer almost always arrives from, so this is usually free.
  const { data: allChannels = [] } = useLiveChannels();

  const [sourceIndex, setSourceIndex] = useState(0);
  const [exhausted, setExhausted]     = useState(false);
  const sources = useMemo(() => channel?.sources ?? [], [channel]);
  const current = sources[sourceIndex] ?? null;

  usePageMeta(channel ? `${channel.name} — Live TV` : 'Live TV', {
    description: channel ? `Watch ${channel.name} live on DB World.` : 'Watch live TV on DB World.',
  });

  // Start from the top of the list again whenever the channel changes.
  useEffect(() => {
    setSourceIndex(0);
    setExhausted(false);
  }, [channelId]);

  // Feeds the grid's "Recently watched" row. Recorded on open rather than on successful
  // playback: with thousands of channels, "the one I just tried" is worth surfacing even
  // if its stream turned out to be dead.
  useEffect(() => { pushRecent(channelId); }, [channelId]);

  // Guards the failover against a burst: hls.js can report several fatal errors in a
  // row for one dead stream, and without this each would advance the index, skipping
  // past working mirrors in a few milliseconds.
  const advancingRef = useRef(false);
  useEffect(() => { advancingRef.current = false; }, [sourceIndex]);

  const handleError = useCallback(() => {
    if (advancingRef.current) return true;
    const next = sourceIndex + 1;
    if (next >= sources.length) {
      setExhausted(true);
      return false;   // nothing left to try — let the player show its own message
    }
    advancingRef.current = true;
    notify.info(`Stream failed — trying source ${next + 1} of ${sources.length}`);
    setSourceIndex(next);
    return true;      // claimed: the player must stay quiet while we swap URLs
  }, [sourceIndex, sources.length]);

  // The zapper groups under one heading per channel, so it takes the primary category.
  // Listing a channel under all of its categories would show it several times in a list
  // whose whole job is "get me to the next channel quickly".
  const zapList = useMemo(
    () => allChannels.map((c) => ({
      id: c.id,
      name: c.name,
      group: c.categories?.[0] ?? 'Other',
      logoUrl: c.logoUrl,
    })),
    [allChannels],
  );

  const selectChannel = useCallback(
    (ch) => navigate(Constants.liveWatchPath(ch.id), { replace: true }),
    [navigate],
  );

  // Feeds the player's Channel-info panel. `host` is the CDN actually serving this
  // mirror, which together with "source N of M" is what tells you why a channel keeps
  // dropping — nothing else in the UI exposes it.
  const liveInfo = useMemo(() => {
    if (!channel || !current) return null;
    let host = null;
    try { host = new URL(current.url).host; } catch { /* malformed url — just omit it */ }
    return {
      categories:  channel.categories ?? [],
      countryName: channel.countryName,
      languages:   channel.languages ?? [],
      quality:     current.quality,
      sourceIndex, 
      sourceCount: sources.length,
      host,
    };
  }, [channel, current, sourceIndex, sources.length]);

  if (isLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
        <CircularProgress sx={{ color: '#14b8a6' }} />
      </div>
    );
  }

  if (isError || !current) {
    return (
      <LiveFailure
        message={isError ? "Couldn't load this channel." : 'This channel has no working stream right now.'}
        onBack={() => navigate(Constants.DB_LIVE_TV_ROUTE)}
      />
    );
  }

  if (exhausted) {
    return (
      <LiveFailure
        message={`All ${sources.length} stream${sources.length === 1 ? '' : 's'} for ${channel.name} are unreachable.`}
        onBack={() => navigate(Constants.DB_LIVE_TV_ROUTE)}
      />
    );
  }

  return (
    <DbWorldVideoPlayer
      // Keyed by the URL actually playing: a failover has to remount the video layer,
      // not just hand the same element a new src, or a wedged hls.js instance survives
      // the switch and the replacement stream never starts.
      key={current.url}
      live
      src={current.url}
      title={channel.name}
      fileId={`live:${channel.id}`}
      channels={zapList}
      currentChannelId={channel.id}
      onSelectChannel={selectChannel}
      liveInfo={liveInfo}
      onError={handleError}
      onClose={() => navigate(Constants.DB_LIVE_TV_ROUTE)}
    />
  );
}

function LiveFailure({ message, onBack }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'grid',
      placeItems: 'center', color: '#fff', textAlign: 'center', padding: 24 }}>
      <div style={{ display: 'grid', gap: 16, placeItems: 'center' }}>
        <div>{message}</div>
        <button onClick={onBack}
          style={{ padding: '10px 22px', background: '#14b8a6', color: '#fff', border: 'none',
            borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          Back to channels
        </button>
      </div>
    </div>
  );
}
