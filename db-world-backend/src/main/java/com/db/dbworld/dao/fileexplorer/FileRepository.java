package com.db.dbworld.dao.fileexplorer;

import com.db.dbworld.entities.fileexplorer.FileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FileRepository extends JpaRepository<FileEntity, UUID> {
    // Helper method to find an entity by its full path.
    FileEntity findByFilePath(String filePath);
    List<FileEntity> findByParentFolder(String parentFolder);
    List<FileEntity> findByFilePathStartingWith(String prefix);
}
