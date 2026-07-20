// Standalone demo harness for the hybrid video player.
//
// It renders the REAL <DbWorldVideoPlayer /> — the exact component used in production —
// with mock data for a movie and a TV show, so the whole UI (episode sidebar, rich
// audio/quality labels, scroll/slider volume, multi-range buffered bar, large-screen
// scaling + focus rings) can be exercised without a backend or real media.
//
// Route: /db-world/db-cinema/player/demo  (public; the "/player" path hides app chrome).
//
// NOTE: local-only harness — NOT committed. SAMPLE points at a personal cdn.db-world.in
// file (swap for your own). Signing is off, so this unsigned URL works as-is. Desktop
// <video> playback of an MKV/HEVC file depends on the browser's codec support; the native
// app (ExoPlayer) plays it, and the whole UI (controls, panels, labels, scaling) renders
// either way — that's what this demo is for.
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DbWorldVideoPlayer from './DbWorldVideoPlayer';
import Constants from '@shared/constants';

const SAMPLE_A = 'https://cdn.db-world.in/id/6102ced0-0012-4629-93ca-9dd7e902d92c?userId=dudhiabhavya%40gmail.com&type=ONLINE&originalFile=Super.Subbu.S01E01.Subbu.S-o.Kukku.1080p.WEB-DL.H265.10Bit.Hindi.DDP.5.1.mkv&downloadId=DL_66e63b32_60404&requestId=a9e8fa6c-da84-4862-adbb-2fc516c114f2';
const SAMPLE_B = SAMPLE_A;
const TEAL = '#0d9488';

// Rich audio metadata → the audio menu shows "Hindi · DDP Atmos · 768 kbps", etc.
// Mirrors the real backend MediaInfo shape: bitRate is a PRE-FORMATTED STRING and the
// sample-rate field is `samplingRate` (Hz) — exercises bitrateText()/sampleRateLabel().
const AUDIO = [
  { language: 'Hindi',   channels: 8, channelLayout: 'L R C LFE Ls Rs', formatCommercial: 'E-AC-3 JOC', format: 'E-AC-3', bitRate: '768 kb/s', samplingRate: 48000 }, // → DDP Atmos
  { language: 'English', channels: 6, channelLayout: 'L R C LFE Ls Rs', formatCommercial: 'E-AC-3',     format: 'E-AC-3', bitRate: '640 kb/s', samplingRate: 48000 }, // → DDP 5.1
  { language: 'Tamil',   channels: 6, channelLayout: 'L R C LFE Ls Rs', formatCommercial: 'AC-3',       format: 'AC-3',   bitRate: '448 kb/s', samplingRate: 48000 }, // → DD 5.1
];

const MOVIE = {
  title: 'Big Buck Bunny',
  overview: 'A large, good-natured rabbit befriends two curious squirrels — until three rodent bullies pick the wrong forest to torment. A short, sweet tale of gentle revenge.',
  src: SAMPLE_A,
  fileId: 'demo-movie',
  audio: AUDIO,
  variants: [
    { url: SAMPLE_A, label: '1080p', height: 1080, mediaFileId: 'demo-movie',     codec: 'H.265', hdr: ['HDR10'] },
    { url: SAMPLE_B, label: '720p',  height: 720,  mediaFileId: 'demo-movie-720', codec: 'H.264', hdr: [] },
  ],
  episodes: [],
};

