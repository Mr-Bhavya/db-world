package com.db.dbworld.app.filemanager.location;

import com.db.dbworld.app.filemanager.location.dto.UpsertLocationRequest;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.*;
import java.nio.file.*; import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FileLocationServiceTest {
    FileLocationRepository repo; AppProperties props; FileLocationService svc;
    Map<String, FileLocationEntity> store; Path realDir;

    @BeforeEach void setUp() throws Exception {
        repo = mock(FileLocationRepository.class); props = mock(AppProperties.class);
        realDir = Files.createTempDirectory("loc");
        store = new HashMap<>();
        when(repo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(repo.existsByAbsolutePath(any())).thenAnswer(a ->
            store.values().stream().anyMatch(l -> l.getAbsolutePath().equals(a.getArgument(0))));
        when(repo.save(any(FileLocationEntity.class))).thenAnswer(a -> {
            FileLocationEntity e = a.getArgument(0);
            if (e.getId() == null) e.setId("l-" + (store.size() + 1));
            store.put(e.getId(), e); return e;
        });
        svc = new FileLocationService(repo, props);
    }

    @Test void create_rejectsNonExistentPath() {
        assertThatThrownBy(() -> svc.create(new UpsertLocationRequest("Bad", "/no/such/dir", true, 0)))
            .isInstanceOf(DbWorldException.class);
    }
    @Test void create_acceptsRealDir_andResolvesBase() {
        FileLocationEntity e = svc.create(new UpsertLocationRequest("Data", realDir.toString(), true, 0));
        assertThat(svc.resolveBase(e.getId())).isEqualTo(realDir.toAbsolutePath().normalize());
    }
    @Test void resolveBase_missing_throwsNotFound() {
        assertThatThrownBy(() -> svc.resolveBase("nope")).isInstanceOf(DbWorldException.class);
    }
    @Test void create_rejectsDuplicateAbsolutePath() {
        svc.create(new UpsertLocationRequest("Data", realDir.toString(), true, 0));
        assertThatThrownBy(() -> svc.create(new UpsertLocationRequest("Data2", realDir.toString(), true, 1)))
            .isInstanceOf(DbWorldException.class);
    }
    @Test void resolveBase_disabledLocation_throwsNotFound() {
        FileLocationEntity disabled = svc.create(new UpsertLocationRequest("Disabled", realDir.toString(), false, 0));
        assertThatThrownBy(() -> svc.resolveBase(disabled.getId())).isInstanceOf(DbWorldException.class);
    }
}
