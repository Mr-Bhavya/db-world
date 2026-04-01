import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ── Mock middleware for /api/stream/media-info/:recordId ───────────────────────
function mediaInfoMockPlugin() {
  return {
    name: 'media-info-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/api\/stream\/media-info\/(\d+)$/);
        if (!match) return next();

        const recordId = Number(match[1]);

        const makeFile = (id, fileName, vWidth, vHeight, vFormat, vCodecID, vBitRate, vHdr, vHdrCompat, vBitDepth, vColorSpace, audioTracks) => ({
          id,
          recordId,
          fileName,
          filePath: `/media/movies/${fileName}`,
          fileSize: vBitRate * 7440,
          mimeType: 'video/x-matroska',
          createdAt: '2024-06-01T10:00:00Z',
          trackInfos: [
            {
              type: 'General',
              format: 'Matroska',
              fileSize: vBitRate * 7440,
              duration: 7440000,
              overallBitRate: vBitRate + 500000,
              videoCount: 1,
              audioCount: audioTracks.length,
              textCount: 2,
              frameRate: '23.976',
              isStreamable: 'Yes',
              encodedApplication: 'mkvmerge v82.0',
            },
            {
              type: 'Video',
              width: vWidth,
              height: vHeight,
              frameRate: '23.976',
              frameRateMode: 'CFR',
              bitRate: vBitRate,
              bitDepth: vBitDepth,
              colorSpace: vColorSpace,
              chromaSubsampling: '4:2:0',
              hdrFormat: vHdr || null,
              hdrFormatCompatibility: vHdrCompat || null,
              format: vFormat,
              formatCommercialIfAny: vFormat === 'HEVC' ? 'HEVC' : vFormat === 'AVC' ? 'AVC' : vFormat,
              codecID: vCodecID,
              formatProfile: vFormat === 'HEVC' ? 'Main 10@L5.1@High' : 'High@L4.1',
              displayAspectRatio: (vWidth / vHeight),
              streamSize: vBitRate * 7440 * 0.9,
              duration: 7440000,
            },
            ...audioTracks.map((a, i) => ({
              type: 'Audio',
              streamOrder: i + 1,
              language: a.language,
              format: a.format,
              formatCommercialIfAny: a.label,
              codecID: a.codecID,
              bitRate: a.bitRate,
              channels: a.channels,
              channelLayout: a.channelLayout,
              samplingRate: 48000,
              streamSize: a.bitRate * 7440,
              duration: 7440000,
              defaultFlag: i === 0 ? 'Yes' : 'No',
              forced: 'No',
            })),
            { type: 'Text', language: 'en', format: 'UTF-8', formatCommercialIfAny: 'SRT', codecID: 'S_TEXT/UTF8', forced: 'No', defaultFlag: 'No' },
            { type: 'Text', language: 'es', format: 'UTF-8', formatCommercialIfAny: 'SRT', codecID: 'S_TEXT/UTF8', forced: 'No', defaultFlag: 'No' },
          ],
        });

        const atmos71 = [{ language: 'en', label: 'Dolby TrueHD Atmos', format: 'TrueHD', codecID: 'A_TRUEHD', bitRate: 3500000, channels: 8, channelLayout: 'L R C LFE Ls Rs Lss Rss' }];
        const dts71   = [{ language: 'en', label: 'DTS-HD MA',           format: 'DTS',     codecID: 'A_DTS',    bitRate: 4600000, channels: 8, channelLayout: 'L R C LFE Ls Rs Lss Rss' }];
        const atmos51 = [{ language: 'en', label: 'Dolby Atmos',         format: 'E-AC-3',  codecID: 'A_EAC3',   bitRate:  768000, channels: 6, channelLayout: 'L R C LFE Ls Rs' }];
        const aac20   = [{ language: 'en', label: 'AAC',                  format: 'AAC',     codecID: 'A_AAC',    bitRate:  192000, channels: 2, channelLayout: 'L R' }];

        // Use even recordId → movie mock, odd → series mock
        const isSeries = recordId % 2 !== 0;

        const movieData = [
          makeFile('mock-4k-dv',      `Movie.4K.DV.HDR10.HEVC.TrueHD.Atmos.7.1.mkv`,      3840, 2160, 'HEVC', 'V_MPEGH/ISO/HEVC', 18000000, 'Dolby Vision', 'HDR10',  10, 'BT.2020', atmos71),
          makeFile('mock-4k-hdr',     `Movie.4K.HDR10Plus.HEVC.DTS-HD.MA.7.1.mkv`,         3840, 2160, 'HEVC', 'V_MPEGH/ISO/HEVC', 15000000, 'HDR10+',       null,     10, 'BT.2020', dts71),
          makeFile('mock-1080p-hdr',  `Movie.1080p.HDR10.HEVC.Atmos.5.1.mkv`,              1920, 1080, 'HEVC', 'V_MPEGH/ISO/HEVC',  8000000, 'HDR10',        null,     10, 'BT.2020', [...atmos51, { language: 'fr', label: 'Dolby Atmos', format: 'E-AC-3', codecID: 'A_EAC3', bitRate: 640000, channels: 6, channelLayout: 'L R C LFE Ls Rs' }]),
          makeFile('mock-1080p-h264', `Movie.1080p.BluRay.H264.AAC.2.0.mkv`,               1920, 1080, 'AVC',  'V_MPEG4/ISO/AVC',   6000000, null,           null,      8, 'BT.709',  aac20),
          makeFile('mock-720p-h265',  `Movie.720p.BluRay.HEVC.AAC.2.0.mkv`,                1280,  720, 'HEVC', 'V_MPEGH/ISO/HEVC',  4500000, null,           null,      8, 'BT.709',  aac20),
          makeFile('mock-720p-h264',  `Movie.720p.BluRay.H264.AAC.2.0.mkv`,                1280,  720, 'AVC',  'V_MPEG4/ISO/AVC',   3500000, null,           null,      8, 'BT.709',  aac20),
        ];

        const ep = (season, ep, q, w, h, fmt, cid, br, hdr, hdrC, bd, cs, audio, sfx) =>
          makeFile(`s${season}e${ep}-${q}`, `Series.S${String(season).padStart(2,'0')}E${String(ep).padStart(2,'0')}.${q}.${sfx}.mkv`, w, h, fmt, cid, br, hdr, hdrC, bd, cs, audio);

        const seriesData = [
          // Season 1 — 1080p H.265 HDR + 720p H.264
          ep(1,1,'1080p',1920,1080,'HEVC','V_MPEGH/ISO/HEVC',8000000,'HDR10',null,10,'BT.2020', atmos51,'HDR.HEVC.Atmos.5.1'),
          ep(1,2,'1080p',1920,1080,'HEVC','V_MPEGH/ISO/HEVC',8000000,'HDR10',null,10,'BT.2020', atmos51,'HDR.HEVC.Atmos.5.1'),
          ep(1,3,'1080p',1920,1080,'HEVC','V_MPEGH/ISO/HEVC',8000000,'HDR10',null,10,'BT.2020', atmos51,'HDR.HEVC.Atmos.5.1'),
          ep(1,1,'720p', 1280, 720,'AVC', 'V_MPEG4/ISO/AVC', 3500000, null,  null, 8,'BT.709',  aac20,  'H264.AAC'),
          ep(1,2,'720p', 1280, 720,'AVC', 'V_MPEG4/ISO/AVC', 3500000, null,  null, 8,'BT.709',  aac20,  'H264.AAC'),
          ep(1,3,'720p', 1280, 720,'AVC', 'V_MPEG4/ISO/AVC', 3500000, null,  null, 8,'BT.709',  aac20,  'H264.AAC'),
          // Season 2 — 4K DV + 1080p + 720p
          ep(2,1,'4K',   3840,2160,'HEVC','V_MPEGH/ISO/HEVC',18000000,'Dolby Vision','HDR10',10,'BT.2020', atmos71,'DV.HDR10.HEVC.Atmos.7.1'),
          ep(2,2,'4K',   3840,2160,'HEVC','V_MPEGH/ISO/HEVC',18000000,'Dolby Vision','HDR10',10,'BT.2020', atmos71,'DV.HDR10.HEVC.Atmos.7.1'),
          ep(2,1,'1080p',1920,1080,'HEVC','V_MPEGH/ISO/HEVC', 8000000,'HDR10',null,10,'BT.2020', atmos51,'HDR.HEVC.Atmos.5.1'),
          ep(2,2,'1080p',1920,1080,'HEVC','V_MPEGH/ISO/HEVC', 8000000,'HDR10',null,10,'BT.2020', atmos51,'HDR.HEVC.Atmos.5.1'),
          ep(2,1,'720p', 1280, 720,'AVC', 'V_MPEG4/ISO/AVC',  3500000, null, null,  8,'BT.709',  aac20,  'H264.AAC'),
          // Season 3 — only 1080p H.264 (not all qualities mandatory)
          ep(3,1,'1080p',1920,1080,'AVC', 'V_MPEG4/ISO/AVC',  6000000, null, null,  8,'BT.709',  aac20,  'H264.AAC'),
          ep(3,2,'1080p',1920,1080,'AVC', 'V_MPEG4/ISO/AVC',  6000000, null, null,  8,'BT.709',  aac20,  'H264.AAC'),
          ep(3,3,'1080p',1920,1080,'AVC', 'V_MPEG4/ISO/AVC',  6000000, null, null,  8,'BT.709',  aac20,  'H264.AAC'),
          ep(3,4,'1080p',1920,1080,'AVC', 'V_MPEG4/ISO/AVC',  6000000, null, null,  8,'BT.709',  aac20,  'H264.AAC'),
        ];

        const mockData = isSeries ? seriesData : movieData;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ httpStatusCode: 200, message: 'Mock data', data: mockData }));
      });
    },
  };
}

