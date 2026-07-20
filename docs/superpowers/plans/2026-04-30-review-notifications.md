# Review Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user submits a new review, create DB-persisted notifications for all other users who have reviewed other content (active community members), and surface them through a bell icon with unread badge in the cinema navbar (desktop + mobile).

**Architecture:** A new `user_notifications` table stores one row per (recipient, review event). The `UserReviewController.upsert` endpoint triggers notification creation after a review is saved. The frontend polls the unread count on navbar mount, shows a badge, and renders a Popover/Drawer panel when the bell is clicked.

**Tech Stack:** Spring Boot / JPA (Hibernate, `@CreationTimestamp`), Spring Security (`UserContext`), React + MUI (Badge, Popover, Drawer), React Router, axios.

---

## File Map

**New backend files:**
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/entity/UserNotificationEntity.java`
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/repository/UserNotificationRepository.java`
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/dto/UserNotificationDto.java`
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/service/UserNotificationService.java`
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/service/impl/UserNotificationServiceImpl.java`
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/controller/UserNotificationController.java`

**Modified backend files:**
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/review/repository/UserReviewRepository.java` — add recipient-discovery JPQL query
- `db-world-backend/src/main/java/com/db/dbworld/app/cinema/review/controller/UserReviewController.java` — inject notif service, trigger after upsert

**New frontend files:**
- `db-world-frontend/src/features/cinema/components/notifications/NotificationPanel.jsx`

**Modified frontend files:**
- `db-world-frontend/src/features/cinema/api/cinemaApi.js` — add 3 notification API functions
- `db-world-frontend/src/features/cinema/navbar/index.js` — badge, bell handler, panel, desktop visibility

---

## Task 1: Backend — Entity + Repository + Recipient Query

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/entity/UserNotificationEntity.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/repository/UserNotificationRepository.java`
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/review/repository/UserReviewRepository.java`

- [ ] **Step 1: Create the notification entity**

```java
package com.db.dbworld.app.cinema.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "USER_NOTIFICATIONS", schema = "new_db_world")
public class UserNotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_user_id", nullable = false)
    private Long recipientUserId;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "actor_username", nullable = false, length = 150)
    private String actorUsername;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "record_title", nullable = false, length = 300)
    private String recordTitle;

    @Column(name = "record_type", nullable = false, length = 30)
    private String recordType;

    @Column(nullable = false)
    private boolean read = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
```

- [ ] **Step 2: Create the notification repository**

```java
package com.db.dbworld.app.cinema.notification.repository;

import com.db.dbworld.app.cinema.notification.entity.UserNotificationEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface UserNotificationRepository extends JpaRepository<UserNotificationEntity, Long> {

    List<UserNotificationEntity> findByRecipientUserIdOrderByCreatedAtDesc(
            Long recipientUserId, Pageable pageable);

    long countByRecipientUserIdAndReadFalse(Long recipientUserId);

    boolean existsByActorUserIdAndRecordId(Long actorUserId, Long recordId);

    @Modifying
    @Query("UPDATE UserNotificationEntity n SET n.read = true " +
           "WHERE n.recipientUserId = :userId AND n.read = false")
    void markAllReadByRecipientUserId(@Param("userId") Long userId);
}
```

- [ ] **Step 3: Add recipient-discovery query to UserReviewRepository**

Open `UserReviewRepository.java` and add this method at the bottom (before the closing `}`):

```java
/**
 * Returns all distinct userIds who have reviewed ANY record,
 * excluding the current actor and users who already reviewed this specific record.
 * These are the notification recipients.
 */
@Query("SELECT DISTINCT r.userId FROM UserReviewEntity r " +
       "WHERE r.userId != :actorId " +
       "AND r.userId NOT IN " +
       "(SELECT r2.userId FROM UserReviewEntity r2 WHERE r2.recordId = :recordId)")
List<Long> findReviewerIdsExcludingRecordAndActor(
        @Param("actorId") Long actorId,
        @Param("recordId") Long recordId);
```

Also add the import at the top of the file:
```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
```

(Skip any already present.)

- [ ] **Step 4: Compile to verify no errors**

```bash
cd db-world-backend
"C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" compile -q
```

Expected: BUILD SUCCESS with no errors.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/entity/UserNotificationEntity.java
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/repository/UserNotificationRepository.java
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/review/repository/UserReviewRepository.java
git commit -m "feat: add UserNotificationEntity, repository, and recipient query"
```

---