const pad2 = (n) => String(n).padStart(2, '0');
const mkEp = (n, name, runtime, overview, url) => ({
  id: `s1e${n}`, fileId: `s1e${n}`, mediaFileId: `s1e${n}`,
  season: 1, episode: n, name, runtime, overview,
  label: `S01E${pad2(n)}`,   // in production this comes from buildHybridEpisodes
  stillPath: null,           // no TMDB still in the demo → the row shows the placeholder icon
  url,
});
const TV = {
  title: 'Stranger Things',
  audio: AUDIO,
  variants: [
    { url: SAMPLE_A, label: '1080p', height: 1080, mediaFileId: 's1-1080', codec: 'H.265', hdr: ['HDR10'] },
    { url: SAMPLE_B, label: '720p',  height: 720,  mediaFileId: 's1-720',  codec: 'H.264', hdr: [] },
  ],
  episodes: [
    mkEp(1, 'The Vanishing of Will Byers', 48, 'On his way home from a friend’s house, young Will sees something terrifying. Nearby, a sinister secret lurks in the depths of a government lab.', SAMPLE_A),
    mkEp(2, 'The Weirdo on Maple Street',  55, 'Lucas, Mike and Dustin try to talk to the girl they found in the woods. Hopper questions an anxious Joyce about an unsettling phone call.', SAMPLE_B),
    mkEp(3, 'Holly, Jolly',                52, 'An increasingly concerned Nancy looks for Barb and finds something suspicious. Will’s friends confront their fears while a distraught Joyce tries to reach him.', SAMPLE_A),
  ],
};

export default function PlayerDemo() {
  const navigate = useNavigate();
  const [scenario, setScenario] = useState(null);          // 'movie' | 'tv' | null (chooser)
  const [cur, setCur] = useState(null);                    // { src, fileId, currentEpisodeId }

  const openMovie = () => { setCur({ src: MOVIE.src, fileId: MOVIE.fileId, currentEpisodeId: null }); setScenario('movie'); };
  const openTv = () => {
    const first = TV.episodes[0];
    setCur({ src: first.url, fileId: first.fileId, currentEpisodeId: first.id });
    setScenario('tv');
  };
  // Mirrors HybridPlayerPage.selectEpisode: swap the source + current-episode id.
  const onSelectEpisode = useCallback((ep) => {
    setCur({ src: ep.url || SAMPLE_A, fileId: ep.fileId, currentEpisodeId: ep.id });
  }, []);
  const close = () => { setScenario(null); setCur(null); };

  if (!scenario) {
    const Card = ({ title, subtitle, onClick }) => (
      <button onClick={onClick}
        style={{ flex: 1, minWidth: 220, maxWidth: 300, textAlign: 'left', cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14, padding: '22px 20px', color: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#9aa', lineHeight: 1.5 }}>{subtitle}</div>
      </button>
    );
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0b0b0b', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 22, padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 640 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>Player demo</div>
          <div style={{ fontSize: 13.5, color: '#9aa', marginTop: 8, lineHeight: 1.6 }}>
            The real player with mock data. Try the episode sidebar, the Audio &amp; Quality menus,
            scroll-wheel / slider volume, the loaded-segments bar, and resize the window large (or
            open on a TV) to see the controls scale up. Tab / arrow keys show the focus rings.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
          <Card title="Movie" subtitle="Single title · quality + audio menus · no episode list." onClick={openMovie} />
          <Card title="TV show" subtitle="Season 1 · episode sidebar with titles, runtimes &amp; synopses." onClick={openTv} />
        </div>
        <button onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
          style={{ marginTop: 6, background: 'transparent', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ← Back to DB World
        </button>
        <div style={{ fontSize: 11.5, color: '#666', maxWidth: 560, textAlign: 'center' }}>
          Points at a personal CDN test file — swap the <code style={{ color: '#999' }}>SAMPLE</code> URL for your own. MKV/HEVC may not play in a desktop browser; the native app plays it.
        </div>
      </div>
    );
  }

  const data = scenario === 'movie' ? MOVIE : TV;
  return (
    <DbWorldVideoPlayer
      key={scenario}
      src={cur.src}
      fileId={cur.fileId}
      title={data.title}
      overview={data.overview || ''}
      variants={data.variants}
      episodes={data.episodes}
      currentEpisodeId={cur.currentEpisodeId}
      onSelectEpisode={onSelectEpisode}
      audio={data.audio}
      onProgress={() => {}}
      onClose={close}
      storyboard={null}
      requestId={null}
      mediaFileId={cur.fileId}
      recordId={null}
    />
  );
}