// ── Mock records dataset (used by both search plugins) ─────────────────────────
const MOCK_RECORDS = [
  // ── Movies (even IDs → movie media files in media-info mock) ──────────────
  { id: 2,  name: 'Dune: Part Two',            type: 'MOVIE',  tmdb_id: 693134,
    movieTmdb: { id: 693134, title: 'Dune: Part Two', overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.', posterPath: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', backdropPath: '/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg', releaseDate: '2024-03-01', voteAverage: 8.3, genres: [{ id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }] } },
  { id: 4,  name: 'Oppenheimer',               type: 'MOVIE',  tmdb_id: 872585,
    movieTmdb: { id: 872585, title: 'Oppenheimer', overview: 'The story of J. Robert Oppenheimer\'s role in the development of the atomic bomb during World War II.', posterPath: '/8Gxv8giaFEJCZqbyZIgfN9MQrAN.jpg', backdropPath: '/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg', releaseDate: '2023-07-19', voteAverage: 8.1, genres: [{ id: 18, name: 'Drama' }, { id: 36, name: 'History' }] } },
  { id: 6,  name: 'The Dark Knight',           type: 'MOVIE',  tmdb_id: 155,
    movieTmdb: { id: 155, title: 'The Dark Knight', overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague Gotham City.', posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', backdropPath: '/hkBaDkMWbLaf8B1lsWsfffqe4qM.jpg', releaseDate: '2008-07-14', voteAverage: 8.5, genres: [{ id: 28, name: 'Action' }, { id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }] } },
  { id: 8,  name: 'Inception',                 type: 'MOVIE',  tmdb_id: 27205,
    movieTmdb: { id: 27205, title: 'Inception', overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible.', posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', backdropPath: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg', releaseDate: '2010-07-15', voteAverage: 8.4, genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }] } },
  { id: 10, name: 'Interstellar',              type: 'MOVIE',  tmdb_id: 157336,
    movieTmdb: { id: 157336, title: 'Interstellar', overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.', posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', backdropPath: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg', releaseDate: '2014-11-05', voteAverage: 8.4, genres: [{ id: 12, name: 'Adventure' }, { id: 18, name: 'Drama' }, { id: 878, name: 'Science Fiction' }] } },
  { id: 12, name: 'Parasite',                  type: 'MOVIE',  tmdb_id: 496243,
    movieTmdb: { id: 496243, title: 'Parasite', overview: 'All unemployed, Ki-taek\'s family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.', posterPath: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', backdropPath: '/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg', releaseDate: '2019-05-30', voteAverage: 8.5, genres: [{ id: 35, name: 'Comedy' }, { id: 53, name: 'Thriller' }, { id: 18, name: 'Drama' }] } },
  { id: 14, name: 'Avatar: The Way of Water', type: 'MOVIE',  tmdb_id: 76600,
    movieTmdb: { id: 76600, title: 'Avatar: The Way of Water', overview: 'Set more than a decade after the events of the first film, Jake Sully and Ney\'tiri have formed a family and are doing everything to stay together.', posterPath: '/t6HIqrRAclMCA60NsSbj3HOkzaw.jpg', backdropPath: '/s16H6tpK2utvwpazerae4g0wbli.jpg', releaseDate: '2022-12-14', voteAverage: 7.7, genres: [{ id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }, { id: 28, name: 'Action' }] } },
  { id: 16, name: 'John Wick: Chapter 4',      type: 'MOVIE',  tmdb_id: 603692,
    movieTmdb: { id: 603692, title: 'John Wick: Chapter 4', overview: 'With the price on his head ever increasing, John Wick uncovers a path to defeating The High Table. But before he can earn his freedom, Wick must face off against a new enemy with powerful alliances across the globe.', posterPath: '/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg', backdropPath: '/9p1Q0dp5E5znKwXcB4G2qMmhWjS.jpg', releaseDate: '2023-03-22', voteAverage: 7.8, genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }, { id: 80, name: 'Crime' }] } },

  // ── Series (odd IDs → series media files in media-info mock) ─────────────
  { id: 1,  name: 'Breaking Bad',              type: 'SERIES', tmdb_id: 1396,
    seriesTmdb: { id: 1396, title: 'Breaking Bad', name: 'Breaking Bad', overview: 'When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given only two years to live, he partners with his former student, Jesse Pinkman, to produce and sell methamphetamine.', posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', backdropPath: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg', firstAirDate: '2008-01-20', voteAverage: 9.5, genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }, { id: 53, name: 'Thriller' }] } },
  { id: 3,  name: 'The Bear',                  type: 'SERIES', tmdb_id: 136315,
    seriesTmdb: { id: 136315, title: 'The Bear', name: 'The Bear', overview: 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.', posterPath: '/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', backdropPath: '/qRc6GeMpLVZm5gCOKXG0kTH1Ibl.jpg', firstAirDate: '2022-06-23', voteAverage: 8.7, genres: [{ id: 18, name: 'Drama' }, { id: 35, name: 'Comedy' }] } },
  { id: 5,  name: 'Shogun',                    type: 'SERIES', tmdb_id: 126308,
    seriesTmdb: { id: 126308, title: 'Shogun', name: 'Shogun', overview: 'In feudal Japan, a mysterious European ship is found adrift in a nearby fishing village. On board is the ship\'s navigator, John Blackthorne, whose presence sets off a dangerous power struggle.', posterPath: '/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg', backdropPath: '/9OlkB0T7EiUGMD5OEYTMTQ0sfHV.jpg', firstAirDate: '2024-02-27', voteAverage: 8.7, genres: [{ id: 18, name: 'Drama' }, { id: 28, name: 'Action' }] } },
  { id: 7,  name: 'House of the Dragon',       type: 'SERIES', tmdb_id: 94997,
    seriesTmdb: { id: 94997, title: 'House of the Dragon', name: 'House of the Dragon', overview: 'The story of the House Targaryen set 200 years before the events of Game of Thrones.', posterPath: '/z2yahl2uefxDCl0nogcRBstwruJ.jpg', backdropPath: '/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg', firstAirDate: '2022-08-21', voteAverage: 8.4, genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 18, name: 'Drama' }, { id: 28, name: 'Action' }] } },
  { id: 9,  name: 'Succession',                type: 'SERIES', tmdb_id: 76479,
    seriesTmdb: { id: 76479, title: 'Succession', name: 'Succession', overview: 'The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their father steps down from the company.', posterPath: '/e2X8fBqa5bQTKJR0FDlhD8xzjGe.jpg', backdropPath: '/1TCjeNFm7hNMlZXRgRfjpELOxeU.jpg', firstAirDate: '2018-06-03', voteAverage: 8.7, genres: [{ id: 18, name: 'Drama' }] } },
  { id: 11, name: 'The Last of Us',            type: 'SERIES', tmdb_id: 100088,
    seriesTmdb: { id: 100088, title: 'The Last of Us', name: 'The Last of Us', overview: 'Twenty years after modern civilization has been destroyed, Joel is hired to smuggle Ellie out of an oppressive quarantine zone. What starts as a small job soon becomes a brutal, heartbreaking journey.', posterPath: '/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', backdropPath: '/9IgMzYUkpCaLBDwAMhH6mFsHxnq.jpg', firstAirDate: '2023-01-15', voteAverage: 8.8, genres: [{ id: 10759, name: 'Action & Adventure' }, { id: 18, name: 'Drama' }, { id: 878, name: 'Science Fiction' }] } },
  { id: 13, name: 'Severance',                 type: 'SERIES', tmdb_id: 95396,
    seriesTmdb: { id: 95396, title: 'Severance', name: 'Severance', overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to uncover the truth about their jobs.', posterPath: '/bJWbRkMdz4rY6a1fkNXL5gBsX5q.jpg', backdropPath: '/5Y4VxdFXJIlCkgAoXMl7K8hpSb7.jpg', firstAirDate: '2022-02-18', voteAverage: 8.7, genres: [{ id: 18, name: 'Drama' }, { id: 878, name: 'Science Fiction' }, { id: 9648, name: 'Mystery' }] } },
  { id: 15, name: 'Fallout',                   type: 'SERIES', tmdb_id: 106379,
    seriesTmdb: { id: 106379, title: 'Fallout', name: 'Fallout', overview: 'In a future, post-apocalyptic Los Angeles brought about by nuclear decimation, citizens must live in underground bunkers to protect themselves from radiation, mutants and bandits.', posterPath: '/AnsSKR8EDMqeqNQ0UvmKiKHJpXs.jpg', backdropPath: '/jLLtx3nTRSLZqMaqbq8QLFT0fC7.jpg', firstAirDate: '2024-04-10', voteAverage: 8.5, genres: [{ id: 10759, name: 'Action & Adventure' }, { id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 18, name: 'Drama' }] } },
  { id: 17, name: 'True Detective',            type: 'SERIES', tmdb_id: 46648,
    seriesTmdb: { id: 46648, title: 'True Detective', name: 'True Detective', overview: 'An anthology crime drama series. Each season features a new story and cast of characters.', posterPath: '/lVg6kFxMzECdB6y2DMdFElxsBpV.jpg', backdropPath: '/uyFJlsyRvZUDMqmGp0uwxVBvFNn.jpg', firstAirDate: '2014-01-12', voteAverage: 8.5, genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }] } },
  { id: 19, name: 'Chernobyl',                 type: 'SERIES', tmdb_id: 87108,
    seriesTmdb: { id: 87108, title: 'Chernobyl', name: 'Chernobyl', overview: 'The true story of one of the worst man-made catastrophes in history — and of the brave men and women who sacrificed to save Europe from unimaginable disaster.', posterPath: '/hlLXt2tOPy1e7p5O3V9PZJqO4c.jpg', backdropPath: '/hiErMLRSVJFuoA04HWDfmBCDqAQ.jpg', firstAirDate: '2019-05-06', voteAverage: 9.4, genres: [{ id: 18, name: 'Drama' }, { id: 36, name: 'History' } ] } },
  { id: 21, name: 'Andor',                     type: 'SERIES', tmdb_id: 83867,
    seriesTmdb: { id: 83867, title: 'Andor', name: 'Andor', overview: 'In an oppressive time, desperate and calculating, Cassian Andor will risk everything. The series explores tales filled with moral ambiguity in a dangerous galaxy.', posterPath: '/59SVNwLnn4rjnrBEL9hjM6MBWPQ.jpg', backdropPath: '/7GBxFUwcjG4YOvKfJMSNmEoT93z.jpg', firstAirDate: '2022-09-21', voteAverage: 8.5, genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 10759, name: 'Action & Adventure' }] } },
  { id: 23, name: 'The Wire',                  type: 'SERIES', tmdb_id: 1438,
    seriesTmdb: { id: 1438, title: 'The Wire', name: 'The Wire', overview: 'Set in Baltimore, the show follows the lives of both drug dealers and law enforcement officers. It is told through several perspectives including the narcotics unit, the docks, the school system and the political office.', posterPath: '/4lbclFySvugI51fwsyxBTOm4DqK.jpg', backdropPath: '/n1WOKFzGXJHCijdq0H9sMZAOi1N.jpg', firstAirDate: '2002-06-02', voteAverage: 9.3, genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drama' } ] } },
];

// Stream files that exist for some records (so "Available on Device" tab works)
const MOCK_STREAM_FILES = [
  { fileId: 101, recordId: 2,  fileName: 'Dune.Part.Two.2024.4K.DV.HDR10.HEVC.TrueHD.Atmos.7.1.mkv',    filePath: '/media/movies/Dune.Part.Two.2024.4K.DV.HDR10.HEVC.TrueHD.Atmos.7.1.mkv' },
  { fileId: 102, recordId: 2,  fileName: 'Dune.Part.Two.2024.1080p.HDR10.HEVC.Atmos.5.1.mkv',            filePath: '/media/movies/Dune.Part.Two.2024.1080p.HDR10.HEVC.Atmos.5.1.mkv' },
  { fileId: 103, recordId: 4,  fileName: 'Oppenheimer.2023.4K.HDR10Plus.HEVC.DTS-HD.MA.7.1.mkv',         filePath: '/media/movies/Oppenheimer.2023.4K.HDR10Plus.HEVC.DTS-HD.MA.7.1.mkv' },
  { fileId: 104, recordId: 4,  fileName: 'Oppenheimer.2023.1080p.BluRay.H264.AAC.2.0.mkv',               filePath: '/media/movies/Oppenheimer.2023.1080p.BluRay.H264.AAC.2.0.mkv' },
  { fileId: 105, recordId: 6,  fileName: 'The.Dark.Knight.2008.4K.HDR10.HEVC.Atmos.7.1.mkv',             filePath: '/media/movies/The.Dark.Knight.2008.4K.HDR10.HEVC.Atmos.7.1.mkv' },
  { fileId: 106, recordId: 1,  fileName: 'Breaking.Bad.S01E01.1080p.HDR.HEVC.Atmos.5.1.mkv',             filePath: '/media/series/BreakingBad/S01/Breaking.Bad.S01E01.1080p.HDR.HEVC.Atmos.5.1.mkv' },
  { fileId: 107, recordId: 1,  fileName: 'Breaking.Bad.S01E02.1080p.HDR.HEVC.Atmos.5.1.mkv',             filePath: '/media/series/BreakingBad/S01/Breaking.Bad.S01E02.1080p.HDR.HEVC.Atmos.5.1.mkv' },
  { fileId: 108, recordId: 1,  fileName: 'Breaking.Bad.S02E01.4K.DV.HDR10.HEVC.Atmos.7.1.mkv',           filePath: '/media/series/BreakingBad/S02/Breaking.Bad.S02E01.4K.DV.HDR10.HEVC.Atmos.7.1.mkv' },
  { fileId: 109, recordId: 3,  fileName: 'The.Bear.S01E01.1080p.HEVC.Atmos.5.1.mkv',                     filePath: '/media/series/TheBear/S01/The.Bear.S01E01.1080p.HEVC.Atmos.5.1.mkv' },
  { fileId: 110, recordId: 3,  fileName: 'The.Bear.S02E01.4K.HDR10.HEVC.Atmos.7.1.mkv',                  filePath: '/media/series/TheBear/S02/The.Bear.S02E01.4K.HDR10.HEVC.Atmos.7.1.mkv' },
  { fileId: 111, recordId: 11, fileName: 'The.Last.of.Us.S01E01.4K.DV.HDR10.HEVC.Atmos.7.1.mkv',         filePath: '/media/series/TheLastOfUs/S01/The.Last.of.Us.S01E01.4K.DV.HDR10.HEVC.Atmos.7.1.mkv' },
  { fileId: 112, recordId: 5,  fileName: 'Shogun.2024.S01E01.1080p.HDR.HEVC.Atmos.5.1.mkv',              filePath: '/media/series/Shogun/S01/Shogun.2024.S01E01.1080p.HDR.HEVC.Atmos.5.1.mkv' },
];

// ── Mock middleware for /api/cinema/catalog/search ─────────────────────────────
function catalogSearchMockPlugin() {
  return {
    name: 'catalog-search-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/api/cinema/catalog/searches') return next();

        const q    = (url.searchParams.get('q') ?? '').toLowerCase().trim();
        const page = parseInt(url.searchParams.get('page') ?? '0', 10);
        const size = parseInt(url.searchParams.get('size') ?? '12', 10);

        const filtered = q === ''
          ? MOCK_RECORDS
          : MOCK_RECORDS.filter(r => r.name.toLowerCase().includes(q));

        const total   = filtered.length;
        const start   = page * size;
        const content = filtered.slice(start, start + size);
        const isLast  = start + content.length >= total;

        const pageResponse = {
          content,
          pageable: { pageNumber: page, pageSize: size, sort: { empty: true, sorted: false, unsorted: true } },
          totalElements: total,
          totalPages: Math.ceil(total / size),
          last: isLast,
          first: page === 0,
          size,
          number: page,
          numberOfElements: content.length,
          empty: content.length === 0,
        };

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ httpStatusCode: 200, success: true, data: pageResponse }));
      });
    },
  };
}