## Task 2: Backend — DTO + Service Interface + Service Implementation

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/dto/UserNotificationDto.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/service/UserNotificationService.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/service/impl/UserNotificationServiceImpl.java`

- [ ] **Step 1: Create the DTO**

```java
package com.db.dbworld.app.cinema.notification.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data
@Builder
public class UserNotificationDto {
    private Long    id;
    private String  actorUsername;
    private Long    recordId;
    private String  recordTitle;
    private String  recordType;
    private boolean read;
    private Instant createdAt;
}
```

- [ ] **Step 2: Create the service interface**

```java
package com.db.dbworld.app.cinema.notification.service;

import com.db.dbworld.app.cinema.notification.dto.UserNotificationDto;
import java.util.List;

public interface UserNotificationService {
    void createReviewNotifications(Long actorUserId, String actorUsername, Long recordId);
    List<UserNotificationDto> getForUser(Long userId, int limit);
    long getUnreadCount(Long userId);
    void markAllRead(Long userId);
}
```

- [ ] **Step 3: Create the service implementation**

```java
package com.db.dbworld.app.cinema.notification.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.notification.dto.UserNotificationDto;
import com.db.dbworld.app.cinema.notification.entity.UserNotificationEntity;
import com.db.dbworld.app.cinema.notification.repository.UserNotificationRepository;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.app.cinema.review.repository.UserReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserNotificationServiceImpl implements UserNotificationService {

    private final UserNotificationRepository notifRepo;
    private final UserReviewRepository       reviewRepo;
    private final RecordRepository           recordRepo;

    @Override
    @Transactional
    public void createReviewNotifications(Long actorUserId, String actorUsername, Long recordId) {
        // Deduplicate: this actor already triggered notifications for this record (e.g. review update)
        if (notifRepo.existsByActorUserIdAndRecordId(actorUserId, recordId)) return;

        RecordEntity record = recordRepo.findById(recordId).orElse(null);
        if (record == null) {
            log.warn("createReviewNotifications: record {} not found, skipping", recordId);
            return;
        }

        List<Long> recipients = reviewRepo.findReviewerIdsExcludingRecordAndActor(actorUserId, recordId);
        if (recipients.isEmpty()) return;

        String title      = record.getName();
        String recordType = record.getType().name();

        List<UserNotificationEntity> notifications = recipients.stream()
                .map(recipientId -> UserNotificationEntity.builder()
                        .recipientUserId(recipientId)
                        .actorUserId(actorUserId)
                        .actorUsername(actorUsername)
                        .recordId(recordId)
                        .recordTitle(title)
                        .recordType(recordType)
                        .read(false)
                        .build())
                .toList();

        notifRepo.saveAll(notifications);
        log.info("Created {} review notifications for record {} by user {}", notifications.size(), recordId, actorUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserNotificationDto> getForUser(Long userId, int limit) {
        return notifRepo.findByRecipientUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, limit))
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notifRepo.countByRecipientUserIdAndReadFalse(userId);
    }

    @Override
    @Transactional
    public void markAllRead(Long userId) {
        notifRepo.markAllReadByRecipientUserId(userId);
    }

    private UserNotificationDto toDto(UserNotificationEntity e) {
        return UserNotificationDto.builder()
                .id(e.getId())
                .actorUsername(e.getActorUsername())
                .recordId(e.getRecordId())
                .recordTitle(e.getRecordTitle())
                .recordType(e.getRecordType())
                .read(e.isRead())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
```

> **Note on RecordRepository:** The repository is at `com.db.dbworld.app.cinema.catalog.repository.RecordRepository`. It extends `JpaRepository<RecordEntity, Long>`, so `findById(Long id)` is available out of the box.

- [ ] **Step 4: Compile to verify**

```bash
cd db-world-backend
"C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/dto/UserNotificationDto.java
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/service/UserNotificationService.java
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/service/impl/UserNotificationServiceImpl.java
git commit -m "feat: add UserNotificationService with review notification creation"
```

---

## Task 3: Backend — REST Controller

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/controller/UserNotificationController.java`

- [ ] **Step 1: Create the controller**

```java
package com.db.dbworld.app.cinema.notification.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.notification.dto.UserNotificationDto;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class UserNotificationController {

    private final UserNotificationService notifService;
    private final UserContext             userContext;

    /** GET /api/notifications?limit=30 */
    @GetMapping
    public ApiResponse<List<UserNotificationDto>> getNotifications(
            @RequestParam(defaultValue = "30") int limit
    ) {
        return ApiResponse.success(notifService.getForUser(userContext.userId(), limit));
    }

    /** GET /api/notifications/unread-count  →  { "count": N } */
    @GetMapping("/unread-count")
    public ApiResponse<Map<String, Long>> getUnreadCount() {
        return ApiResponse.success(Map.of("count", notifService.getUnreadCount(userContext.userId())));
    }

    /** PUT /api/notifications/mark-read  — marks all unread for the caller as read */
    @PutMapping("/mark-read")
    public ApiResponse<Void> markAllRead() {
        notifService.markAllRead(userContext.userId());
        return ApiResponse.success("Marked all as read");
    }
}
```

- [ ] **Step 2: Compile to verify**

```bash
cd db-world-backend
"C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/notification/controller/UserNotificationController.java
git commit -m "feat: add UserNotificationController (GET, unread-count, mark-read)"
```

---

## Task 4: Backend — Hook Notification into Review Upsert

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/cinema/review/controller/UserReviewController.java`

- [ ] **Step 1: Inject UserNotificationService into UserReviewController**

In `UserReviewController.java`, add the new dependency to the existing field list (Lombok `@RequiredArgsConstructor` handles injection automatically):

```java
// Existing fields
private final UserReviewService  reviewService;
private final UserContext        userContext;
// Add this:
private final UserNotificationService notifService;
```

Add the import:
```java
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
```

- [ ] **Step 2: Trigger notifications after a successful upsert**

Replace the existing `upsert` method body:

```java
@PostMapping
public ApiResponse<UserReviewDto> upsert(
        @RequestParam Long recordId,
        @Valid @RequestBody UserReviewRequest body
) {
    Long   userId   = userContext.userId();
    String username = userContext.email();
    UserReviewDto result = reviewService.upsert(userId, username, recordId, body);
    notifService.createReviewNotifications(userId, username, recordId);
    return ApiResponse.success(result);
}
```

> The notification service's deduplication (`existsByActorUserIdAndRecordId`) ensures only the first review (not subsequent edits) triggers notifications — no change needed in the controller.

- [ ] **Step 3: Compile to verify**

```bash
cd db-world-backend
"C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Smoke-test the full backend flow**

Start the backend. Submit a review via:
```bash
curl -X POST "http://localhost:8080/api/cinema/reviews?recordId=1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"rating": 8, "content": "Great film!"}'
```

Then check notifications for another user:
```bash
curl "http://localhost:8080/api/notifications/unread-count" \
  -H "Authorization: Bearer <other-user-token>"
```

Expected: `{"data": {"count": N}, "httpStatusCode": 200}` — N > 0 if the other user has reviewed any other record.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/cinema/review/controller/UserReviewController.java
git commit -m "feat: trigger review notifications after upsert in UserReviewController"
```

---

## Task 5: Frontend — Notification API Functions

**Files:**
- Modify: `db-world-frontend/src/features/cinema/api/cinemaApi.js`

- [ ] **Step 1: Add the three notification API functions**

Append to the bottom of `cinemaApi.js`:

```javascript
// ─── Notifications ────────────────────────────────────────────────────────────

/** GET /api/notifications?limit=N → UserNotificationDto[] */
export const fetchNotifications = (limit = 30) =>
  axiosInstance.get('/api/notifications', { params: { limit } }).then(unwrap);

/** GET /api/notifications/unread-count → number */
export const fetchUnreadCount = () =>
  axiosInstance.get('/api/notifications/unread-count')
    .then(r => r.data?.data?.count ?? 0);

/** PUT /api/notifications/mark-read */
export const markNotificationsRead = () =>
  axiosInstance.put('/api/notifications/mark-read').then(unwrap);
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/cinema/api/cinemaApi.js
git commit -m "feat: add fetchNotifications, fetchUnreadCount, markNotificationsRead to cinemaApi"
```

---

## Task 6: Frontend — NotificationPanel Component

**Files:**
- Create: `db-world-frontend/src/features/cinema/components/notifications/NotificationPanel.jsx`

- [ ] **Step 1: Create the component**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, CircularProgress, Divider,
  Popover, Drawer, List, ListItemButton,
  alpha, useTheme, useMediaQuery,
} from '@mui/material';
import { Close, RateReview, NotificationsNone } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationsRead } from '../../api/cinemaApi';
import Constants from '@shared/constants';

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getRecordRoute(recordType, recordTitle) {
  const encoded = encodeURIComponent(recordTitle);
  const isSeries = ['TV_SERIES', 'SERIES', 'TV'].includes((recordType ?? '').toUpperCase());
  if (isSeries) return Constants.DB_SERIES_DETIALS_ROUTE.replace(':title', encoded);
  return Constants.DB_MOVIE_DETIALS_ROUTE.replace(':title', encoded);
}

const NotificationItem = ({ notif, onNavigate }) => {
  const theme = useTheme();
  return (
    <ListItemButton
      onClick={() => onNavigate(notif)}
      sx={{
        py: 1.5, px: 2, gap: 1.5,
        alignItems: 'flex-start',
        bgcolor: notif.read ? 'transparent' : alpha(theme.palette.primary.main, 0.07),
        borderLeft: `3px solid ${notif.read ? 'transparent' : theme.palette.primary.main}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
      }}
    >
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        bgcolor: alpha(theme.palette.primary.main, 0.15),
        display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.25,
      }}>
        <RateReview sx={{ fontSize: 15, color: theme.palette.primary.main }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.83rem', lineHeight: 1.45, fontWeight: notif.read ? 400 : 600 }}>
          <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 700 }}>
            {notif.actorUsername}
          </Box>
          {' reviewed '}
          <Box component="span" sx={{ fontWeight: 700 }}>
            {notif.recordTitle}
          </Box>
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.3 }}>
          {relativeTime(notif.createdAt)}
        </Typography>
      </Box>
    </ListItemButton>
  );
};

