package com.db.dbworld.app.cinema.rail.service.impl;//package com.db.dbworld.cinema.rail.service.impl;
//
//import com.db.dbworld.cinema.catalog.entities.RecordEntity;
//import com.db.dbworld.cinema.catalog.mapper.RecordMapper;
//import com.db.dbworld.cinema.catalog.repository.RecordRepository;
//import com.db.dbworld.cinema.rail.dto.*;
//import com.db.dbworld.cinema.rail.entity.*;
//import com.db.dbworld.cinema.rail.mapper.RailMapper;
//import com.db.dbworld.cinema.rail.projection.RailRecordProjection;
//import com.db.dbworld.cinema.rail.repository.*;
//import com.db.dbworld.cinema.rail.service.*;
//import com.db.dbworld.cinema.tmdb.enums.VideoSite;
//import com.db.dbworld.cinema.tmdb.enums.VideoType;
//import com.db.dbworld.cinema.tmdb.genre.dto.TmdbGenreProjection;
//import com.db.dbworld.cinema.tmdb.genre.repository.GenreRepository;
//import com.db.dbworld.cinema.tmdb.media.projection.*;
//import com.db.dbworld.cinema.tmdb.media.repository.*;
//import com.db.dbworld.cinema.tmdb.providers.dto.ProviderProjection;
//import com.db.dbworld.cinema.tmdb.providers.dto.TmdbProviderDto;
//import com.db.dbworld.cinema.tmdb.providers.mapper.TmdbProviderMapper;
//import com.db.dbworld.cinema.tmdb.providers.repository.TmdbProviderRepository;
//
//import jakarta.persistence.EntityNotFoundException;
//import lombok.RequiredArgsConstructor;
//import lombok.extern.slf4j.Slf4j;
//
//import org.springframework.data.domain.*;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//
//import java.util.*;
//import java.util.concurrent.*;
//import java.util.function.Predicate;
//import java.util.stream.Collectors;
//
//@Service
//@RequiredArgsConstructor
//@Transactional
//@Slf4j
//public class RailServiceImpl implements RailService {
//
//    private final RailRepository railRepository;
//    private final RailItemRepository railItemRepository;
//    private final RecordRepository recordRepository;
//
//    private final PosterImageRepository posterImageRepository;
//    private final BackdropImageRepository backdropImageRepository;
//    private final VideoRepository videoRepository;
//    private final TmdbProviderRepository tmdbProviderRepository;
//    private final GenreRepository genreRepository;
//
//    private final RailResolver railResolver;
//
//    private final RailMapper railMapper;
//    private final RecordMapper recordMapper;
//    private final TmdbProviderMapper providerMapper;
//
//    private static final String REGION_CODE_IN = "IN";
//    private static final int MAX_PAGE_SIZE = 50;
//    private static final int MAX_GENRES = 3;
//    private static final int HIGH_RESOLUTION_THRESHOLD = 1080;
//
//    private static final String YOUTUBE_EMBED = "https://www.youtube.com/embed/%s?autoplay=1&mute=1";
//
//    private static final Set<String> PREFERRED_LANGUAGES = Set.of("hi", "en");
//
//    // Cache for empty collections to reduce object allocation
//    private static final List<String> EMPTY_GENRE_LIST = Collections.emptyList();
//    private static final List<TmdbProviderDto> EMPTY_PROVIDER_LIST = Collections.emptyList();
//    private static final List<PosterImageProjection> EMPTY_POSTER_LIST = Collections.emptyList();
//    private static final List<BackdropImageProjection> EMPTY_BACKDROP_LIST = Collections.emptyList();
//    private static final List<VideoProjection> EMPTY_VIDEO_LIST = Collections.emptyList();
//
//    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
//
//    private static ThreadLocalRandom random() {
//        return ThreadLocalRandom.current();
//    }
//
//    /* ---------------------------------------------------
//       Language & Resolution Predicates
//    ---------------------------------------------------- */
//
//    private static final Predicate<PosterImageProjection> POSTER_HIGH =
//            p -> p.getHeight() != null && p.getHeight() >= HIGH_RESOLUTION_THRESHOLD;
//
//    private static final Predicate<BackdropImageProjection> BACKDROP_HIGH =
//            b -> b.getHeight() != null && b.getHeight() >= HIGH_RESOLUTION_THRESHOLD;
//
//    private static final Predicate<PosterImageProjection> POSTER_LANG =
//            p -> {
//                String lang = p.getIso6391();
//                return lang != null && PREFERRED_LANGUAGES.contains(lang.toLowerCase());
//            };
//
//    private static final Predicate<BackdropImageProjection> BACKDROP_LANG =
//            b -> {
//                String lang = b.getIso6391();
//                return lang != null && PREFERRED_LANGUAGES.contains(lang.toLowerCase());
//            };
//
//    private static final Predicate<PosterImageProjection> POSTER_NO_TEXT =
//            p -> p.getIso6391() == null;
//
//    private static final Predicate<BackdropImageProjection> BACKDROP_NO_TEXT =
//            b -> b.getIso6391() == null;
//
//    private static final Map<VideoType, Integer> VIDEO_PRIORITY = Map.of(
//            VideoType.TRAILER, 3,  // Highest priority
//            VideoType.TEASER, 2,
//            VideoType.CLIP, 1,
//            VideoType.FEATURETTE, 0,
//            VideoType.BEHIND_THE_SCENES, 0
//    );
//
//    /* ---------------------------------------------------
//       Rails Metadata
//    ---------------------------------------------------- */
//
//    @Override
//    @Transactional(readOnly = true)
//    public List<RailDto> getRails() {
//        return railRepository.findActiveRails()
//                .stream()
//                .map(railMapper::toDto)
//                .toList();
//    }
//
//    /* ---------------------------------------------------
//       Rail Feed
//    ---------------------------------------------------- */
//
//    @Override
//    @Transactional(readOnly = true)
//    public RailPageDto getRailRecords(Long railId, int page, Integer size) {
//
//        RailEntity rail = railRepository.findById(railId)
//                .orElseThrow(() -> new EntityNotFoundException("Rail not found " + railId));
//
//        int pageSize = size != null
//                ? Math.min(size, MAX_PAGE_SIZE)
//                : rail.getLimitSize();
//
//        Pageable pageable = PageRequest.of(page, pageSize);
//
//        Slice<Long> slice = railResolver.resolveIds(rail, pageable);
//
//        List<Long> recordIds = slice.getContent();
//
//        if (recordIds.isEmpty()) {
//            return RailPageDto.builder()
//                    .railId(railId)
//                    .page(page)
//                    .size(pageSize)
//                    .hasNext(slice.hasNext())
//                    .records(List.of())
//                    .build();
//        }
//
//        List<RailRecordProjection> records =
//                recordRepository.findRailRecordProjection(recordIds);
//
//        List<Long> tmdbIds = extractTmdbIds(records);
//
//        if (tmdbIds.isEmpty()) {
//            return buildMinimalRailPage(railId, page, pageSize, slice.hasNext(), records);
//        }
//
//        // Use CompletableFuture.allOf for better coordination
//        CompletableFuture<Map<Long, List<String>>> genreFuture =
//                CompletableFuture.supplyAsync(() -> fetchGenres(tmdbIds), executor);
//
//        CompletableFuture<Map<Long, List<PosterImageProjection>>> posterFuture =
//                CompletableFuture.supplyAsync(() -> fetchPosters(tmdbIds), executor);
//
//        CompletableFuture<Map<Long, List<BackdropImageProjection>>> backdropFuture =
//                CompletableFuture.supplyAsync(() -> fetchBackdrops(tmdbIds), executor);
//
//        CompletableFuture<Map<Long, List<VideoProjection>>> videoFuture =
//                CompletableFuture.supplyAsync(() -> fetchVideos(tmdbIds), executor);
//
//        CompletableFuture<Map<Long, List<TmdbProviderDto>>> providerFuture =
//                CompletableFuture.supplyAsync(() -> fetchProviders(tmdbIds), executor);
//
//        // Wait for all futures to complete
//        CompletableFuture.allOf(genreFuture, posterFuture, backdropFuture, videoFuture, providerFuture)
//                .join();
//
//        // Get results
//        Map<Long, List<String>> genreMap = genreFuture.getNow(Collections.emptyMap());
//        Map<Long, List<PosterImageProjection>> posterMap = posterFuture.getNow(Collections.emptyMap());
//        Map<Long, List<BackdropImageProjection>> backdropMap = backdropFuture.getNow(Collections.emptyMap());
//        Map<Long, List<VideoProjection>> videoMap = videoFuture.getNow(Collections.emptyMap());
//        Map<Long, List<TmdbProviderDto>> providerMap = providerFuture.getNow(Collections.emptyMap());
//
//        List<RailRecordDto> result = records.parallelStream() // Use parallel stream for large lists
//                .map(r -> buildRecord(r, genreMap, posterMap, backdropMap, videoMap, providerMap))
//                .toList();
//
//        return RailPageDto.builder()
//                .railId(railId)
//                .page(page)
//                .size(pageSize)
//                .hasNext(slice.hasNext())
//                .records(result)
//                .build();
//    }
//
//    private List<Long> extractTmdbIds(List<RailRecordProjection> records) {
//        // Use HashSet for O(1) lookup and avoid duplicates
//        Set<Long> tmdbIdSet = new HashSet<>();
//        for (RailRecordProjection record : records) {
//            Long tmdbId = record.getTmdbId();
//            if (tmdbId != null) {
//                tmdbIdSet.add(tmdbId);
//            }
//        }
//        return new ArrayList<>(tmdbIdSet);
//    }
//
//    private RailPageDto buildMinimalRailPage(Long railId, int page, int pageSize,
//                                             boolean hasNext, List<RailRecordProjection> records) {
//        List<RailRecordDto> minimalRecords = new ArrayList<>(records.size());
//        for (RailRecordProjection record : records) {
//            minimalRecords.add(minimal(record));
//        }
//
//        return RailPageDto.builder()
//                .railId(railId)
//                .page(page)
//                .size(pageSize)
//                .hasNext(hasNext)
//                .records(minimalRecords)
//                .build();
//    }
//
//    /* ---------------------------------------------------
//       Fetch Helpers - Optimized with primitive collections
//    ---------------------------------------------------- */
//
//    private Map<Long, List<String>> fetchGenres(List<Long> tmdbIds) {
//        if (tmdbIds.isEmpty()) return Collections.emptyMap();
//
//        List<TmdbGenreProjection> genreProjections = genreRepository.findGenresByTmdbIds(tmdbIds);
//
//        // Pre-size the map for better performance
//        Map<Long, List<String>> genreMap = new HashMap<>(tmdbIds.size());
//
//        for (TmdbGenreProjection g : genreProjections) {
//            if (g.getTmdbId() != null && g.getGenre() != null) {
//                genreMap.computeIfAbsent(g.getTmdbId(), k -> new ArrayList<>())
//                        .add(g.getGenre().getName());
//            }
//        }
//
//        return genreMap;
//    }
//
//    private Map<Long, List<PosterImageProjection>> fetchPosters(List<Long> tmdbIds) {
//        if (tmdbIds.isEmpty()) return Collections.emptyMap();
//
//        List<PosterImageProjection> posters = posterImageRepository.findPostersByTmdbIds(tmdbIds);
//
//        // Sort in place to avoid creating new lists
//        posters.sort((a, b) -> {
//            Integer h1 = a.getHeight();
//            Integer h2 = b.getHeight();
//            if (h1 == null && h2 == null) return 0;
//            if (h1 == null) return 1;
//            if (h2 == null) return -1;
//            return h2.compareTo(h1); // Descending
//        });
//
//        Map<Long, List<PosterImageProjection>> posterMap = new HashMap<>(tmdbIds.size());
//
//        for (PosterImageProjection p : posters) {
//            Long tmdbId = p.getTmdbId();
//            if (tmdbId != null) {
//                posterMap.computeIfAbsent(tmdbId, k -> new ArrayList<>()).add(p);
//            }
//        }
//
//        return posterMap;
//    }
//
//    private Map<Long, List<BackdropImageProjection>> fetchBackdrops(List<Long> tmdbIds) {
//        if (tmdbIds.isEmpty()) return Collections.emptyMap();
//
//        List<BackdropImageProjection> backdrops = backdropImageRepository.findBackdropsByTmdbIds(tmdbIds);
//
//        // Sort in place
//        backdrops.sort((a, b) -> {
//            Integer h1 = a.getHeight();
//            Integer h2 = b.getHeight();
//            if (h1 == null && h2 == null) return 0;
//            if (h1 == null) return 1;
//            if (h2 == null) return -1;
//            return h2.compareTo(h1); // Descending
//        });
//
//        Map<Long, List<BackdropImageProjection>> backdropMap = new HashMap<>(tmdbIds.size());
//
//        for (BackdropImageProjection b : backdrops) {
//            Long tmdbId = b.getTmdbId();
//            if (tmdbId != null) {
//                backdropMap.computeIfAbsent(tmdbId, k -> new ArrayList<>()).add(b);
//            }
//        }
//
//        return backdropMap;
//    }
//
//    private Map<Long, List<VideoProjection>> fetchVideos(List<Long> tmdbIds) {
//        if (tmdbIds.isEmpty()) return Collections.emptyMap();
//
//        List<VideoProjection> videos = videoRepository.findVideos(tmdbIds, VideoSite.YOUTUBE);
//
//        Map<Long, List<VideoProjection>> videoMap = new HashMap<>(tmdbIds.size());
//
//        for (VideoProjection v : videos) {
//            Long tmdbId = v.getTmdbId();
//            if (tmdbId != null && v.getKey() != null) {
//                videoMap.computeIfAbsent(tmdbId, k -> new ArrayList<>()).add(v);
//            }
//        }
//
//        // Sort videos by priority in place
//        for (List<VideoProjection> videoList : videoMap.values()) {
//            videoList.sort((a, b) -> {
//                int priorityA = VIDEO_PRIORITY.getOrDefault(a.getType(), 0);
//                int priorityB = VIDEO_PRIORITY.getOrDefault(b.getType(), 0);
//                return Integer.compare(priorityB, priorityA); // Higher priority first
//            });
//        }
//
//        return videoMap;
//    }
//
//    private Map<Long, List<TmdbProviderDto>> fetchProviders(List<Long> tmdbIds) {
//        if (tmdbIds.isEmpty()) return Collections.emptyMap();
//
//        List<ProviderProjection> providers = tmdbProviderRepository.findProvidersByTmdbIdIn(tmdbIds, REGION_CODE_IN);
//
//        Map<Long, List<TmdbProviderDto>> providerMap = new HashMap<>(tmdbIds.size());
//
//        for (ProviderProjection p : providers) {
//            Long tmdbId = p.getTmdbId();
//            if (tmdbId != null) {
//                providerMap.computeIfAbsent(tmdbId, k -> new ArrayList<>())
//                        .add(providerMapper.fromProjection(p));
//            }
//        }
//
//        return providerMap;
//    }
//
//    /* ---------------------------------------------------
//       Record Builder - Optimized with direct access
//    ---------------------------------------------------- */
//
//    private RailRecordDto buildRecord(
//            RailRecordProjection r,
//            Map<Long, List<String>> genres,
//            Map<Long, List<PosterImageProjection>> posters,
//            Map<Long, List<BackdropImageProjection>> backdrops,
//            Map<Long, List<VideoProjection>> videos,
//            Map<Long, List<TmdbProviderDto>> providers) {
//
//        Long tmdbId = r.getTmdbId();
//
//        if (tmdbId == null) return minimal(r);
//
//        // Direct map access without getOrDefault to avoid unnecessary List.of() creation
//        List<String> genreList = genres.get(tmdbId);
//        List<PosterImageProjection> posterList = posters.get(tmdbId);
//        List<BackdropImageProjection> backdropList = backdrops.get(tmdbId);
//        List<VideoProjection> videoList = videos.get(tmdbId);
//        List<TmdbProviderDto> providerList = providers.get(tmdbId);
//
//        return RailRecordDto.builder()
//                .id(r.getId())
//                .title(r.getTitle())
//                .type(r.getType())
//                .genres(genreList != null ? limitGenres(genreList) : EMPTY_GENRE_LIST)
//                .posterPath(selectPoster(posterList, r.getPosterPath()))
//                .posterPathClean(selectPosterClean(posterList, r.getPosterPath()))
//                .backdropPath(selectBackdropClean(backdropList, r.getBackdropPath()))
//                .backdropPathText(selectBackdropText(backdropList, r.getBackdropPath()))
//                .voteAverage(r.getVoteAverage())
//                .popularity(r.getPopularity())
//                .releaseDate(r.getReleaseDate())
//                .overview(r.getOverview())
//                .previewVideoUrl(selectVideo(videoList))
//                .providers(providerList != null ? providerList : EMPTY_PROVIDER_LIST)
//                .build();
//    }
//
//    private List<String> limitGenres(List<String> genres) {
//        int size = genres.size();
//        if (size <= MAX_GENRES) {
//            return genres;
//        }
//        return genres.subList(0, MAX_GENRES);
//    }
//
//    /* ---------------------------------------------------
//       Minimal Fallback Record
//    ---------------------------------------------------- */
//
//    private RailRecordDto minimal(RailRecordProjection r) {
//        return RailRecordDto.builder()
//                .id(r.getId())
//                .title(r.getTitle())
//                .type(r.getType())
//                .posterPath(r.getPosterPath())
//                .posterPathClean(r.getPosterPath())
//                .backdropPath(r.getBackdropPath())
//                .backdropPathText(r.getBackdropPath())
//                .voteAverage(r.getVoteAverage())
//                .popularity(r.getPopularity())
//                .releaseDate(r.getReleaseDate())
//                .overview(r.getOverview())
//                .genres(EMPTY_GENRE_LIST)
//                .providers(EMPTY_PROVIDER_LIST)
//                .build();
//    }
//
//    /* ---------------------------------------------------
//       Image Selection (Single Pass with Optimized Logic)
//    ---------------------------------------------------- */
//
//    private String selectPoster(List<PosterImageProjection> posters, String fallback) {
//        if (posters == null || posters.isEmpty()) {
//            return fallback;
//        }
//
//        // Single pass with best match tracking
//        PosterImageProjection bestMatch = null;
//        int bestScore = -1;
//
//        for (PosterImageProjection p : posters) {
//            int score = 0;
//            if (POSTER_HIGH.test(p)) score += 2;
//            if (POSTER_LANG.test(p)) score += 1;
//
//            if (score > bestScore) {
//                bestScore = score;
//                bestMatch = p;
//                if (bestScore == 3) break; // Can't get better than high-res + preferred language
//            }
//        }
//
//        return bestMatch != null ? bestMatch.getFilePath() : fallback;
//    }
//
//    private String selectPosterClean(List<PosterImageProjection> posters, String fallback) {
//        if (posters == null || posters.isEmpty()) {
//            return fallback;
//        }
//
//        PosterImageProjection bestMatch = null;
//        int bestScore = -1;
//
//        for (PosterImageProjection p : posters) {
//            int score = 0;
//            if (POSTER_HIGH.test(p)) score += 2;
//            if (POSTER_NO_TEXT.test(p)) score += 1;
//
//            if (score > bestScore) {
//                bestScore = score;
//                bestMatch = p;
//                if (bestScore == 3) break; // Can't get better than high-res + no text
//            }
//        }
//
//        return bestMatch != null ? bestMatch.getFilePath() : posters.get(0).getFilePath();
//    }
//
//    private String selectBackdropClean(List<BackdropImageProjection> backdrops, String fallback) {
//        if (backdrops == null || backdrops.isEmpty()) {
//            return fallback;
//        }
//
//        BackdropImageProjection bestMatch = null;
//        int bestScore = -1;
//
//        for (BackdropImageProjection b : backdrops) {
//            int score = 0;
//            if (BACKDROP_HIGH.test(b)) score += 2;
//            if (BACKDROP_NO_TEXT.test(b)) score += 1;
//
//            if (score > bestScore) {
//                bestScore = score;
//                bestMatch = b;
//                if (bestScore == 3) break;
//            }
//        }
//
//        return bestMatch != null ? bestMatch.getFilePath() : backdrops.get(0).getFilePath();
//    }
//
//    private String selectBackdropText(List<BackdropImageProjection> backdrops, String fallback) {
//        if (backdrops == null || backdrops.isEmpty()) {
//            return fallback;
//        }
//
//        BackdropImageProjection bestMatch = null;
//        int bestScore = -1;
//
//        for (BackdropImageProjection b : backdrops) {
//            int score = 0;
//            if (BACKDROP_HIGH.test(b)) score += 2;
//            if (BACKDROP_LANG.test(b)) score += 1;
//
//            if (score > bestScore) {
//                bestScore = score;
//                bestMatch = b;
//                if (bestScore == 3) break;
//            }
//        }
//
//        return bestMatch != null ? bestMatch.getFilePath() : backdrops.get(0).getFilePath();
//    }
//
//    private String selectVideo(List<VideoProjection> videos) {
//        if (videos == null || videos.isEmpty()) {
//            return null;
//        }
//
//        // Videos are already sorted by priority from fetchVideos
//        VideoProjection best = videos.get(0);
//        return String.format(YOUTUBE_EMBED, best.getKey());
//    }
//
//    /* ---------------------------------------------------
//       CRUD - Unchanged but kept for completeness
//    ---------------------------------------------------- */
//
//    @Override
//    @Transactional(readOnly = true)
//    public RailDto getRail(Long railId) {
//        RailEntity rail = railRepository.findById(railId)
//                .orElseThrow(() -> new EntityNotFoundException("Rail not found: " + railId));
//        Pageable pageable = PageRequest.of(0, rail.getLimitSize());
//
//        Slice<RecordEntity> slice = railResolver.resolveSlice(rail, pageable);
//
//        RailDto dto = railMapper.toDto(rail);
//        dto.setRecords(recordMapper.toDtoList(slice.getContent()));
//
//        return dto;
//    }
//
//    @Override
//    public RailDto createRail(RailRequest request) {
//        RailEntity rail = railMapper.toEntity(request);
//        return railMapper.toDto(railRepository.save(rail));
//    }
//
//    @Override
//    public RailDto updateRail(Long railId, RailRequest request) {
//        RailEntity rail = railRepository.findById(railId)
//                .orElseThrow(() -> new EntityNotFoundException("Rail not found"));
//        railMapper.updateEntity(request, rail);
//        return railMapper.toDto(rail);
//    }
//
//    @Override
//    public void deleteRail(Long railId) {
//        if (!railRepository.existsById(railId))
//            throw new EntityNotFoundException("Rail not found");
//        railRepository.deleteById(railId);
//    }
//
//    @Override
//    public void addRecordToRail(Long railId, Long recordId, Integer priority) {
//        if (railItemRepository.existsByRailIdAndRecordId(railId, recordId))
//            throw new IllegalStateException("Record already exists");
//
//        RailEntity rail = railRepository.getReferenceById(railId);
//        RecordEntity record = recordRepository.getReferenceById(recordId);
//
//        railItemRepository.save(
//                RailItemEntity.builder()
//                        .rail(rail)
//                        .record(record)
//                        .priority(priority)
//                        .build()
//        );
//    }
//
//    @Override
//    public void removeRailItem(Long railItemId) {
//        if (!railItemRepository.existsById(railItemId))
//            throw new EntityNotFoundException("Rail item not found");
//        railItemRepository.deleteById(railItemId);
//    }
//}