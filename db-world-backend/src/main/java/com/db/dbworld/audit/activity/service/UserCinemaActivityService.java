package com.db.dbworld.audit.activity.service;

import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity;
import com.db.dbworld.core.user.entity.UserEntity;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ConcurrentHashMap;

@Log4j2
@Service
@Transactional
public class UserCinemaActivityService {

    @Autowired
    private UserService userService;

    @Autowired
    private UserCinemaActivityRepository userCinemaActivityRepository;

    // Configuration constants
    private static final Duration DOWNLOAD_SESSION_WINDOW = Duration.ofHours(6);
    private static final Duration STREAM_SESSION_WINDOW = Duration.ofHours(2);
    private static final Duration DOWNLOAD_GAP_TOLERANCE = Duration.ofMinutes(5); // Increased from 30 seconds
    private static final Duration STREAM_GAP_TOLERANCE = Duration.ofMinutes(30);
    private static final long RANGE_OVERLAP_THRESHOLD_BYTES = 100 * 1024 * 1024; // Increased from 10MB to 100MB
    private static final long STREAM_RANGE_TOLERANCE_BYTES = 100 * 1024 * 1024; // 100MB
    private static final long DOWNLOAD_CHUNK_TOLERANCE = 500 * 1024 * 1024; // 500MB for parallel chunks
    private static final long SEQUENTIAL_THRESHOLD = 50 * 1024 * 1024; // 50MB for sequential downloads

    // Patterns for parsing range headers
    private static final Pattern RANGE_PATTERN = Pattern.compile("bytes=(\\d+)-(\\d+)?");
    private static final Pattern RANGE_IN_ACTIVITY_PATTERN = Pattern.compile(
            "\\[Range:\\s*(bytes=(\\d+)-(\\d+)?)\\s*\\]");
    private static final Pattern COMPLETED_PATTERN = Pattern.compile("\\[COMPLETED\\]");

    // Per-user locks to prevent race conditions
    private final Map<String, ReentrantLock> userLocks = new ConcurrentHashMap<>();

    // Sequence generator for unique session IDs
    private final AtomicLong sessionSequence = new AtomicLong(System.currentTimeMillis());

    // In-memory tracking of recent sessions to reduce DB queries
    private final Map<String, RecentSessionInfo> recentSessionTracker = new ConcurrentHashMap<>();
    private static final Duration TRACKER_TTL = Duration.ofSeconds(10);

    // Quick de-duplication cache
    private final Map<String, Instant> recentRequests = new ConcurrentHashMap<>();
    private static final Duration DEDUP_WINDOW = Duration.ofSeconds(2);

