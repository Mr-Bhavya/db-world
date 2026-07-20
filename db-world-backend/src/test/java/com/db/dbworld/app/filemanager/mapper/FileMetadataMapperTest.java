package com.db.dbworld.app.filemanager.mapper;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import org.junit.jupiter.api.*;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

class FileMetadataMapperTest {
    static Path base, file;
    @BeforeAll static void setup() throws Exception {
        base = Files.createTempDirectory("fm");
        file = Files.writeString(base.resolve("note.txt"), "hello");
    }
    @Test void mapsFileMetadata() throws Exception {
        FileItemDto d = FileMetadataMapper.toDto("loc1", base, file, false);
        assertThat(d.getName()).isEqualTo("note.txt");
        assertThat(d.getPath()).isEqualTo("/note.txt");
        assertThat(d.isDirectory()).isFalse();
        assertThat(d.getExtension()).isEqualTo("txt");
        assertThat(d.getMimeType()).isEqualTo("text/plain");
        assertThat(d.getLocationId()).isEqualTo("loc1");
        assertThat(d.getSizeBytes()).isEqualTo(5);
    }
    @Test void formatsSizes() {
        assertThat(FileMetadataMapper.formatSize(512)).isEqualTo("512 B");
        assertThat(FileMetadataMapper.formatSize(2048)).isEqualTo("2.0 KB");
    }
}
