package com.db.dbworld.app.media.storyboard;

import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import jakarta.persistence.PostRemove;

/**
 * JPA entity listener that removes a media file's scrub-preview storyboard sprite
 * whenever the row is deleted — regardless of which path triggered it (admin
 * file-manager delete, record cascade via {@code deleteAllByRecord_Id}, rescan,
 * or media sync). Every {@code MediaFileEntity} deletion goes through JPA entity
 * removal, so a single {@code @PostRemove} hook is the one reliable place to catch
 * them all (present and future).
 *
 * JPA instantiates entity listeners itself, so the {@link StoryboardService} bean
 * can't be injected here. It's supplied via a static holder that the service
 * populates at startup (see {@code StoryboardService.registerCleanupHook()}).
 * Deletion is best-effort; a null service (e.g. a delete during early startup)
 * simply skips cleanup.
 */
public class MediaFileStoryboardCleanupListener {

    private static volatile StoryboardService storyboardService;

    static void setStoryboardService(StoryboardService service) {
        storyboardService = service;
    }

    @PostRemove
    public void onPostRemove(MediaFileEntity entity) {
        StoryboardService svc = storyboardService;
        if (svc == null || entity == null || entity.getId() == null) return;
        svc.delete(entity.getId());
    }
}