    /**
     * Track download activity with synchronization to prevent duplicates
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void trackDownloadActivity(String userEmail, String filePath, String fileName,
                                      Long fileSize, String rangeHeader, String remoteAddr,
                                      String userAgent) {
        final long startTime = System.currentTimeMillis();
        final String trackingId = UUID.randomUUID().toString().substring(0, 8);

        try {
            // Quick de-duplication: skip if same request within last 2 seconds
            String dedupKey = userEmail + "|" + filePath + "|" + (rangeHeader != null ? rangeHeader : "null");
            if (isRecentDuplicate(dedupKey)) {
                log.debug("[{}] Skipping duplicate download request within 2s: {}", trackingId, dedupKey);
                return;
            }
            markAsProcessed(dedupKey);

            log.info("[{}] Starting download tracking - User: {}, File: {}, Range: {}",
                    trackingId, userEmail, fileName, rangeHeader != null ? rangeHeader : "full");

            // Validate inputs
            if (userEmail == null || filePath == null) {
                log.warn("[{}] Invalid parameters", trackingId);
                return;
            }

            UserEntity userEntity = userService.getUserEntityByEmail(userEmail);
            if (userEntity == null) {
                log.error("[{}] User not found: {}", trackingId, userEmail);
                return;
            }

            // Get or create user-specific lock
            ReentrantLock userLock = userLocks.computeIfAbsent(userEmail, k -> new ReentrantLock());

            // Acquire lock to prevent race conditions for this user
            if (userLock.tryLock(100, java.util.concurrent.TimeUnit.MILLISECONDS)) {
                try {
                    processDownloadTracking(trackingId, userEntity, filePath, fileName,
                            fileSize, rangeHeader, remoteAddr, userAgent, startTime);
                } finally {
                    userLock.unlock();
                }
            } else {
                log.warn("[{}] Could not acquire lock for user: {}, skipping tracking",
                        trackingId, userEmail);
            }

        } catch (Exception e) {
            log.error("[{}] Error tracking download activity for user: {}. Error: {}",
                    trackingId, userEmail, e.getMessage(), e);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("[{}] Download tracking completed in {}ms", trackingId, duration);
        }
    }

    /**
     * Track stream activity with synchronization to prevent duplicates
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void trackStreamActivity(String userEmail, String filePath, String fileName,
                                    Long fileSize, String rangeHeader, String remoteAddr,
                                    String userAgent) {
        final long startTime = System.currentTimeMillis();
        final String trackingId = UUID.randomUUID().toString().substring(0, 8);

        try {
            // Quick de-duplication: skip if same request within last 2 seconds
            String dedupKey = "STREAM_" + userEmail + "|" + filePath + "|" + (rangeHeader != null ? rangeHeader : "null");
            if (isRecentDuplicate(dedupKey)) {
                log.debug("[{}] Skipping duplicate stream request within 2s: {}", trackingId, dedupKey);
                return;
            }
            markAsProcessed(dedupKey);

            log.info("[{}] Starting stream tracking - User: {}, File: {}, Range: {}",
                    trackingId, userEmail, fileName, rangeHeader != null ? rangeHeader : "full");

            // Validate inputs
            if (userEmail == null || filePath == null) {
                log.warn("[{}] Invalid parameters", trackingId);
                return;
            }

            UserEntity userEntity = userService.getUserEntityByEmail(userEmail);
            if (userEntity == null) {
                log.error("[{}] User not found: {}", trackingId, userEmail);
                return;
            }

            // Get or create user-specific lock
            ReentrantLock userLock = userLocks.computeIfAbsent(userEmail, k -> new ReentrantLock());

            // Acquire lock to prevent race conditions for this user
            if (userLock.tryLock(100, java.util.concurrent.TimeUnit.MILLISECONDS)) {
                try {
                    processStreamTracking(trackingId, userEntity, filePath, fileName,
                            fileSize, rangeHeader, remoteAddr, userAgent, startTime);
                } finally {
                    userLock.unlock();
                }
            } else {
                log.warn("[{}] Could not acquire lock for user: {}, skipping tracking",
                        trackingId, userEmail);
            }

        } catch (Exception e) {
            log.error("[{}] Error tracking stream activity for user: {}. Error: {}",
                    trackingId, userEmail, e.getMessage(), e);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("[{}] Stream tracking completed in {}ms", trackingId, duration);
        }
    }

    /**
     * Process download tracking with synchronization
     */
    private void processDownloadTracking(String trackingId, UserEntity userEntity, String filePath,
                                         String fileName, Long fileSize, String rangeHeader,
                                         String remoteAddr, String userAgent, long startTime) {

        String trackerKey = createTrackerKey(userEntity.getEmail(), filePath, "DOWNLOAD");

        // Check if we recently processed a similar request
        RecentSessionInfo recentInfo = recentSessionTracker.get(trackerKey);
        if (recentInfo != null && !recentInfo.isExpired()) {
            // If same request within short time, skip to prevent duplicates
            if (Duration.between(recentInfo.timestamp, Instant.now()).toMillis() < 500) {
                log.debug("[{}] Skipping duplicate download request detected within 500ms", trackingId);
                return;
            }
        }

        // Find active session with better query
        Optional<UserCinemaActivityEntity> activeSession = findActiveSession(
                userEntity, filePath, UserCinemaActivityEntity.ActivityType.DOWNLOAD,
                DOWNLOAD_SESSION_WINDOW, trackingId);

        boolean shouldCreateNewSession = true;
        UserCinemaActivityEntity sessionToUpdate = null;
        String rangeInfo = "";

        if (activeSession.isPresent()) {
            UserCinemaActivityEntity session = activeSession.get();

            // Enhanced logging for debugging
            String existingRange = extractRangeFromActivityValue(session.getActivityValue());
            log.debug("[{}] Existing session found - ID: {}, Last updated: {}, Existing range: {}, Current range: {}",
                    trackingId, session.getId(), session.getLastUpdated(), existingRange, rangeHeader);

            // In processDownloadTracking method, when checking isSameDownloadSession:
            if (isSameDownloadSession(rangeHeader, session)) {
                shouldCreateNewSession = false;
                sessionToUpdate = session;

                // Enhanced logging
                logDownloadSessionAnalysis(trackingId, rangeHeader, existingRange, true);

                log.debug("[{}] Same download session detected - updating session: {}", trackingId, session.getId());
            } else {
                logDownloadSessionAnalysis(trackingId, rangeHeader, existingRange, false);
                log.debug("[{}] Different download session - creating new session", trackingId);
            }
        } else {
            log.debug("[{}] No active session found - creating new session", trackingId);
        }

        if (shouldCreateNewSession) {
            // Create new session
            UserCinemaActivityEntity newSession = createNewSession(
                    userEntity, filePath, fileName, fileSize, rangeHeader, remoteAddr,
                    userAgent, trackingId, UserCinemaActivityEntity.ActivityType.DOWNLOAD);

            // Update tracker
            recentSessionTracker.put(trackerKey, new RecentSessionInfo(newSession.getId()));

            log.info("[{}] Created new download session - ID: {}, User: {}, File: {}, Range: {}",
                    trackingId, newSession.getId(), userEntity.getEmail(), fileName, rangeHeader);

        } else {
            // Update existing session
            updateSession(sessionToUpdate, fileSize, rangeHeader, remoteAddr, userAgent, trackingId);

            // Update tracker
            recentSessionTracker.put(trackerKey, new RecentSessionInfo(sessionToUpdate.getId()));

            log.info("[{}] Updated existing download session - ID: {}, Updates: {}, Range: {} {}",
                    trackingId, sessionToUpdate.getId(),
                    sessionToUpdate.getUpdateCount() != null ? sessionToUpdate.getUpdateCount() : 1,
                    rangeHeader, rangeInfo);
        }

        // Clean old tracker entries periodically
        cleanOldTrackerEntries();
    }

