//package com.db.dbworld.services.cinema.impl;
//
//import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
//import com.db.dbworld.dao.dbcinema.tmdb.GenresRepository;
//import com.db.dbworld.dao.dbcinema.tmdb.TmdbDataRepository;
//import com.db.dbworld.dao.dbcinema.user.UserRecordDataRepository;
//import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
//import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
//import com.db.dbworld.entities.dbcinema.tmdb.*;
//import com.db.dbworld.entities.dbcinema.tmdb.credits.CharacterEntity;
//import com.db.dbworld.entities.dbcinema.tmdb.credits.DepartmentEntity;
//import com.db.dbworld.entities.dbcinema.tmdb.credits.JobEntity;
//import com.db.dbworld.entities.dbcinema.tmdb.credits.PersonEntity;
//import com.db.dbworld.entities.dbcinema.user.UserRecordDataEntity;
//import com.db.dbworld.core.user.entity.UserEntity;
//import com.db.dbworld.core.exception.DbWorldException;
//import com.db.dbworld.core.exception.DuplicateResourceException;
//import com.db.dbworld.core.exception.ResourceNotFoundException;
//import com.db.dbworld.core.exception.TmdbApiException;
//import com.db.dbworld.helpers.CacheLogger;
//import com.db.dbworld.helpers.DbWorldRecords;
//import com.db.dbworld.helpers.TmdbUpdateStatusTracker;
//import com.db.dbworld.payloads.CustomPageImpl;
//import com.db.dbworld.payloads.RecordSearchCriteria;
//import com.db.dbworld.payloads.RequestPayloads;
//import com.db.dbworld.payloads.ResponsePayloads;
//import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
//import com.db.dbworld.payloads.dbcinema.tmdb.GenresDto;
//import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
//import com.db.dbworld.payloads.dbcinema.tmdb.SeriesTmdbDataDto;
//import com.db.dbworld.services.cinema.DBCinemaRecordsService;
//import com.db.dbworld.services.cinema.TmdbService;
//import com.db.dbworld.core.user.service.UserService;
//import com.db.dbworld.utils.DBSpecifications;
//import com.db.dbworld.config.AppConstants;
//import com.db.dbworld.utils.DbWorldUtils;
//import com.db.dbworld.utils.PojoConverter;
//import com.google.gson.Gson;
//import com.google.gson.JsonArray;
//import com.google.gson.JsonElement;
//import com.google.gson.JsonObject;
//import jakarta.persistence.EntityManager;
//import jakarta.persistence.criteria.Predicate;
//import lombok.extern.log4j.Log4j2;
//import org.modelmapper.ModelMapper;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.beans.factory.annotation.Qualifier;
//import org.springframework.cache.Cache;
//import org.springframework.cache.CacheManager;
//import org.springframework.cache.annotation.CacheConfig;
//import org.springframework.cache.annotation.CacheEvict;
//import org.springframework.cache.annotation.Cacheable;
//import org.springframework.core.ParameterizedTypeReference;
//import org.springframework.data.domain.Page;
//import org.springframework.data.domain.PageRequest;
//import org.springframework.data.domain.Pageable;
//import org.springframework.data.domain.Sort;
//import org.springframework.data.jpa.domain.Specification;
//import org.springframework.data.redis.core.RedisTemplate;
//import org.springframework.http.HttpMethod;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.ResponseEntity;
//import org.springframework.scheduling.annotation.Async;
//import org.springframework.scheduling.annotation.EnableAsync;
//import org.springframework.security.authentication.AuthenticationServiceException;
//import org.springframework.security.core.AuthenticationException;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//import org.springframework.web.client.HttpClientErrorException;
//import org.springframework.web.client.HttpServerErrorException;
//import org.springframework.web.client.RestTemplate;
//
//import java.util.*;
//import java.util.stream.Collectors;
//
//import static com.db.dbworld.utils.AppConstants.*;
//
//
//@Service
//@Log4j2
//@EnableAsync
//@Transactional
//@CacheConfig(cacheNames = "DB-Cinema")
//public class DBCinemaRecordsServiceImpl implements DBCinemaRecordsService {
//
//    @Autowired
//    @Qualifier("tmdbRestTemplate")
//    private RestTemplate restTemplate;
//
//    @Autowired
//    private DbWorldUtils dbWorldUtils;
//
//    @Autowired
//    private ModelMapper modelMapper;
//
//    @Autowired
//    private DBCinemaRecordsRepository dbCinemaRecordsRepository;
//
//    @Autowired
//    private TmdbDataRepository tmdbDataRepository;
//
//    @Autowired
//    private UserRecordDataRepository userRecordDataRepository;
//
//    @Autowired
//    private GenresRepository genresRepository;
//
//    @Autowired
//    private EntityManager entityManager;
//
//    @Autowired
//    private PojoConverter pojoConverter;
//
//    @Autowired
//    private MediaFileInfoRepository mediaFileInfoRepository;
//
//    @Autowired
//    private UserService userService;
//
//    @Autowired
//    private TmdbService tmdbService;
//
//    @Autowired
//    private TmdbUpdateStatusTracker tmdbUpdateStatusTracker;
//
//    @Autowired
//    private CacheManager cacheManager;
//
//    @Autowired
//    private RedisTemplate<String, Object> redisTemplate;
//
//    @Autowired
//    private CacheLogger cacheLogger;
//
//
//    @Override
//    @CacheEvict(allEntries = true)
//    public DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record) {
//        if (this.dbCinemaRecordsRepository.findByTmdbId(record.getTmdbId()).isEmpty()) {
//            try {
//                DBCinemaRecordsEntity dbCinemaRecordsEntity = new DBCinemaRecordsEntity();
//                dbCinemaRecordsEntity.setType(record.getType().toLowerCase());
//
//                if (record.getType().equalsIgnoreCase(RECORD_TYE.MOVIE.name())) {
//                    MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(record);
//                    dbCinemaRecordsEntity.setName(movieTmdbDataDto.getTitle());
//                    MovieTmdbDataEntity movieTmdbDataEntity = new MovieTmdbDataEntity();
//                    pojoConverter.movieTmdbDtoToEntity(movieTmdbDataDto, movieTmdbDataEntity);
//                    dbCinemaRecordsEntity.setTmdb(mergeTmdbEntity(movieTmdbDataEntity));
//                } else if (record.getType().equalsIgnoreCase(RECORD_TYE.SERIES.name())) {
//                    SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(record);
//                    dbCinemaRecordsEntity.setName(seriesTmdbDataDto.getTitle());
//                    SeriesTmdbDataEntity seriesTmdbDataEntity = new SeriesTmdbDataEntity();
//                    pojoConverter.seriesTmdbDtoToEntity(seriesTmdbDataDto, seriesTmdbDataEntity);
//                    dbCinemaRecordsEntity.setTmdb(mergeTmdbEntity(seriesTmdbDataEntity));
//                }
//                DBCinemaRecordsEntity newDbCinemaRecordEntity = entityManager.merge(dbCinemaRecordsEntity);
//                evictRecordCaches(newDbCinemaRecordEntity.getId());
//                return pojoConverter.dbCinemaRecordsEntityToDto(newDbCinemaRecordEntity);
//            } catch (Exception ex) {
//                log.error("Error adding record: {}", ex.getMessage(), ex);
//                throw new DbWorldException("Failed to add record", ex);
//            }
//        } else {
//            throw new DuplicateResourceException("DBCinemaRecordsEntity", "tmdbId", Long.toString(record.getTmdbId()));
//        }
//    }
//
//
//    @Override
//    @CacheEvict(key = "'record:' + #recordId")
//    public DBCinemaRecordsDto updateRecord(Long recordId, RequestPayloads.AddRecord record) {
//        try {
//            DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsRepository.findById(recordId)
//                    .orElseThrow(() -> new ResourceNotFoundException("DB Cinema Record", "record id", recordId.toString()));
//
//            if (record.getTmdbId() != dbCinemaRecordsEntity.getTmdb().getId()) {
//                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Tmdb Id is different from existing.");
//            }
//
//            TmdbDataEntity tmdbDataEntity = record.getType().equalsIgnoreCase(RECORD_TYE.MOVIE.name()) ?
//                    updateTmdbForMovie(dbCinemaRecordsEntity.getTmdb()) :
//                    updateTmdbForSeries(dbCinemaRecordsEntity.getTmdb());
//
//            dbCinemaRecordsEntity.setTmdb(tmdbDataEntity);
//            dbCinemaRecordsEntity.setName(tmdbDataEntity.getTitle());
//            dbCinemaRecordsEntity.setShowOnTop(record.isShowOnTop());
//
//            DBCinemaRecordsEntity updatedEntity = entityManager.merge(dbCinemaRecordsEntity);
//            evictRecordCaches(recordId);
//            return pojoConverter.dbCinemaRecordsEntityToDto(updatedEntity);
//        } catch (ResourceNotFoundException ex) {
//            throw ex;
//        } catch (Exception ex) {
//            log.error("Error updating record {}: {}", recordId, ex.getMessage(), ex);
//            throw new DbWorldException("Failed to update record", ex);
//        }
//    }
//
//    @Override
//    @CacheEvict(key = "'record:' + #recordId")
//    public void switchShowOnTopRecord(Long recordId, boolean showOnTop) {
//        try {
//            DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsRepository.findById(recordId)
//                    .orElseThrow(() -> new ResourceNotFoundException("DB Cinema Record", "record id", recordId.toString()));
//
//            TmdbDataEntity tmdbDataEntity = dbCinemaRecordsEntity.getType().equalsIgnoreCase(RECORD_TYE.MOVIE.name()) ?
//                    updateTmdbForMovie(dbCinemaRecordsEntity.getTmdb()) :
//                    updateTmdbForSeries(dbCinemaRecordsEntity.getTmdb());
//
//            dbCinemaRecordsEntity.setShowOnTop(showOnTop);
//            dbCinemaRecordsEntity.setTmdb(tmdbDataEntity);
//            entityManager.merge(dbCinemaRecordsEntity);
//            evictRecordCaches(recordId);
//        } catch (ResourceNotFoundException ex) {
//            throw ex;
//        } catch (Exception ex) {
//            log.error("Error switching show on top for record {}: {}", recordId, ex.getMessage(), ex);
//            throw new DbWorldException("Failed to switch show on top", ex);
//        }
//    }
//
//    @Override
//    @CacheEvict(key = "'record:' + #recordId")
//    public void deleteRecord(Long recordId) {
//        if (this.dbCinemaRecordsRepository.existsById(recordId)) {
//            this.userRecordDataRepository.deleteByDbCinemaRecordId(recordId);
//            this.dbCinemaRecordsRepository.deleteById(recordId);
//            evictRecordCaches(recordId);
//        } else {
//            throw new ResourceNotFoundException("db_cinema_record", "id", recordId.toString());
//        }
//    }
//
//    @Override
//    @Cacheable(value = "DB-Cinema-Short", key = "'all-records'")
//    public List<Map<String, Object>> getRecords() {
//        return dbCinemaRecordsRepository.findRecords();
//    }
//
//    @Override
////    @Cacheable(value = "DB-Cinema-Short", key = "'all-records-with-streams'")
//    public List<Map<String, Object>> getRecordsWithStreamList() {
//        List<Map<String, Object>> dbCinemaRecords = dbCinemaRecordsRepository.findRecords();
//
//        // Collect all IDs
//        List<Long> recordIds = dbCinemaRecords.stream()
//                .map(r -> ((Number) r.get("id")).longValue())  // safe cast
//                .collect(Collectors.toList());
//
//        // Fetch all media files in one query
//        List<MediaFileInfoEntity> allMediaFiles = mediaFileInfoRepository.findAllByDbCinemaRecordIdIn(recordIds);
//
//        // Group by recordId
//        Map<Long, List<MediaFileInfo>> groupedMediaFiles = allMediaFiles.stream()
//                .map(entity -> modelMapper.map(entity, MediaFileInfo.class))
//                .collect(Collectors.groupingBy(MediaFileInfo::getDbCinemaRecordId));
//
//        // Attach files to each record
//        return dbCinemaRecords.stream().map(record -> {
//            Map<String, Object> temp = new HashMap<>(record);
//            Long id = ((Number) temp.get("id")).longValue();
//            temp.put("stream_file_list", groupedMediaFiles.getOrDefault(id, Collections.emptyList()));
//            return temp;
//        }).collect(Collectors.toList());
//    }
//
//    public Map<String, Object> getPaginatedRecords(
//            int page,
//            int size,
//            String search,
//            String type,
//            String sortBy,
//            String sortOrder,
//            boolean streamList) {
//
//        // Validate and set default values
//        if (page < 0) page = 0;
//        if (size <= 0) size = 20;
//        if (size > 100) size = 100;
//
//        // Create pageable with sorting
//        Pageable pageable = createPageable(page, size, sortBy, sortOrder);
//
//        // Create specification for filtering
//        Specification<DBCinemaRecordsEntity> spec = createSpecification(search, type);
//
//        // Fetch paginated records
//        Page<DBCinemaRecordsEntity> recordPage = dbCinemaRecordsRepository.findAll(spec, pageable);
//
//        // Convert entities to response format
//        List<Map<String, Object>> records = recordPage.getContent().stream()
//                .map(this::convertEntityToResponse)
//                .collect(Collectors.toList());
//
//        // Attach media files if requested
//        if (streamList) {
//            records = attachMediaFiles(records);
//        }
//
//        return buildResponse(records, recordPage, streamList);
//    }
//
//    private Pageable createPageable(int page, int size, String sortBy, String sortOrder) {
//        Sort sort = createSort(sortBy, sortOrder);
//        return PageRequest.of(page, size, sort);
//    }
//
//    private Sort createSort(String sortBy, String sortOrder) {
//        Sort.Direction direction = "desc".equalsIgnoreCase(sortOrder) ?
//                Sort.Direction.DESC : Sort.Direction.ASC;
//
//        // Map frontend sort fields to entity fields
//        switch (sortBy) {
//            case "name":
//                return Sort.by(direction, "name");
//            case "id":
//                return Sort.by(direction, "id");
//            case "date":
//                return Sort.by(direction, "creationDate");
//            case "files":
//                // For files count, we'll sort by creation date as fallback
//                // You can implement custom sorting for file count if needed
//                return Sort.by(Sort.Direction.DESC, "creationDate");
//            default:
//                return Sort.by(Sort.Direction.DESC, "creationDate");
//        }
//    }
//
//    private Specification<DBCinemaRecordsEntity> createSpecification(String search, String type) {
//        return (root, query, criteriaBuilder) -> {
//            List<Predicate> predicates = new ArrayList<>();
//
//            // Search filter - by name, ID, or TMDB ID
//            if (search != null && !search.trim().isEmpty()) {
//                String searchPattern = "%" + search.toLowerCase() + "%";
//
//                Predicate namePredicate = criteriaBuilder.like(
//                        criteriaBuilder.lower(root.get("name")), searchPattern);
//
//                Predicate idPredicate = criteriaBuilder.like(
//                        root.get("id").as(String.class), "%" + search + "%");
//
//                // Search in TMDB ID (through the tmdb relationship)
//                Predicate tmdbPredicate = null;
//                if (root.get("tmdb") != null) {
//                    tmdbPredicate = criteriaBuilder.like(
//                            root.get("tmdb").get("id").as(String.class), "%" + search + "%");
//                }
//
//                if (tmdbPredicate != null) {
//                    predicates.add(criteriaBuilder.or(namePredicate, idPredicate, tmdbPredicate));
//                } else {
//                    predicates.add(criteriaBuilder.or(namePredicate, idPredicate));
//                }
//            }
//
//            // Type filter
//            if (type != null && !type.trim().isEmpty() && !"all".equals(type)) {
//                predicates.add(criteriaBuilder.equal(root.get("type"), type));
//            }
//
//            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
//        };
//    }
//
//    private Map<String, Object> convertEntityToResponse(DBCinemaRecordsEntity entity) {
//        Map<String, Object> record = new HashMap<>();
//        record.put("id", entity.getId());
//        record.put("name", entity.getName());
//        record.put("type", entity.getType());
//        record.put("creation_date", entity.getCreationDate());
//        record.put("last_modified_date", entity.getLastModifiedDate());
//        record.put("show_on_top", entity.isShowOnTop());
//
//        // Handle TMDB data
//        if (entity.getTmdb() != null) {
//            record.put("tmdb", entity.getTmdb().getId());
//        } else {
//            record.put("tmdb", null);
//        }
//
//        // Initialize with empty file list - will be populated later if needed
//        record.put("stream_file_list", new ArrayList<>());
//
//        return record;
//    }
//
//    private List<Map<String, Object>> attachMediaFiles(List<Map<String, Object>> records) {
//        // Extract record IDs
//        List<Long> recordIds = records.stream()
//                .map(record -> (Long) record.get("id"))
//                .collect(Collectors.toList());
//
//        if (recordIds.isEmpty()) {
//            return records;
//        }
//
//        // Fetch all media files for these records
//        List<MediaFileInfoEntity> mediaFiles = mediaFileInfoRepository.findAllByDbCinemaRecordIdIn(recordIds);
//
//        // Group files by record ID
//        Map<Long, List<MediaFileInfoEntity>> filesByRecordId = mediaFiles.stream()
//                .collect(Collectors.groupingBy(file -> file.getDbCinemaRecord().getId()));
//
//        // Attach files to each record
//        return records.stream().map(record -> {
//            Long recordId = (Long) record.get("id");
//            List<MediaFileInfoEntity> recordFiles = filesByRecordId.getOrDefault(recordId, new ArrayList<>());
//
//            // Convert MediaFileInfoEntity to simple map for response
//            List<Map<String, Object>> fileList = recordFiles.stream()
//                    .map(this::convertFileToMap)
//                    .collect(Collectors.toList());
//
//            record.put("stream_file_list", fileList);
//            return record;
//        }).collect(Collectors.toList());
//    }
//
//    private Map<String, Object> convertFileToMap(MediaFileInfoEntity file) {
//        Map<String, Object> fileMap = new HashMap<>();
//        fileMap.put("id", file.getId());
//        fileMap.put("fileName", file.getFileName());
//        fileMap.put("fileSize", file.getFileSize());
//        fileMap.put("filePath", file.getFilePath());
//
//        // Convert track infos if available
//        if (file.getTrackInfos() != null) {
//            List<Map<String, Object>> trackInfos = file.getTrackInfos().stream()
//                    .map(track -> {
//                        Map<String, Object> trackMap = new HashMap<>();
//                        trackMap.put("type", track.getClass().getSimpleName().replace("InfoEntity", ""));
//                        // Add other track properties as needed
//                        return trackMap;
//                    })
//                    .collect(Collectors.toList());
//            fileMap.put("trackInfos", trackInfos);
//        }
//
//        return fileMap;
//    }
//
//    private Map<String, Object> buildResponse(List<Map<String, Object>> records,
//                                              Page<DBCinemaRecordsEntity> recordPage,
//                                              boolean hasFiles) {
//        Map<String, Object> response = new HashMap<>();
//        response.put("records", records);
//        response.put("currentPage", recordPage.getNumber());
//        response.put("pageSize", recordPage.getSize());
//        response.put("totalPages", recordPage.getTotalPages());
//        response.put("totalRecords", recordPage.getTotalElements());
//        response.put("hasNext", recordPage.hasNext());
//        response.put("hasPrev", recordPage.hasPrevious());
//        response.put("hasFiles", hasFiles);
//
//        return response;
//    }
//
//
//    @Override
////    @Cacheable(value = "DB-Cinema-Short", key = "'cover-records'")
//    public List<DBCinemaRecordsDto> fetchCoverRecords(String[] recordTypes, int pageNumber, int pageSize) {
//        List<MediaFileInfoEntity> mediaFileInfoEntities = mediaFileInfoRepository.getRandom(recordTypes, PageRequest.of(pageNumber, pageSize));
//        return mediaFileInfoEntities.stream().map(
//                mediaFileInfoEntity -> pojoConverter.dbCinemaRecordsEntityToDto(mediaFileInfoEntity.getDbCinemaRecord())
//        ).collect(Collectors.toList());
//    }
//
//    /**
//     * Retrieves records based on dynamic filters. If a filter parameter (languages or genres) is null or empty,
//     * that condition is omitted.
//     *
//     * @param recordSearchCriteria recordSearchCriteria
//     */
//    @Override
//    @Cacheable(key = "'search:' + #recordSearchCriteria.hashCode()")
//    public CustomPageImpl<DBCinemaRecordsDto> findRecords(RecordSearchCriteria recordSearchCriteria) {
//        String cacheKey = "search:" + recordSearchCriteria.hashCode();
//        return cacheLogger.logCacheAccess("DB-Cinema", cacheKey, () -> {
//            Pageable pageable = PageRequest.of(recordSearchCriteria.getPageNumber(), recordSearchCriteria.getPageSize());
//            Page<DBCinemaRecordsDto> page = dbCinemaRecordsRepository
//                    .findAll(DBSpecifications.findRecord(recordSearchCriteria), pageable)
//                    .map(dbCinemaRecordsEntity -> pojoConverter.dbCinemaRecordsEntityToDto(dbCinemaRecordsEntity));
//
//            return new CustomPageImpl<>(
//                    page.getNumber(), page.getSize(), page.getTotalElements(),
//                    page.isEmpty(), page.isFirst(), page.isLast(),
//                    page.getContent()
//            );
//        });
//    }
//
//    @Override
//    public DBCinemaRecordsDto addUsersDbCinemaData(DBCinemaRecordsDto dbCinemaRecordsDto) {
//        Long userId = this.userService.getUserIdFromToken();
//        UserRecordDataEntity userRecordDataEntity = userRecordDataRepository.findByUserUserIdAndDbCinemaRecordId(userId, dbCinemaRecordsDto.getRecordId()).orElse(null);
//        dbCinemaRecordsDto.setWatchListed(userRecordDataEntity != null && userRecordDataEntity.isWatchListed());
//        dbCinemaRecordsDto.setLiked(userRecordDataEntity != null && userRecordDataEntity.isLiked());
//        dbCinemaRecordsDto.setWatched(userRecordDataEntity != null && userRecordDataEntity.isWatched());
//        return dbCinemaRecordsDto;
//    }
//
//    @Override
//    @Cacheable(key = "'record:' + #recordId", unless = "#result == null")
//    public DBCinemaRecordsDto getRecordById(Long recordId) {
//        return cacheLogger.logCacheAccess("DB-Cinema", "record:" + recordId, () -> {
//            DBCinemaRecordsEntity dbCinemaRecordsEntity = getRecordEntityById(recordId);
//            return pojoConverter.dbCinemaRecordsEntityToDto(addUsersDbCinemaData(dbCinemaRecordsEntity));
//        });
//    }
//
//    @Override
////    @Cacheable(key = "'record-entity:' + #recordId", unless = "#result == null")
//    public DBCinemaRecordsEntity getRecordEntityById(Long recordId) {
//        return dbCinemaRecordsRepository.findById(recordId).orElseThrow(
//                () -> new ResourceNotFoundException("DB Cinema Record", "record id", recordId.toString())
//        );
//    }
//
//    @Override
//    public Optional<DBCinemaRecordsEntity> getRecordEntityOptById(Long recordId) {
//        try {
//            return dbCinemaRecordsRepository.findById(recordId);
//        } catch (Exception ex) {
//            log.warn("Failed to lookup recordId={}", recordId, ex);
//            return Optional.empty();
//        }
//    }
//
//    @Override
//    @Cacheable(key = "'search-keyword:' + #keyword.hashCode() + ':' + #pageable.hashCode()")
//    public List<DBCinemaRecordsDto> searchRecordByKeywordWithPagination(String keyword, Pageable pageable) {
//        try {
//            List<DBCinemaRecordsEntity> dbCinemaRecordsEntityList = dbCinemaRecordsRepository.findRecords("%" + keyword + "%", pageable);
//            return dbCinemaRecordsEntityList.stream().map(
//                    dbCinemaRecordsEntity -> this.pojoConverter.dbCinemaRecordsEntityToDto(addUsersDbCinemaData(dbCinemaRecordsEntity))
//            ).toList();
//        } catch (Exception ex) {
//            log.error("Error searching records by keyword {}: {}", keyword, ex.getMessage(), ex);
//            throw new DbWorldException("Failed to search records", ex);
//        }
//    }
//
//    @Override
//    @Cacheable(key = "'count-keyword:' + #keyword.hashCode()")
//    public Integer countRecordsByKeyword(String keyword) {
//        try {
//            return dbCinemaRecordsRepository.countRecordsByKeyword("%" + keyword + "%").orElse(0L).intValue();
//        } catch (Exception ex) {
//            log.error("Error counting records by keyword {}: {}", keyword, ex.getMessage(), ex);
//            throw new DbWorldException("Failed to count records", ex);
//        }
//    }
//
//    @Override
//    @Cacheable(key = "'search-simple:' + #keyword.hashCode()")
//    public List<DbWorldRecords.CinemaRecordDto> searchRecordByKeyword(String keyword) {
//        try {
//            return dbCinemaRecordsRepository.findRecords("%" + keyword + "%")
//                    .stream()
//                    .map(map -> new DbWorldRecords.CinemaRecordDto(
//                            (Long) map.get("recordId"),
//                            (String) map.get("name"),
//                            (String) map.get("type"),
//                            (Long) map.get("tmdb")
//                    ))
//                    .collect(Collectors.toList());
//        } catch (Exception ex) {
//            log.error("Error in simple search by keyword {}: {}", keyword, ex.getMessage(), ex);
//            throw new DbWorldException("Failed to perform simple search", ex);
//        }
//    }
//
//    @Override
//    @CacheEvict(cacheNames = "DB-Cinema", key = "'record:' + #recordId")
//    public DBCinemaRecordsDto userRecordDataProcess(Long recordId, String process) {
//        try {
//            UserEntity userEntity = userService.getUserFromToken();
//            Long userId = userEntity.getUserId();
//
//            // Process user action
//            if (process.equalsIgnoreCase(AppConstants.PROCESS_UN_LIKE)) {
//                this.userRecordDataRepository.setIsLikeAsFalseByUserIdRecordId(userId, recordId);
//            } else if (process.equalsIgnoreCase(AppConstants.PROCESS_UN_WATCH)) {
//                this.userRecordDataRepository.setIsWatchAsFalseByUserIdRecordId(userId, recordId);
//            } else if (process.equalsIgnoreCase(AppConstants.PROCESS_UN_WATCHLIST)) {
//                this.userRecordDataRepository.setIsWatchListedAsFalseByUserIdRecordId(userId, recordId);
//            } else if (process.equalsIgnoreCase(AppConstants.PROCESS_LIKE) ||
//                    process.equalsIgnoreCase(AppConstants.PROCESS_WATCH) ||
//                    process.equalsIgnoreCase(AppConstants.PROCESS_WATCHLIST)) {
//
//                UserRecordDataEntity userRecordDataEntity = this.userRecordDataRepository
//                        .findByUserUserIdAndDbCinemaRecordId(userId, recordId)
//                        .orElseGet(() -> {
//                            UserRecordDataEntity newEntity = new UserRecordDataEntity();
//                            newEntity.setDbCinemaRecord(getRecordEntityById(recordId));
//                            newEntity.setUser(userEntity);
//                            return newEntity;
//                        });
//
//                switch (process) {
//                    case AppConstants.PROCESS_LIKE:
//                        userRecordDataEntity.setLiked(true);
//                        break;
//                    case AppConstants.PROCESS_WATCH:
//                        userRecordDataEntity.setWatched(true);
//                        break;
//                    case AppConstants.PROCESS_WATCHLIST:
//                        userRecordDataEntity.setWatchListed(true);
//                        break;
//                }
//                this.userRecordDataRepository.save(userRecordDataEntity);
//            }
//            return getRecordById(recordId);
//        } catch (AuthenticationException ex) {
//            throw new AuthenticationServiceException("Token is not valid. Please login again.");
//        } catch (Exception ex) {
//            log.error("Error processing user action {} on record {}: {}", process, recordId, ex.getMessage(), ex);
//            throw new DbWorldException("Failed to process user action", ex);
//        }finally {
//            evictAllWatchlistCacheForUser(userService.getUserIdFromToken());
//        }
//    }
//
//    @Override
////    @Cacheable(key = "'watchlist:' + #userId + ':' + #pageNumber + ':' + #pageSize")
//    public CustomPageImpl<DBCinemaRecordsDto> getWatchListCinemaRecords(int pageNumber, int pageSize) {
//        Long userId = this.userService.getUserIdFromToken();
//        String cacheKey = "watchlist:" + userId + ":" + pageNumber + ":" + pageSize;
//
//        return cacheLogger.logCacheAccess("DB-Cinema", cacheKey, () -> {
//            try {
//                Page<DBCinemaRecordsDto> page = userRecordDataRepository
//                        .findAll(DBSpecifications.findUserWatchListedRecords(userId),
//                                PageRequest.of(pageNumber, pageSize))
//                        .map(UserRecordDataEntity::getDbCinemaRecord)
//                        .map(dbCinemaRecordsEntity -> pojoConverter.dbCinemaRecordsEntityToDto(dbCinemaRecordsEntity));
//
//                return new CustomPageImpl<>(
//                        page.getNumber(), page.getSize(), page.getTotalElements(),
//                        page.isEmpty(), page.isFirst(), page.isLast(),
//                        page.getContent()
//                );
//            } catch (Exception ex) {
//                log.error("Error fetching watchlist: {}", ex.getMessage(), ex);
//                throw new DbWorldException("Failed to fetch watchlist", ex);
//            }
//        });
//    }
//
//    @Async
//    @Override
//    public void updateTmdbWithLatest(Integer limit, boolean all) {
//        try {
//            if (all) {
//                processAllRecordsInBatches();
//            } else {
//                processLimitedRecords(limit != null ? limit : 50);
//            }
//        } catch (Exception ex) {
//            if (!tmdbUpdateStatusTracker.isCancelled()) {
//                log.error("Update process failed: {}", ex.getMessage());
//                throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "TMDB update process failed",
//                        tmdbUpdateStatusTracker.getCurrentStatus(), ex);
//            }
//        } finally {
//            tmdbUpdateStatusTracker.completeProcess();
//        }
//    }
//
//    @Override
//    public void cancelUpdateTmdbWithLatest() {
//        tmdbUpdateStatusTracker.cancelProcess();
//    }
//
//    private void processAllRecordsInBatches() {
//        int batchSize = 500;
//        int totalCount = (int) tmdbDataRepository.count();
//        tmdbUpdateStatusTracker.startProcess(totalCount);
//
//        int page = 0;
//        boolean hasMore = true;
//
//        while (hasMore && !tmdbUpdateStatusTracker.isCancelled()) {
//            Pageable pageable = PageRequest.of(page, batchSize);
//            Page<TmdbDataEntity> entityPage = tmdbDataRepository.findAll(pageable);
//            List<TmdbDataEntity> entities = entityPage.getContent();
//
//            if (processEntitiesBatch(entities)) {
//                // If batch processing was interrupted by cancellation
//                break;
//            }
//
//            hasMore = entityPage.hasNext();
//            page++;
//
//            try {
//                Thread.sleep(500);
//            } catch (InterruptedException e) {
//                Thread.currentThread().interrupt();
//                break;
//            }
//        }
//
//        if (tmdbUpdateStatusTracker.isCancelled()) {
//            log.info("Update process was cancelled by user");
//        }
//    }
//
//    private void processLimitedRecords(int limit) {
//        List<TmdbDataEntity> entities = tmdbDataRepository.findRecentRecords(limit);
//        tmdbUpdateStatusTracker.startProcess(entities.size());
//        processEntitiesBatch(entities);
//    }
//
//    private boolean processEntitiesBatch(List<TmdbDataEntity> entities) {
//        for (TmdbDataEntity entity : entities) {
//            if (tmdbUpdateStatusTracker.isCancelled()) {
//                return true; // Indicate processing was interrupted
//            }
//
//            try {
//                processEntity(entity);
//                tmdbUpdateStatusTracker.recordSuccess();
//                Thread.sleep(200);
//            } catch (Exception ex) {
//                tmdbUpdateStatusTracker.recordFailure(entity.getId(), ex.getMessage());
//                log.error("Failed ID: {} Error Message: {}", entity.getId(), ex.getMessage());
//            }
//        }
//        return false;
//    }
//
//    private void processEntity(TmdbDataEntity entity) {
//        if (entity instanceof MovieTmdbDataEntity) {
//            updateTmdbForMovie(entity);
//        } else if (entity instanceof SeriesTmdbDataEntity) {
//            updateTmdbForSeries(entity);
//        }
//    }
//
//    private TmdbDataEntity updateTmdbForSeries(TmdbDataEntity tmdbDataEntity) {
//        SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(new RequestPayloads.AddRecord(
//                tmdbDataEntity.getTitle(), tmdbDataEntity.getId(), RECORD_TYE.SERIES.name(), false
//        ));
//        SeriesTmdbDataEntity seriesTmdbDataEntity =  (SeriesTmdbDataEntity) tmdbDataEntity;
//        pojoConverter.seriesTmdbDtoToEntity(seriesTmdbDataDto, seriesTmdbDataEntity);
//        return mergeTmdbEntity(seriesTmdbDataEntity);
//    }
//
//    private TmdbDataEntity updateTmdbForMovie(TmdbDataEntity tmdbDataEntity) {
//        MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(new RequestPayloads.AddRecord(
//                tmdbDataEntity.getTitle(), tmdbDataEntity.getId(), RECORD_TYE.MOVIE.name(), false
//        ));
//        MovieTmdbDataEntity movieTmdbDataEntity =  (MovieTmdbDataEntity) tmdbDataEntity;
//        pojoConverter.movieTmdbDtoToEntity(movieTmdbDataDto, movieTmdbDataEntity);
//        return mergeTmdbEntity(movieTmdbDataEntity);
//    }
//
//    @Override
//    public DbWorldRecords.TmdbUpdateProcessStatus getStatusOfRecordsUpdate() {
//        return tmdbUpdateStatusTracker.getCurrentStatus();
//    }
//
//    @Override
//    public boolean isRecordsUpdateRunning() {
//        return tmdbUpdateStatusTracker.isRunning();
//    }
//
//    @Override
//    @Cacheable(keyGenerator = AppConstants.CUSTOM_REDIS_KEY_GENERATOR)
//    public List<GenresDto> getAllGenres() {
//        List<GenresEntity> genresEntities = genresRepository.findAll(Sort.by("name").ascending());
//        return genresEntities.stream().map(genresEntity -> this.modelMapper.map(genresEntity, GenresDto.class)).collect(Collectors.toList());
//    }
//
//    @Override
//    public List<HashMap<String, Object>> getTmdbByQuery(RECORD_TYE recordType, String query, int year) {
//        ResponseEntity<String> response = null;
//        List<HashMap<String, Object>> tmdbSearchList = new ArrayList<>();
//        try {
//            response = restTemplate.exchange(
//                    recordType == RECORD_TYE.MOVIE ? TMDB_SEARCH_MOVIE_PROVIDER_URL : TMDB_SEARCH_SERIES_PROVIDER_URL, HttpMethod.GET, null, new ParameterizedTypeReference<>() {},
//                    query, year
//            );
//            String tmdbRecords = response.getBody();
//            JsonObject tmdbRecordsJson = new Gson().fromJson(tmdbRecords, JsonObject.class);
//            if (tmdbRecordsJson.getAsJsonPrimitive("total_results").getAsInt() != 0) {
//                JsonArray tmdbArray = tmdbRecordsJson.getAsJsonArray("results");
//                tmdbArray.forEach(jsonElement -> {
//                    JsonObject jsonObject = jsonElement.getAsJsonObject();
//                    HashMap<String, Object> hashMap = new HashMap<>();
//                    hashMap.put("id", jsonObject.get("id"));
//                    hashMap.put("title", jsonObject.get(recordType == RECORD_TYE.MOVIE ? "title" : "name"));
//                    hashMap.put("originalTitle", jsonObject.get(recordType == RECORD_TYE.MOVIE ? "original_title" : "original_name"));
//                    hashMap.put("releaseDate", jsonObject.get(recordType == RECORD_TYE.MOVIE ? "release_date" : "first_air_date"));
//                    hashMap.put("overview", jsonObject.get("overview"));
//                    hashMap.put("posterPath", jsonObject.get("poster_path"));
//                    tmdbSearchList.add(hashMap);
//                });
//            }
//        } catch (HttpClientErrorException | HttpServerErrorException ex) {
//            ResponsePayloads.TmdbFilerResponse tmdbFilerResponse = new Gson().fromJson(ex.getResponseBodyAsString(), ResponsePayloads.TmdbFilerResponse.class);
//            throw new TmdbApiException(null, tmdbFilerResponse.getStatus_message(), ex.getStatusCode());
//        }
//        return tmdbSearchList;
//    }
//
//    @Override
//    public MovieTmdbDataDto getTMDBDetailsForMovieById(RequestPayloads.AddRecord record) {
//        JsonObject recordDetailsJson = getRecordDetailsFromTmdbApi(record);
//        return new Gson().fromJson(recordDetailsJson, MovieTmdbDataDto.class);
//    }
//
//    @Override
//    public SeriesTmdbDataDto getTMDBDetailsForSeriesById(RequestPayloads.AddRecord record) {
//        JsonObject recordDetailsJson = getRecordDetailsFromTmdbApi(record);
//        return new Gson().fromJson(recordDetailsJson, SeriesTmdbDataDto.class);
//    }
//
//
//    private TmdbDataEntity mergeTmdbEntity(TmdbDataEntity tmdbDataEntity) {
//
//
//
//        if (tmdbDataEntity.getSpoken_languages() != null) {
//            tmdbDataEntity.getSpoken_languages().forEach(
//                    spokenLanguageEntity -> {
//                        SpokenLanguageEntity spokenLanguage = entityManager.find(SpokenLanguageEntity.class, spokenLanguageEntity.getIso_639_1());
//                        if (spokenLanguage == null) {
//                            entityManager.persist(spokenLanguageEntity);
//                        } else {
////                            entityManager.merge(spokenLanguageEntity);
//                        }
//                    }
//            );
//        }
//
//        if (tmdbDataEntity.getProduction_countries() != null) {
//            tmdbDataEntity.getProduction_countries().forEach(
//                    productionCountriesEntity -> {
//                        ProductionCountriesEntity productionCountries = entityManager.find(ProductionCountriesEntity.class, productionCountriesEntity.getIso_3166_1());
//                        if (productionCountries == null) {
//                            entityManager.persist(productionCountriesEntity);
//                        } else {
//                            entityManager.merge(productionCountriesEntity);
//                        }
//                    }
//            );
//        }
//
//        if (tmdbDataEntity.getProduction_companies() != null) {
//            tmdbDataEntity.getProduction_companies().forEach(
//                    productionCompaniesEntity -> {
//                        ProductionCompaniesEntity productionCountries = entityManager.find(ProductionCompaniesEntity.class, productionCompaniesEntity.getId());
//                        if (productionCountries == null) {
//                            entityManager.persist(productionCompaniesEntity);
//                        } else {
//                            entityManager.merge(productionCompaniesEntity);
//                        }
//                    }
//            );
//        }
//
//        if (tmdbDataEntity.getVideos() != null) {
//            tmdbDataEntity.getVideos().forEach(videosEntity -> {
//                if (videosEntity.getIso_3166_1() != null) {
//                    ProductionCountriesEntity productionCountries = entityManager.find(ProductionCountriesEntity.class, videosEntity.getIso_3166_1().getIso_3166_1());
//                    if (productionCountries == null) {
//                        entityManager.persist(videosEntity.getIso_3166_1());
//                    } else {
//                        entityManager.merge(videosEntity.getIso_3166_1());
//                    }
//                }
//                if (videosEntity.getIso_639_1() != null) {
//                    SpokenLanguageEntity spokenLanguage = entityManager.find(SpokenLanguageEntity.class, videosEntity.getIso_639_1().getIso_639_1());
//                    if (spokenLanguage == null) {
//                        entityManager.persist(videosEntity.getIso_639_1());
//                    } else {
//                        entityManager.merge(videosEntity.getIso_639_1());
//                    }
//                }
//            });
//        }
//
//        if (tmdbDataEntity.getImages() != null) {
//            tmdbDataEntity.getImages().forEach(imagesEntity -> {
//                if (imagesEntity.getIso_639_1() != null) {
//                    SpokenLanguageEntity spokenLanguage = entityManager.find(SpokenLanguageEntity.class, imagesEntity.getIso_639_1().getIso_639_1());
//                    if (spokenLanguage == null) {
//                        entityManager.persist(imagesEntity.getIso_639_1());
//                    } else {
//                        entityManager.merge(imagesEntity.getIso_639_1());
//                    }
//                }
//            });
//        }
//
//        if (tmdbDataEntity.getCredits() != null) {
//            if (tmdbDataEntity.getCredits().getCrew() != null) {
//                tmdbDataEntity.getCredits().getCrew().forEach(crew -> {
//                    PersonEntity person = entityManager.find(PersonEntity.class, crew.getPerson().getId());
//                    if (person == null) {
//                        entityManager.persist(crew.getPerson());
//                    } else {
//                        entityManager.merge(person);
//                    }
//                    DepartmentEntity department = entityManager.find(DepartmentEntity.class, crew.getDepartment().getName());
//                    if (department == null) {
//                        entityManager.persist(crew.getDepartment());
//                    }
//                    JobEntity job = entityManager.find(JobEntity.class, crew.getJob().getName());
//                    if (job == null) {
//                        entityManager.persist(crew.getJob());
//                    }
//                });
//            }
//            if (tmdbDataEntity.getCredits().getCast() != null) {
//                tmdbDataEntity.getCredits().getCast().forEach(cast -> {
//                    PersonEntity person = entityManager.find(PersonEntity.class, cast.getPerson().getId());
//                    if (person == null) {
//                        entityManager.persist(cast.getPerson());
//                    }
//                    CharacterEntity character = entityManager.find(CharacterEntity.class, cast.getCharacter().getName());
//                    if (character == null) {
//                        entityManager.persist(cast.getCharacter());
//                    }
//                });
//            }
//        }
//
//        return entityManager.merge(tmdbDataEntity);
//    }
//
//    private DBCinemaRecordsEntity addUsersDbCinemaData(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
//        Long userId = this.userService.getUserIdFromToken();
//        UserRecordDataEntity userRecordDataEntity = userRecordDataRepository.findByUserUserIdAndDbCinemaRecordId(userId, dbCinemaRecordsEntity.getId()).orElse(null);
//        dbCinemaRecordsEntity.setWatchListed(userRecordDataEntity != null && userRecordDataEntity.isWatchListed());
//        dbCinemaRecordsEntity.setLiked(userRecordDataEntity != null && userRecordDataEntity.isLiked());
//        dbCinemaRecordsEntity.setWatched(userRecordDataEntity != null && userRecordDataEntity.isWatched());
//        return dbCinemaRecordsEntity;
//    }
//
//    private JsonObject getRecordDetailsFromTmdbApi(RequestPayloads.AddRecord record) {
//
//        ResponseEntity<String> recordDetailsResponse;
//        ResponseEntity<String> recordProviderResponse = null;
//        try {
////            recordDetailsResponse = restTemplate.getForEntity(dbWorldUtils.getTMDBRecordDetailsUrl(record), String.class);
//            recordDetailsResponse = restTemplate.exchange(
//                    record.getType().equalsIgnoreCase(RECORD_TYE.MOVIE.name()) ? TMDB_MOVIE_DETAILS_URL : TMDB_SERIES_DETAILS_URL, HttpMethod.GET, null, new ParameterizedTypeReference<>() {},
//                    record.getTmdbId()
//            );
//        } catch (HttpClientErrorException | HttpServerErrorException ex) {
//            ResponsePayloads.TmdbFilerResponse tmdbFilerResponse = new Gson().fromJson(ex.getResponseBodyAsString(), ResponsePayloads.TmdbFilerResponse.class);
//            throw new TmdbApiException(record.getTmdbId(), tmdbFilerResponse.getStatus_message(), ex.getStatusCode());
//        }
//
//        try {
//            recordProviderResponse = restTemplate.exchange(
//                    record.getType().equalsIgnoreCase(RECORD_TYE.MOVIE.name()) ? TMDB_MOVIE_PROVIDER_URL : TMDB_SERIES_PROVIDER_URL, HttpMethod.GET,
//                    null, new ParameterizedTypeReference<>() {},
//                    record.getTmdbId()
//            );
////            recordProviderResponse = restTemplate.getForEntity(dbWorldUtils.getTMDBRecordProviderUrl(record), String.class);
//        } catch (HttpClientErrorException | HttpServerErrorException ex) {
//            ResponsePayloads.TmdbFilerResponse tmdbFilerResponse = new Gson().fromJson(ex.getResponseBodyAsString(), ResponsePayloads.TmdbFilerResponse.class);
//            log.error("Error while getting tmdb provider details. Error: {}", tmdbFilerResponse.getStatus_message());
//        }
//
//        return modifyTmdbJson(recordDetailsResponse.getBody(), recordProviderResponse == null ? null : recordProviderResponse.getBody(), record.getType());
//    }
//
//    private JsonObject modifyTmdbJson(String recordDetailsResponse, String recordProviderResponse, String recordType) {
//        //Getting Record Details and modifying "videos" object
//        JsonObject recordDetailsJson = new Gson().fromJson(Objects.requireNonNull(recordDetailsResponse), JsonObject.class);
//        JsonElement videosJsonElement = recordDetailsJson.getAsJsonObject(AppConstants.TMDB_VIDEOS_PROPERTY_KEY)
//                .get(AppConstants.TMDB_RESULTS_PROPERTY_KEY);
//        recordDetailsJson.add(AppConstants.TMDB_VIDEOS_PROPERTY_KEY, videosJsonElement);
//
//        //Getting Record's ott provider and adding in record details Json Object
//        JsonObject inKeyJsonObject = new Gson().fromJson(Objects.requireNonNull(recordProviderResponse), JsonObject.class)
//                .getAsJsonObject(AppConstants.TMDB_RESULTS_PROPERTY_KEY)
//                .getAsJsonObject(AppConstants.TMDB_IN_PROPERTY_KEY);
//
//        if (inKeyJsonObject != null && (!inKeyJsonObject.isJsonNull() || !inKeyJsonObject.isEmpty())) {
//            JsonObject providersJsonObject = new JsonObject();
//            providersJsonObject.add(AppConstants.TMDB_RENT_PROPERTY_KEY, inKeyJsonObject.get(AppConstants.TMDB_RENT_PROPERTY_KEY));
//            providersJsonObject.add(AppConstants.TMDB_BUY_PROPERTY_KEY, inKeyJsonObject.get(AppConstants.TMDB_BUY_PROPERTY_KEY));
//            providersJsonObject.add(AppConstants.TMDB_FLATRATE_PROPERTY_KEY, inKeyJsonObject.get(AppConstants.TMDB_FLATRATE_PROPERTY_KEY));
//
//            recordDetailsJson.add(AppConstants.PROVIDERS_PROPERTY_KEY, providersJsonObject);
//        }
//
//        //If it's Series then have to modify some properties
//        if (recordType.equalsIgnoreCase(RECORD_TYE.SERIES.name())) {
//            recordDetailsJson.add(AppConstants.TMDB_TITLE_PROPERTY_KEY, recordDetailsJson.get(AppConstants.TMDB_NAME_PROPERTY_KEY));
//            recordDetailsJson.add(AppConstants.TMDB_ORIGINAL_TITLE_PROPERTY_KEY, recordDetailsJson.get(AppConstants.TMDB_ORIGINAL_NAME_PROPERTY_KEY));
//        }
//        return recordDetailsJson;
//    }
//
//    private void evictRecordCaches(Long recordId) {
//        Cache cache = cacheManager.getCache("DB-Cinema");
//        if (cache != null) {
//            String recordKey = "record:" + recordId;
//            String entityKey = "record-entity:" + recordId;
//
//            cache.evict(recordKey);
//            log.info("Evicted Redis cache for record key: {}", recordKey);
//
//            cache.evict(entityKey);
//            log.info("Evicted Redis cache for entity key: {}", entityKey);
//        }
//    }
//
//    private void evictAllWatchlistCacheForUser(Long userId) {
//        try {
//            String pattern = "DB-Cinema::watchlist:" + userId + ":*";
//            Set<String> keys = redisTemplate.keys(pattern);
//            if (keys != null && !keys.isEmpty()) {
//                redisTemplate.delete(keys);
//                log.info("Evicted {} watchlist cache entries for user {}", keys.size(), userId);
//                keys.forEach(key -> log.info("Evicted key: {}", key));
//            } else {
//                log.info("No watchlist cache keys found for user {}", userId);
//            }
//        } catch (Exception ex) {
//            log.error("Failed to evict watchlist cache for user {}: {}", userId, ex.getMessage());
//        }
//    }
//
//}