const PanelContent = ({ onClose, onUnreadClear }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNotifications(30)
      .then(data => setNotifications(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    markNotificationsRead()
      .then(() => onUnreadClear())
      .catch(() => {});
  }, [onUnreadClear]);

  const handleNavigate = useCallback((notif) => {
    onClose();
    navigate(getRecordRoute(notif.recordType, notif.recordTitle));
  }, [onClose, navigate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Notifications</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Body */}
      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.disabled', px: 3 }}>
          <NotificationsNone sx={{ fontSize: 44, opacity: 0.3 }} />
          <Typography sx={{ fontSize: '0.85rem', textAlign: 'center', opacity: 0.6 }}>
            No notifications yet. They'll appear here when someone reviews a title you might like.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>
          <List disablePadding>
            {notifications.map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && <Divider />}
                <NotificationItem notif={n} onNavigate={handleNavigate} />
              </React.Fragment>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

/**
 * NotificationPanel
 * Props:
 *   anchorEl  — DOM element the Popover anchors to (null = closed)
 *   onClose   — called when panel should close
 *   onUnreadClear — called after markNotificationsRead succeeds (to zero the badge)
 */
const NotificationPanel = ({ anchorEl, onClose, onUnreadClear }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const open = Boolean(anchorEl);

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            height: '70vh', overflow: 'hidden',
          },
        }}
      >
        <PanelContent onClose={onClose} onUnreadClear={onUnreadClear} />
      </Drawer>
    );
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{
        sx: {
          width: 360, height: 480, overflow: 'hidden',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          mt: 0.5,
        },
      }}
      disableScrollLock
    >
      <PanelContent onClose={onClose} onUnreadClear={onUnreadClear} />
    </Popover>
  );
};