    /**
     * Process stream tracking with synchronization
     */
    private void processStreamTracking(String trackingId, UserEntity userEntity, String filePath,
                                       String fileName, Long fileSize, String rangeHeader,
                                       String remoteAddr, String userAgent, long startTime) {

        String trackerKey = createTrackerKey(userEntity.getEmail(), filePath, "STREAM");

        // Check if we recently processed a similar request
        RecentSessionInfo recentInfo = recentSessionTracker.get(trackerKey);
        if (recentInfo != null && !recentInfo.isExpired()) {
            // If same request within short time, skip to prevent duplicates
            if (Duration.between(recentInfo.timestamp, Instant.now()).toMillis() < 500) {
                log.debug("[{}] Skipping duplicate stream request detected within 500ms", trackingId);
                return;
            }
        }

        // Find active session
        Optional<UserCinemaActivityEntity> activeSession = findActiveSession(
                userEntity, filePath, UserCinemaActivityEntity.ActivityType.STREAM,
                STREAM_SESSION_WINDOW, trackingId);

        boolean shouldCreateNewSession = true;
        UserCinemaActivityEntity sessionToUpdate = null;

        if (activeSession.isPresent()) {
            UserCinemaActivityEntity session = activeSession.get();
            if (isSameStreamSession(rangeHeader, session)) {
                shouldCreateNewSession = false;
                sessionToUpdate = session;
                log.debug("[{}] Found existing stream session to update: {}", trackingId, session.getId());
            }
        }

        if (shouldCreateNewSession) {
            // Create new session
            UserCinemaActivityEntity newSession = createNewSession(
                    userEntity, filePath, fileName, fileSize, rangeHeader, remoteAddr,
                    userAgent, trackingId, UserCinemaActivityEntity.ActivityType.STREAM);

            // Update tracker
            recentSessionTracker.put(trackerKey, new RecentSessionInfo(newSession.getId()));

            log.info("[{}] Created new stream session - ID: {}, User: {}, File: {}",
                    trackingId, newSession.getId(), userEntity.getEmail(), fileName);

        } else {
            // Update existing session
            updateSession(sessionToUpdate, fileSize, rangeHeader, remoteAddr, userAgent, trackingId);

            // Update tracker
            recentSessionTracker.put(trackerKey, new RecentSessionInfo(sessionToUpdate.getId()));

            log.debug("[{}] Updated existing stream session - ID: {}",
                    trackingId, sessionToUpdate.getId());
        }

        // Clean old tracker entries periodically
        cleanOldTrackerEntries();
    }

