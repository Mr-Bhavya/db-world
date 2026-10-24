package com.db.dbworld.app.admin.service;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionRepository;
import com.db.dbworld.app.cinema.tmdb.sync.repository.TmdbRecordSyncRepository;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.infrastructure.storage.MediaDiskGuard;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The dashboard's media card says whether the media disk is there. */
class AdminDashboardServiceMediaDiskTest {

    @TempDir Path disk;

    private boolean reportedMounted(MediaDiskGuard guard) {
        RecordRepository records = mock(RecordRepository.class);
        when(records.findAll(any(Pageable.class))).thenReturn(Page.empty());
        AdminDashboardService service = new AdminDashboardService(mock(UserRepository.class), records,
                mock(TmdbRecordSyncRepository.class), mock(RecordTagRepository.class),
                mock(MediaFileRepository.class), mock(TagDefinitionRepository.class), guard);
        return service.getStats().getMedia().isMediaDiskMounted();
    }

    @Test
    void reportsTheMarker() throws Exception {
        Path marker = disk.resolve(".dbworld-media-disk");
        assertThat(reportedMounted(MediaDiskGuards.withMarker(marker))).isFalse();

        Files.createFile(marker);
        assertThat(reportedMounted(MediaDiskGuards.withMarker(marker))).isTrue();
    }

    @Test
    void guardOff_reportsMounted() {
        assertThat(reportedMounted(MediaDiskGuards.off())).isTrue();
    }
}
