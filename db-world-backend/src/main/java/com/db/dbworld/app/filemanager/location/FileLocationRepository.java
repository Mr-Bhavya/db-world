package com.db.dbworld.app.filemanager.location;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FileLocationRepository extends JpaRepository<FileLocationEntity, String> {
    List<FileLocationEntity> findByEnabledTrueOrderBySortOrderAsc();
    List<FileLocationEntity> findAllByOrderBySortOrderAsc();
    boolean existsByAbsolutePath(String absolutePath);
}