    /**
     * Find active session for downloads
     */
    private Optional<UserCinemaActivityEntity> findActiveSession(UserEntity user,
                                                                 String filePath,
                                                                 UserCinemaActivityEntity.ActivityType activityType,
                                                                 Duration window,
                                                                 String trackingId) {
        try {
            Instant cutoffTime = Instant.now().minus(window);

            // First, check the most recent session with a more specific query
            List<UserCinemaActivityEntity> recentSessions = userCinemaActivityRepository
                    .findMostRecentActiveSession(
                            user.getUserId(),
                            filePath,
                            activityType,
                            cutoffTime,
                            PageRequest.of(0, 5) // Get more sessions for better analysis
                    );

            if (!recentSessions.isEmpty()) {
                // For downloads, we might have multiple recent sessions due to parallel chunks
                // Find the most appropriate one
                for (UserCinemaActivityEntity session : recentSessions) {
                    // Skip completed sessions
                    if (isSessionCompleted(session)) {
                        continue;
                    }

                    // For downloads, also check if it's within gap tolerance
                    Duration timeSinceUpdate = Duration.between(session.getLastUpdated(), Instant.now());
                    if (timeSinceUpdate.compareTo(DOWNLOAD_GAP_TOLERANCE) <= 0) {
                        log.debug("[{}] Found suitable active {} session: {}, Last update: {} ago",
                                trackingId, activityType, session.getId(), timeSinceUpdate);
                        return Optional.of(session);
                    }
                }
            }

            // Alternative: check by session ID pattern (faster)
            String sessionIdPattern = generateSessionIdBase(user.getEmail(), filePath,
                    activityType == UserCinemaActivityEntity.ActivityType.DOWNLOAD ? "DOWNLOAD" : "STREAM") + "%";
            List<UserCinemaActivityEntity> sessionsByPattern = userCinemaActivityRepository
                    .findBySessionIdLikeAndLastUpdatedAfter(
                            sessionIdPattern,
                            cutoffTime,
                            PageRequest.of(0, 3)
                    );

            if (!sessionsByPattern.isEmpty()) {
                for (UserCinemaActivityEntity session : sessionsByPattern) {
                    if (!isSessionCompleted(session) &&
                            session.getUser().getUserId() == user.getUserId() &&
                            session.getActivityType() == activityType) {

                        Duration timeSinceUpdate = Duration.between(session.getLastUpdated(), Instant.now());
                        if (timeSinceUpdate.compareTo(DOWNLOAD_GAP_TOLERANCE) <= 0) {
                            log.debug("[{}] Found active session by pattern: {}, Last update: {} ago",
                                    trackingId, session.getId(), timeSinceUpdate);
                            return Optional.of(session);
                        }
                    }
                }
            }

            log.debug("[{}] No active session found for user: {}, file: {}, type: {}",
                    trackingId, user.getEmail(), filePath, activityType);
            return Optional.empty();

        } catch (Exception e) {
            log.error("[{}] Error finding active session: {}", trackingId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * Improved download session matching logic for parallel chunk downloads
     */
    private boolean isSameDownloadSession(String currentRangeHeader, UserCinemaActivityEntity existingSession) {
        try {
            // If session is completed, always create new
            if (isSessionCompleted(existingSession)) {
                log.debug("Download session is completed, starting new");
                return false;
            }

            Instant now = Instant.now();
            Duration timeSinceLastUpdate = Duration.between(existingSession.getLastUpdated(), now);

            // If session is too old, start new
            if (timeSinceLastUpdate.compareTo(DOWNLOAD_GAP_TOLERANCE) > 0) {
                log.debug("Download session timeout exceeded ({} > {})", timeSinceLastUpdate, DOWNLOAD_GAP_TOLERANCE);
                return false;
            }

            // Handle range header analysis
            String previousRange = extractRangeFromActivityValue(existingSession.getActivityValue());

            // If existing session has no range header
            if (previousRange == null) {
                // If current also has no range, same session
                // If current has range, check if it's the first chunk
                return currentRangeHeader == null || parseRangeHeader(currentRangeHeader).start == 0;
            }

            // If current request has no range but previous had one
            if (currentRangeHeader == null) {
                // This might be a full download request after partial
                // Check if it starts from beginning
                return true;
            }

            // Parse ranges
            RangeInfo current = parseRangeHeader(currentRangeHeader);
            RangeInfo previous = parseRangeHeader(previousRange);

            if (current == null || previous == null) {
                // Can't parse ranges, be conservative - assume same session
                return true;
            }

            // ========== ENHANCED LOGIC FOR PARALLEL CHUNKS ==========

            // For downloads, we need to handle:
            // 1. Sequential downloads (0-100MB, 100MB-200MB, etc.)
            // 2. Parallel chunks (0-100MB, 50MB-150MB, etc.)
            // 3. Browser resuming from different positions

            // Case 1: Previous was downloading to end of file
            if (previous.end == -1) {
                // Previous: bytes=0- (downloading whole file)
                // Current could be a parallel chunk or continuation
                if (current.start == 0) {
                    // Both start at 0, same session
                    return true;
                } else if (current.start > 0 && current.end != -1) {
                    // Current is a chunk starting somewhere in the middle
                    // This is likely a parallel download chunk - same session
                    return true;
                }
            }

            // Case 2: Current is downloading to end of file
            if (current.end == -1) {
                // Current: bytes=X- (downloading to end)
                // Check if this continues from previous chunk
                if (previous.end != -1) {
                    // Previous had an end point
                    long gap = current.start - previous.end;
                    return Math.abs(gap) < SEQUENTIAL_THRESHOLD;
                } else {
                    // Previous also had no end
                    return Math.abs(current.start - previous.start) < RANGE_OVERLAP_THRESHOLD_BYTES;
                }
            }

            // Case 3: Both have defined end points
            if (current.end != -1 && previous.end != -1) {
                // Check for sequential continuation
                long sequentialGap = current.start - previous.end;
                boolean isSequential = Math.abs(sequentialGap) < SEQUENTIAL_THRESHOLD;

                // Check for overlap
                boolean isOverlapping = areRangesOverlapping(current, previous);

                // Check for parallel chunks (current starts before previous ends)
                boolean isParallelChunk = current.start < previous.end && current.start > previous.start;

                // Check for chunk within reasonable gap (for parallel downloads)
                long chunkGap = Math.abs(current.start - previous.start);
                boolean isWithinChunkTolerance = chunkGap < DOWNLOAD_CHUNK_TOLERANCE;

                // Log the analysis for debugging
                log.debug("Download range analysis - Current: {}-{}, Previous: {}-{}, " +
                                "SequentialGap: {}, isSequential: {}, isOverlapping: {}, " +
                                "isParallelChunk: {}, isWithinChunkTolerance: {}",
                        current.start, current.end, previous.start, previous.end,
                        sequentialGap, isSequential, isOverlapping,
                        isParallelChunk, isWithinChunkTolerance);

                return isSequential || isOverlapping || isParallelChunk || isWithinChunkTolerance;
            }

            // Default: For downloads, if same file and within time window,
            // assume same session to avoid creating multiple sessions for parallel chunks
            return true;

        } catch (Exception e) {
            log.warn("Error in download session matching: {}", e.getMessage());
            // On error, assume same session to prevent creating unnecessary new sessions
            return true;
        }
    }

    /**
     * Stream session matching logic (more lenient)
     */
    private boolean isSameStreamSession(String currentRangeHeader, UserCinemaActivityEntity existingSession) {
        try {
            // If session is completed, always create new
            if (isSessionCompleted(existingSession)) {
                log.debug("Stream session is completed, starting new");
                return false;
            }

            Instant now = Instant.now();
            Duration timeSinceLastUpdate = Duration.between(existingSession.getLastUpdated(), now);

            // Stream sessions have longer tolerance for gaps
            if (timeSinceLastUpdate.compareTo(STREAM_GAP_TOLERANCE) > 0) {
                log.debug("Stream session timeout exceeded ({} > {})", timeSinceLastUpdate, STREAM_GAP_TOLERANCE);
                return false;
            }

            // For streaming, we're more lenient - allow seeking within reasonable bounds
            if (currentRangeHeader != null && existingSession.getActivityValue() != null) {
                String previousRange = extractRangeFromActivityValue(existingSession.getActivityValue());
                if (previousRange != null) {
                    return areRangesProximate(currentRangeHeader, previousRange);
                }
            }

            // Default to same session for streaming (allows pausing, buffering)
            return true;

        } catch (Exception e) {
            log.warn("Error in stream session matching: {}", e.getMessage());
            return true; // On error, assume same session for streaming
        }
    }

    /**
     * Check if ranges overlap
     */
    private boolean areRangesOverlapping(RangeInfo current, RangeInfo previous) {
        if (current == null || previous == null) {
            return false;
        }

        // Handle cases where range goes to end of file
        boolean currentToEnd = current.end == -1;
        boolean previousToEnd = previous.end == -1;

        // Case 1: Both ranges go to end of file
        if (currentToEnd && previousToEnd) {
            // Both downloading entire file - definitely same session
            return true;
        }

        // Case 2: Current goes to end, previous has end
        if (currentToEnd && !previousToEnd) {
            // Current: bytes=X- (to end), Previous: bytes=A-B
            // If current starts before or near previous end, they overlap
            return current.start <= previous.end ||
                    Math.abs(current.start - previous.end) < RANGE_OVERLAP_THRESHOLD_BYTES;
        }

        // Case 3: Previous goes to end, current has end
        if (!currentToEnd && previousToEnd) {
            // Current: bytes=A-B, Previous: bytes=X- (to end)
            // If previous starts before or near current start, they overlap
            return previous.start <= current.start ||
                    Math.abs(previous.start - current.start) < RANGE_OVERLAP_THRESHOLD_BYTES;
        }

        // Case 4: Both have defined end points
        // Standard overlap check: current.start <= previous.end && previous.start <= current.end
        boolean overlaps = current.start <= previous.end && previous.start <= current.end;

        // Also check if they're very close (within threshold)
        boolean closeStart = Math.abs(current.start - previous.start) < RANGE_OVERLAP_THRESHOLD_BYTES;
        boolean closeEnd = Math.abs(current.end - previous.end) < RANGE_OVERLAP_THRESHOLD_BYTES;
        boolean sequentialProximity = Math.abs(current.start - previous.end) < SEQUENTIAL_THRESHOLD ||
                Math.abs(previous.start - current.end) < SEQUENTIAL_THRESHOLD;

        return overlaps || closeStart || closeEnd || sequentialProximity;
    }

    /**
     * Check if ranges are proximate (for streaming)
     */
    private boolean areRangesProximate(String currentRange, String previousRange) {
        try {
            RangeInfo current = parseRangeHeader(currentRange);
            RangeInfo previous = parseRangeHeader(previousRange);

            if (current == null || previous == null) {
                return true; // Allow if we can't parse
            }

            // For streaming, allow jumping around within tolerance
            long difference = Math.abs(current.start - previous.start);
            boolean isProximate = difference <= STREAM_RANGE_TOLERANCE_BYTES;

            log.debug("Range proximity check - Current: {}, Previous: {}, " +
                            "Difference: {}, Is proximate: {}",
                    current.start, previous.start, difference, isProximate);

            return isProximate;

        } catch (Exception e) {
            log.warn("Error checking range proximity: {}", e.getMessage());
            return true; // On error, allow it for streaming
        }
    }

    /**
     * Create new session with unique ID
     */
    private UserCinemaActivityEntity createNewSession(UserEntity user, String filePath,
                                                      String fileName, Long fileSize,
                                                      String rangeHeader, String remoteAddr,
                                                      String userAgent, String trackingId,
                                                      UserCinemaActivityEntity.ActivityType activityType) {
        try {
            // Generate truly unique session ID with timestamp and sequence
            String typePrefix = activityType == UserCinemaActivityEntity.ActivityType.DOWNLOAD ? "DOWNLOAD" : "STREAM";

            // Include range info in session ID for debugging
            String rangeSuffix = "";
            if (rangeHeader != null) {
                RangeInfo rangeInfo = parseRangeHeader(rangeHeader);
                if (rangeInfo != null) {
                    rangeSuffix = "_" + (rangeInfo.start / (1024 * 1024)) + "MB";
                    if (rangeInfo.end != -1) {
                        rangeSuffix += "-" + (rangeInfo.end / (1024 * 1024)) + "MB";
                    } else {
                        rangeSuffix += "-end";
                    }
                }
            }

            String sessionId = generateUniqueSessionId(user.getEmail(), filePath, typePrefix) + rangeSuffix;

            UserCinemaActivityEntity newEntity = new UserCinemaActivityEntity();
            newEntity.setUser(user);
            newEntity.setActivityType(activityType);

            // Store range info in activity value
            String activityValue = filePath;
            if (rangeHeader != null) {
                activityValue += " [Range: " + rangeHeader + "]";
            }
            newEntity.setActivityValue(activityValue);

            newEntity.setSessionId(sessionId);
            newEntity.setBytesTransferred(fileSize);
            newEntity.setFilePath(filePath);
            newEntity.setFileSize(fileSize);
            newEntity.setRemoteAddr(remoteAddr);
            newEntity.setUserAgent(userAgent);
            newEntity.setUpdateCount(1);

            UserCinemaActivityEntity savedEntity = userCinemaActivityRepository.save(newEntity);

            // Force flush to ensure it's visible to other transactions
            userCinemaActivityRepository.flush();

            log.info("[{}] Created {} session with ID: {}, Range: {}",
                    trackingId, activityType, sessionId, rangeHeader);
            return savedEntity;

        } catch (Exception e) {
            log.error("[{}] Error creating {} session: {}", trackingId, activityType, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Update existing session
     */
    private void updateSession(UserCinemaActivityEntity session, Long fileSize,
                               String rangeHeader, String remoteAddr,
                               String userAgent, String trackingId) {
        try {
            session.setBytesTransferred(fileSize);
            session.setRemoteAddr(remoteAddr);
            session.setUserAgent(userAgent);
            session.setLastUpdated(Instant.now());

            // Update activity value with new range info
            if (rangeHeader != null) {
                String activityValue = session.getFilePath() + " [Range: " + rangeHeader + "]";
                if (!activityValue.equals(session.getActivityValue())) {
                    session.setActivityValue(activityValue);
                }
            }

            // Increment update count
            Integer updateCount = session.getUpdateCount() != null ? session.getUpdateCount() : 0;
            session.setUpdateCount(updateCount + 1);

            userCinemaActivityRepository.save(session);

            log.debug("[{}] Updated {} session {} (update count: {})",
                    trackingId, session.getActivityType(), session.getId(), updateCount + 1);

        } catch (Exception e) {
            log.error("[{}] Error updating session: {}", trackingId, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Generate truly unique session ID
     */
    private String generateUniqueSessionId(String userEmail, String filePath, String type) {
        String cleanEmail = userEmail.replaceAll("[^a-zA-Z0-9]", "_");
        long timestamp = Instant.now().toEpochMilli();
        long sequence = sessionSequence.incrementAndGet() % 10000; // 4-digit sequence

        String prefix = type.equals("DOWNLOAD") ? "DL" : "ST";
        return String.format("%s_%s_%d_%d_%04d",
                prefix,
                cleanEmail,
                Math.abs(filePath.hashCode()),
                timestamp,
                sequence);
    }

    /**
     * Generate base session ID (for pattern matching)
     */
    private String generateSessionIdBase(String userEmail, String filePath, String type) {
        String cleanEmail = userEmail.replaceAll("[^a-zA-Z0-9]", "_");
        String prefix = type.equals("DOWNLOAD") ? "DL" : "ST";
        return String.format("%s_%s_%d", prefix, cleanEmail, Math.abs(filePath.hashCode()));
    }

    /**
     * Create tracker key
     */
    private String createTrackerKey(String userEmail, String filePath, String type) {
        return type + "_" + userEmail + "|" + filePath;
    }

    /**
     * Check for recent duplicates
     */
    private boolean isRecentDuplicate(String key) {
        Instant lastTime = recentRequests.get(key);
        if (lastTime == null) return false;

        return Duration.between(lastTime, Instant.now()).compareTo(DEDUP_WINDOW) < 0;
    }

    /**
     * Mark request as processed
     */
    private void markAsProcessed(String key) {
        recentRequests.put(key, Instant.now());

        // Clean old entries periodically
        if (recentRequests.size() > 1000) {
            cleanOldRequests();
        }
    }

    /**
     * Clean old tracker entries
     */
    private void cleanOldTrackerEntries() {
        // Only clean every 100 operations to avoid overhead
        if (recentSessionTracker.size() > 100) {
            Instant now = Instant.now();
            int cleaned = 0;

            Iterator<Map.Entry<String, RecentSessionInfo>> iterator = recentSessionTracker.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, RecentSessionInfo> entry = iterator.next();
                if (entry.getValue().isExpired(now)) {
                    iterator.remove();
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                log.debug("Cleaned {} old tracker entries", cleaned);
            }
        }
    }

    /**
     * Clean old request entries
     */
    private void cleanOldRequests() {
        Instant cutoff = Instant.now().minus(Duration.ofMinutes(5));
        recentRequests.entrySet().removeIf(entry ->
                entry.getValue().isBefore(cutoff));
    }

    /**
     * Mark download as completed
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDownloadComplete(String userEmail, String filePath, Long totalBytes) {
        final String trackingId = UUID.randomUUID().toString().substring(0, 8);

        try {
            UserEntity userEntity = userService.getUserEntityByEmail(userEmail);
            String cacheKey = generateSessionIdBase(userEmail, filePath, "DOWNLOAD");

            Optional<UserCinemaActivityEntity> activeSession = findActiveSession(
                    userEntity, filePath, UserCinemaActivityEntity.ActivityType.DOWNLOAD,
                    DOWNLOAD_SESSION_WINDOW, trackingId);

            if (activeSession.isPresent()) {
                UserCinemaActivityEntity session = activeSession.get();
                session.setBytesTransferred(totalBytes);
                session.setActivityValue(session.getFilePath() + " [COMPLETED]");
                session.setLastUpdated(Instant.now());
                session.setUpdateCount((session.getUpdateCount() != null ? session.getUpdateCount() : 0) + 1);

                userCinemaActivityRepository.save(session);

                // Clean cache
                recentSessionTracker.remove(createTrackerKey(userEmail, filePath, "DOWNLOAD"));

                log.info("[{}] Download marked as completed - User: {}, File: {}, " +
                                "Total bytes: {}, Session updates: {}",
                        trackingId, userEmail, filePath, totalBytes, session.getUpdateCount());
            } else {
                log.warn("[{}] No active download session found to mark as completed - " +
                        "User: {}, File: {}", trackingId, userEmail, filePath);
            }

        } catch (Exception e) {
            log.error("[{}] Error marking download complete for user: {}, file: {}. Error: {}",
                    trackingId, userEmail, filePath, e.getMessage(), e);
        }
    }

    // Helper methods

    private RangeInfo parseRangeHeader(String rangeHeader) {
        if (rangeHeader == null || rangeHeader.trim().isEmpty()) {
            return null;
        }

        Matcher matcher = RANGE_PATTERN.matcher(rangeHeader);
        if (matcher.matches()) {
            try {
                long start = Long.parseLong(matcher.group(1));
                String endStr = matcher.group(2);
                long end = (endStr != null && !endStr.isEmpty()) ?
                        Long.parseLong(endStr) : -1;
                return new RangeInfo(start, end);
            } catch (NumberFormatException e) {
                log.warn("Invalid range header format: {}", rangeHeader);
                return null;
            }
        }
        return null;
    }

    private String extractRangeFromActivityValue(String activityValue) {
        if (activityValue == null) return null;
        Matcher matcher = RANGE_IN_ACTIVITY_PATTERN.matcher(activityValue);
        return matcher.find() ? matcher.group(1) : null;
    }

    private boolean isSessionCompleted(UserCinemaActivityEntity session) {
        if (session.getActivityValue() == null) return false;
        return COMPLETED_PATTERN.matcher(session.getActivityValue()).find();
    }

    // Inner classes
    private static class RangeInfo {
        final long start;
        final long end;

        RangeInfo(long start, long end) {
            this.start = start;
            this.end = end;
        }
    }

    private static class RecentSessionInfo {
        final Long sessionId;
        final Instant timestamp;

        RecentSessionInfo(Long sessionId) {
            this.sessionId = sessionId;
            this.timestamp = Instant.now();
        }

        boolean isExpired() {
            return isExpired(Instant.now());
        }

        boolean isExpired(Instant now) {
            return Duration.between(timestamp, now).compareTo(TRACKER_TTL) > 0;
        }
    }

    public List<UserCinemaActivityEntity> getRecentActivities(UserEntity user, Instant cutoffTime, int limit) {
        log.debug("Fetching recent activities for user: {}, limit: {}", user.getEmail(), limit);
        return userCinemaActivityRepository.findByUserAndLastUpdatedAfterOrderByLastUpdatedDesc(
                user, cutoffTime, PageRequest.of(0, limit));
    }

    public List<UserCinemaActivityEntity> getRecentActivitiesByType(UserEntity user,
                                                                    UserCinemaActivityEntity.ActivityType activityType,
                                                                    Instant cutoffTime, int limit) {
        log.debug("Fetching recent {} activities for user: {}", activityType, user.getEmail());
        return userCinemaActivityRepository.findByUserAndActivityTypeAndLastUpdatedAfterOrderByLastUpdatedDesc(
                user, activityType, cutoffTime, PageRequest.of(0, limit));
    }

    public Map<UserCinemaActivityEntity.ActivityType, Long> getActivityStats(UserEntity user, Instant cutoffTime) {
        Map<UserCinemaActivityEntity.ActivityType, Long> stats = new HashMap<>();
        for (UserCinemaActivityEntity.ActivityType type : UserCinemaActivityEntity.ActivityType.values()) {
            Long count = userCinemaActivityRepository.countByUserAndActivityTypeAndLastUpdatedAfter(
                    user, type, cutoffTime);
            stats.put(type, count);
        }
        return stats;
    }

    public List<UserCinemaActivityEntity> getAllRecentActivities(Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.findByLastUpdatedAfterOrderByLastUpdatedDesc(
                cutoffTime, PageRequest.of(0, limit));
    }

    public List<UserCinemaActivityEntity> getAllRecentActivitiesByType(
            UserCinemaActivityEntity.ActivityType activityType, Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.findByActivityTypeAndLastUpdatedAfterOrderByLastUpdatedDesc(
                activityType, cutoffTime, PageRequest.of(0, limit));
    }

    public Map<UserCinemaActivityEntity.ActivityType, Long> getActivityStatsAll(Instant cutoffTime) {
        Map<UserCinemaActivityEntity.ActivityType, Long> stats = new HashMap<>();
        for (UserCinemaActivityEntity.ActivityType type : UserCinemaActivityEntity.ActivityType.values()) {
            Long count = userCinemaActivityRepository.countByActivityTypeAndLastUpdatedAfter(type, cutoffTime);
            stats.put(type, count);
        }
        return stats;
    }

    public List<Map<String, Object>> getActiveUsersWithStats(Instant cutoffTime) {
        return userCinemaActivityRepository.findActiveUsersWithStats(cutoffTime);
    }

    public Map<String, Object> getDashboardStats(Instant cutoffTime) {
        return userCinemaActivityRepository.getDashboardStats(cutoffTime);
    }

    public Long getTotalActivitiesCount(Instant cutoffTime) {
        return userCinemaActivityRepository.countByLastUpdatedAfter(cutoffTime);
    }

    public Long getActiveUsersCount(Instant cutoffTime) {
        return userCinemaActivityRepository.countDistinctUsersByLastUpdatedAfter(cutoffTime);
    }

    public List<Map<String, Object>> getTopDownloadedFiles(Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.getTopDownloadedFiles(cutoffTime, limit);
    }

    public List<Map<String, Object>> getPopularSearchKeywords(Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.getPopularSearchKeywords(cutoffTime, limit);
    }

    public List<Map<String, Object>> getFileTypeStats(Instant cutoffTime) {
        return userCinemaActivityRepository.getFileTypeStats(cutoffTime);
    }

    public List<Map<String, Object>> getPeakUsageHours(Instant cutoffTime) {
        return userCinemaActivityRepository.getPeakUsageHours(cutoffTime);
    }

    /**
     * Get session statistics for monitoring
     */
    public Map<String, Object> getSessionStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("userLocksSize", userLocks.size());
        stats.put("recentSessionTrackerSize", recentSessionTracker.size());
        stats.put("recentRequestsSize", recentRequests.size());
        stats.put("sessionSequence", sessionSequence.get());
        return stats;
    }

    /**
     * Clear all caches (for testing/admin purposes)
     */
    public void clearCaches() {
        userLocks.clear();
        recentSessionTracker.clear();
        recentRequests.clear();
        sessionSequence.set(System.currentTimeMillis());
        log.info("All caches cleared");
    }

    /**
     * Enhanced logging for download session analysis
     */
    private void logDownloadSessionAnalysis(String trackingId, String currentRange,
                                            String previousRange, boolean isSameSession) {
        if (log.isDebugEnabled()) {
            StringBuilder logMsg = new StringBuilder();
            logMsg.append("[")
                    .append(trackingId)
                    .append("] Download session analysis - ");

            logMsg.append("Current: ").append(currentRange != null ? currentRange : "null");
            logMsg.append(", Previous: ").append(previousRange != null ? previousRange : "null");

            if (currentRange != null && previousRange != null) {
                RangeInfo currentInfo = parseRangeHeader(currentRange);
                RangeInfo previousInfo = parseRangeHeader(previousRange);

                if (currentInfo != null && previousInfo != null) {
                    logMsg.append("\n  Range details: Current(")
                            .append(currentInfo.start).append("-")
                            .append(currentInfo.end == -1 ? "end" : currentInfo.end)
                            .append("), Previous(")
                            .append(previousInfo.start).append("-")
                            .append(previousInfo.end == -1 ? "end" : previousInfo.end)
                            .append(")");

                    if (previousInfo.end != -1 && currentInfo.end != -1) {
                        long gap = currentInfo.start - previousInfo.end;
                        logMsg.append("\n  Gap: ").append(gap).append(" bytes (")
                                .append(gap / (1024 * 1024)).append(" MB)");
                    }
                }
            }

            logMsg.append("\n  Decision: ").append(isSameSession ? "SAME session" : "NEW session");

            log.debug(logMsg.toString());
        }
    }
}