// ── Mock middleware for /api/stream/search ─────────────────────────────────────
function streamSearchMockPlugin() {
  return {
    name: 'stream-search-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/api/stream/search') return next();

        const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();

        const filtered = q === ''
          ? MOCK_STREAM_FILES
          : MOCK_STREAM_FILES.filter(f => f.fileName.toLowerCase().includes(q));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ httpStatusCode: 200, success: true, data: filtered }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), mediaInfoMockPlugin(), catalogSearchMockPlugin(), streamSearchMockPlugin()],

    // Shim process.env for any legacy code or third-party libs that reference it
    define: {
      'process.env': {},
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },

    // Treat .js files containing JSX as JSX (esbuild loader)
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.[jt]sx?$/,
      exclude: [],
    },

    resolve: {
      alias: {
        '@app':      path.resolve(__dirname, './src/app'),
        '@features': path.resolve(__dirname, './src/features'),
        '@shared':   path.resolve(__dirname, './src/shared'),
        '@assets':   path.resolve(__dirname, './src/assets'),
        '@platform': path.resolve(__dirname, './src/platform'),
        '@styles':   path.resolve(__dirname, './src/styles'),
      },
    },

    server: {
      host: true,   // bind 0.0.0.0 → reachable from other devices on the same network
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'build',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor:  ['react', 'react-dom', 'react-router-dom'],
            mui:     ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            charts:  ['recharts', 'chart.js', 'react-chartjs-2'],
            grid:    ['ag-grid-react', '@mui/x-data-grid'],
            player:  ['react-player'],
          },
        },
      },
    },

    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
      include: ['react', 'react-dom', 'react-router-dom', '@mui/material'],
    },
  }
})
