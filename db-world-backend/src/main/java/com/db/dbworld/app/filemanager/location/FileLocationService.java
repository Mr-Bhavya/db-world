package com.db.dbworld.app.filemanager.location;

import com.db.dbworld.app.filemanager.location.dto.UpsertLocationRequest;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Log4j2
@Service
@RequiredArgsConstructor
public class FileLocationService {

    private final FileLocationRepository repo;
    private final AppProperties props;

    /** Idempotent seed — seeds the configured data path as location #0 only if none exist. */
    @PostConstruct
    void seedDefault() {
        try {
            if (repo.count() == 0) {
                FileLocationEntity e = FileLocationEntity.builder()
                        .label("Data")
                        .absolutePath(props.getDataPath().toString())
                        .enabled(true)
                        .sortOrder(0)
                        .build();
                repo.save(e);
                log.info("Seeded default file manager location at {}", e.getAbsolutePath());
            }
        } catch (Exception ex) {
            log.warn("File manager location seeding skipped: {}", ex.getMessage());
        }
    }

    public List<FileLocationEntity> listAll()     { return repo.findAllByOrderBySortOrderAsc(); }
    public List<FileLocationEntity> listEnabled() { return repo.findByEnabledTrueOrderBySortOrderAsc(); }

    public FileLocationEntity get(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Location not found"));
    }

    /** Resolves the normalized, absolute base path for an enabled location. */
    public Path resolveBase(String id) {
        FileLocationEntity e = get(id);
        if (!e.isEnabled()) {
            throw new DbWorldException(HttpStatus.NOT_FOUND, "Location is disabled: " + e.getLabel());
        }
        return Path.of(e.getAbsolutePath()).toAbsolutePath().normalize();
    }

    public FileLocationEntity create(UpsertLocationRequest req) {
        Path p = validateDirectory(req.absolutePath());
        String normalized = p.toString();
        if (repo.existsByAbsolutePath(normalized)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A location with this path already exists: " + normalized);
        }
        FileLocationEntity e = FileLocationEntity.builder()
                .label(req.label().trim())
                .absolutePath(normalized)
                .enabled(req.enabled() == null || req.enabled())
                .sortOrder(req.sortOrder() == null ? 0 : req.sortOrder())
                .build();
        return repo.save(e);
    }

    public FileLocationEntity update(String id, UpsertLocationRequest req) {
        FileLocationEntity e = get(id);
        Path p = validateDirectory(req.absolutePath());
        String normalized = p.toString();
        if (!normalized.equals(e.getAbsolutePath()) && repo.existsByAbsolutePath(normalized)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A location with this path already exists: " + normalized);
        }
        e.setLabel(req.label().trim());
        e.setAbsolutePath(normalized);
        if (req.enabled() != null)   e.setEnabled(req.enabled());
        if (req.sortOrder() != null) e.setSortOrder(req.sortOrder());
        return repo.save(e);
    }

    public void delete(String id) {
        FileLocationEntity e = get(id);
        repo.delete(e);
    }

    private Path validateDirectory(String rawPath) {
        Path p = Path.of(rawPath).toAbsolutePath().normalize();
        if (!Files.isDirectory(p) || !Files.isReadable(p)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Path is not a readable directory: " + p);
        }
        return p;
    }
}
