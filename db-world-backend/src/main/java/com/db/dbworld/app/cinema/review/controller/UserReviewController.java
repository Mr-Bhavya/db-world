package com.db.dbworld.app.cinema.review.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.app.cinema.review.dto.UserReviewDto;
import com.db.dbworld.app.cinema.review.dto.UserReviewRequest;
import com.db.dbworld.app.cinema.review.service.UserReviewService;
import com.db.dbworld.core.context.UserContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/reviews")
@RequiredArgsConstructor
public class UserReviewController {

    private final UserReviewService       reviewService;
    private final UserContext             userContext;
    private final UserNotificationService notifService;

    /* =========================
       SUBMIT / UPDATE
       POST /api/cinema/reviews?recordId=
       ========================= */

    @PostMapping
    public ApiResponse<UserReviewDto> upsert(
            @RequestParam Long recordId,
            @Valid @RequestBody UserReviewRequest body
    ) {
        Long   userId   = userContext.userId();
        String username = userContext.email();          // email as display name
        UserReviewDto result = reviewService.upsert(userId, username, recordId, body);
        notifService.createReviewNotifications(userId, username, recordId);
        return ApiResponse.success(result);
    }

    /* =========================
       DELETE OWN REVIEW
       DELETE /api/cinema/reviews?recordId=
       ========================= */

    @DeleteMapping
    public ApiResponse<Void> delete(@RequestParam Long recordId) {
        reviewService.delete(userContext.userId(), recordId);
        return ApiResponse.success("Review deleted");
    }

    /* =========================
       ALL REVIEWS FOR A RECORD
       GET /api/cinema/reviews/record/{recordId}  (public)
       ========================= */

    @GetMapping("/record/{recordId}")
    public ApiResponse<List<UserReviewDto>> getByRecord(@PathVariable Long recordId) {
        // Best-effort: attach ownReview flag if authenticated, null callerId otherwise
        Long callerId = tryGetUserId();
        return ApiResponse.success(reviewService.getByRecord(recordId, callerId));
    }

    /* =========================
       MY REVIEW
       GET /api/cinema/reviews/mine?recordId=
       ========================= */

    @GetMapping("/mine")
    public ApiResponse<UserReviewDto> getMine(@RequestParam Long recordId) {
        return ApiResponse.success(
                reviewService.getMine(userContext.userId(), recordId).orElse(null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Long tryGetUserId() {
        try { return userContext.userId(); } catch (Exception e) { return null; }
    }
}