export default NotificationPanel;
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/cinema/components/notifications/NotificationPanel.jsx
git commit -m "feat: add NotificationPanel component (Popover desktop, Drawer mobile)"
```

---

## Task 7: Frontend — Navbar Bell (Badge + Desktop Visibility + Panel)

**Files:**
- Modify: `db-world-frontend/src/features/cinema/navbar/index.js`

- [ ] **Step 1: Add imports to navbar**

In `navbar/index.js`, add these to the existing MUI import block:

```javascript
import Badge from '@mui/material/Badge';
```

Add to the existing `@mui/icons-material` import block (leave existing icons):
```javascript
// already imported: NotificationsOutlined as BellIcon
// no new icon imports needed
```

Add the NotificationPanel import after the existing local imports:
```javascript
import NotificationPanel from '../components/notifications/NotificationPanel';
```

Add to the existing `cinemaApi` import line:
```javascript
import { fetchPageCategories, fetchUnreadCount } from '../api/cinemaApi';
```

- [ ] **Step 2: Add bell state inside the CinemaNavbar component**

Find the block of `useState` declarations near the top of `CinemaNavbar` and add:

```javascript
const [unreadCount,   setUnreadCount]   = useState(0);
const [bellAnchorEl, setBellAnchorEl]   = useState(null);
```

Add this `useEffect` after the existing effects (e.g. after the categories fetch effect):

```javascript
useEffect(() => {
  fetchUnreadCount()
    .then(count => setUnreadCount(Number(count) || 0))
    .catch(() => {});
}, []);
```

Add the handler functions (place near the other handler functions like `handleNavSelect`):

```javascript
const handleBellClick = (e) => {
  setBellAnchorEl(e.currentTarget);
};

