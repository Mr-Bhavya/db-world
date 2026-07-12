package com.db.dbworld.app.filemanager.service;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FileOperationsServiceTest {

    FileLocationService locationService;
    FileOperationsService svc;
    Path base;

    @BeforeEach
    void setUp() throws Exception {
        base = Files.createTempDirectory("fm-ops");
        locationService = mock(FileLocationService.class);
        when(locationService.resolveBase("l")).thenReturn(base);
        svc = new FileOperationsService(locationService);
    }

    private static List<String> names(FileListDto d) {
        return d.getItems().stream().map(FileItemDto::getName).toList();
    }

    @Test
    void mkdir_then_list_shows_folder() throws Exception {
        svc.mkdir("l", "/", "docs");

        assertThat(names(svc.list("l", "/", "name", "asc"))).contains("docs");
    }

    @Test
    void list_setsLocationIdOnItems() throws Exception {
        svc.mkdir("l", "/", "docs");

        FileListDto listing = svc.list("l", "/", "name", "asc");

        assertThat(listing.getItems()).allSatisfy(i -> assertThat(i.getLocationId()).isEqualTo("l"));
    }

    @Test
    void rename_changes_name() throws Exception {
        svc.mkdir("l", "/", "old");

        FileItemDto renamed = svc.renameItem("l", "/old", "newname");

        assertThat(renamed.getName()).isEqualTo("newname");
        assertThat(names(svc.list("l", "/", "name", "asc"))).contains("newname").doesNotContain("old");
    }

    @Test
    void move_relocates_into_subdir() throws Exception {
        Files.writeString(base.resolve("a.txt"), "hi");
        svc.mkdir("l", "/", "dest");

        FileItemDto moved = svc.moveItem("l", "/a.txt", "/dest");

        assertThat(moved.getPath()).isEqualTo("/dest/a.txt");
        assertThat(Files.exists(base.resolve("a.txt"))).isFalse();
        assertThat(Files.exists(base.resolve("dest/a.txt"))).isTrue();
    }

    @Test
    void copy_duplicates_file() throws Exception {
        Files.writeString(base.resolve("a.txt"), "hi");
        svc.mkdir("l", "/", "dest");

        FileItemDto copied = svc.copyItem("l", "/a.txt", "/dest");

        assertThat(copied.getPath()).isEqualTo("/dest/a.txt");
        assertThat(Files.exists(base.resolve("a.txt"))).isTrue();
        assertThat(Files.exists(base.resolve("dest/a.txt"))).isTrue();
    }

    @Test
    void delete_removes_file() throws Exception {
        Files.writeString(base.resolve("a.txt"), "hi");

        svc.delete("l", "/a.txt");

        assertThat(Files.exists(base.resolve("a.txt"))).isFalse();
    }

    @Test
    void search_recursive_finds_nested() throws Exception {
        Files.createDirectories(base.resolve("sub"));
        Files.writeString(base.resolve("sub/target.txt"), "hi");

        List<FileItemDto> results = svc.search("l", "/", "target", true);

        assertThat(results).extracting(FileItemDto::getName).contains("target.txt");
    }

    @Test
    void search_nonRecursive_doesNotFindNested() throws Exception {
        Files.createDirectories(base.resolve("sub"));
        Files.writeString(base.resolve("sub/target.txt"), "hi");

        List<FileItemDto> results = svc.search("l", "/", "target", false);

        assertThat(results).isEmpty();
    }

    @Test
    void info_returnsMetadataForFile() throws Exception {
        Files.writeString(base.resolve("a.txt"), "hello");

        FileItemDto info = svc.info("l", "/a.txt");

        assertThat(info.getName()).isEqualTo("a.txt");
        assertThat(info.getSizeBytes()).isEqualTo(5);
        assertThat(info.getLocationId()).isEqualTo("l");
    }

    @Test
    void mkdir_duplicate_name_throwsConflict() throws Exception {
        svc.mkdir("l", "/", "docs");

        assertThatThrownBy(() -> svc.mkdir("l", "/", "docs"))
            .isInstanceOf(DbWorldException.class)
            .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void mkdir_rejects_slash_in_name() {
        assertThatThrownBy(() -> svc.mkdir("l", "/", "a/b")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void mkdir_rejects_traversal_in_name() {
        assertThatThrownBy(() -> svc.mkdir("l", "/", "..")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void rename_rejects_backslash_in_name() throws Exception {
        svc.mkdir("l", "/", "old");

        assertThatThrownBy(() -> svc.renameItem("l", "/old", "a\\b")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void list_bad_location_throwsNotFound() {
        when(locationService.resolveBase("x")).thenThrow(new DbWorldException(HttpStatus.NOT_FOUND, "x"));

        assertThatThrownBy(() -> svc.list("x", "/", "name", "asc")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void mkdir_bad_location_throwsNotFound() {
        when(locationService.resolveBase("x")).thenThrow(new DbWorldException(HttpStatus.NOT_FOUND, "x"));

        assertThatThrownBy(() -> svc.mkdir("x", "/", "docs")).isInstanceOf(DbWorldException.class);
    }
}