const handleBellClose = () => {
  setBellAnchorEl(null);
};

const handleUnreadClear = useCallback(() => {
  setUnreadCount(0);
}, []);
```

- [ ] **Step 3: Move the bell outside the `{isMobile && ...}` block and add badge**

Find the RIGHT side block:

```javascript
{/* RIGHT */}
<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
  {isMobile && (
    <>
      {/* Bell */}
      {iconBtn(undefined, <BellIcon sx={{ fontSize: '1.3rem' }} />)}

      {/* Category / filter icon */}
      {iconBtn(
        () => setCategoryModalOpen(true),
        <TuneIcon sx={{ fontSize: '1.3rem' }} />,
        selectedCategory ? { color: theme.palette.primary.main } : {},
      )}
    </>
  )}

  {/* Desktop: search icon stays in top bar */}
  {!isMobile && (
    iconBtn(() => setSearchActive(true), <SearchIcon sx={{ fontSize: '1.35rem' }} />)
  )}
</Box>
```

Replace it with:

```javascript
{/* RIGHT */}
<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
  {/* Bell — shown on all screen sizes */}
  {iconBtn(handleBellClick, (
    <Badge
      badgeContent={unreadCount > 0 ? unreadCount : null}
      color="error"
      max={99}
      sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16, p: '0 4px' } }}
    >
      <BellIcon sx={{ fontSize: '1.3rem' }} />
    </Badge>
  ))}

  {/* Category filter — mobile only */}
  {isMobile && iconBtn(
    () => setCategoryModalOpen(true),
    <TuneIcon sx={{ fontSize: '1.3rem' }} />,
    selectedCategory ? { color: theme.palette.primary.main } : {},
  )}

  {/* Search — desktop only */}
  {!isMobile && (
    iconBtn(() => setSearchActive(true), <SearchIcon sx={{ fontSize: '1.35rem' }} />)
  )}
</Box>
```

- [ ] **Step 4: Mount the NotificationPanel in the navbar JSX**

Find where `<CategoryModal .../>` is rendered (near the bottom of the navbar return). Add the panel right after `</CategoryModal>`:

```jsx
<NotificationPanel
  anchorEl={bellAnchorEl}
  onClose={handleBellClose}
  onUnreadClear={handleUnreadClear}
/>
```

- [ ] **Step 5: Verify in the browser**

Start the frontend dev server:
```bash
cd db-world-frontend
npm start
```

Checklist:
- [ ] Bell icon visible on mobile (top-right) ✓
- [ ] Bell icon visible on desktop (top-right, next to search) ✓
- [ ] Badge appears with red dot when unread count > 0 ✓
- [ ] Badge disappears after clicking bell (panel opens → marks read) ✓
- [ ] On desktop: Popover opens below the bell, 360px wide ✓
- [ ] On mobile: bottom Drawer opens, 70vh height ✓
- [ ] Notification items show "username reviewed Title" with timestamp ✓
- [ ] Clicking a notification closes the panel and navigates to the record detail page ✓
- [ ] Empty state shows when no notifications exist ✓

- [ ] **Step 6: Commit**

```bash
git add db-world-frontend/src/features/cinema/navbar/index.js
git commit -m "feat: wire notification bell with badge, Popover/Drawer panel, desktop+mobile"
```

---

## Final Integration Commit

```bash
git add -A
git commit -m "feat: review notifications — full stack (entity, service, controller, frontend bell+panel)"
git push origin dev_acc
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Review submission triggers notifications for other users
- ✅ Notifications stored in DB (`USER_NOTIFICATIONS` table via JPA)
- ✅ Not real-time — badge loaded once on navbar mount via `fetchUnreadCount`
- ✅ Bell icon responsive — now visible on both mobile and desktop
- ✅ Unread badge count displayed
- ✅ Panel opens on bell click: Popover (desktop) / bottom Drawer (mobile)
- ✅ Mark-all-read fires automatically when panel opens
- ✅ Each notification links to the reviewed record's detail page
- ✅ Deduplication: review edits don't create duplicate notifications
- ✅ Any logged-in user triggers/receives notifications (no role restriction)

**Potential gotcha — RecordType enum name:** `UserNotificationServiceImpl` calls `record.getType().name()` which returns the Java enum constant name (e.g. `MOVIE`, `TV_SERIES`). Verify these match what the frontend's `getRecordRoute` helper checks. If `RecordType` has a different constant name (e.g. `SERIES` instead of `TV_SERIES`), update the `isSeries` check in `NotificationPanel.jsx`.
