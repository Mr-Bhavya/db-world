package com.db.dbworld.app.filemanager.service;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.nio.file.Files;
import java.nio.file.FileSystemException;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
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
        svc = new FileOperationsService(locationService, MediaDiskGuards.off());
    }

    private static List<String> names(FileListDto d) {
        return d.getItems().stream().map(FileItemDto::getName).toList();
    }

    private static void createLinkOrSkip(Path link, Path target) throws Exception {
        try {
            Files.createSymbolicLink(link, target);
        } catch (FileSystemException | UnsupportedOperationException | SecurityException e) {
            assumeTrue(false, "Symbolic links unavailable: " + e.getMessage());
        }
    }

    // ── Media-disk guard ─────────────────────────────────────────────────────

    /** Location "l" is the media tree, and its disk's marker is missing. */
    private FileOperationsService svcWithMediaDiskMissing() throws Exception {
        Path missingMarker = Files.createTempDirectory("fm-disk").resolve(".dbworld-media-disk");
        return new FileOperationsService(locationService, MediaDiskGuards.withMarker(missingMarker, base));
    }

    @Test
    void diskMissing_everyWriteInTheMediaTreeIsRefused_andNothingChanges() throws Exception {
        Files.createDirectories(base.resolve("dir"));
        Files.writeString(base.resolve("a.txt"), "x");
        FileOperationsService guarded = svcWithMediaDiskMissing();

        assertThatThrownBy(() -> guarded.mkdir("l", "/", "docs")).hasMessageContaining("not mounted");
        assertThatThrownBy(() -> guarded.renameItem("l", "/a.txt", "b.txt")).hasMessageContaining("not mounted");
        assertThatThrownBy(() -> guarded.moveItem("l", "/a.txt", "/dir")).hasMessageContaining("not mounted");
        assertThatThrownBy(() -> guarded.copyItem("l", "/a.txt", "/dir")).hasMessageContaining("not mounted");
        assertThatThrownBy(() -> guarded.delete("l", "/a.txt"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Deleting was not started");

        assertThat(base.resolve("docs")).doesNotExist();
        assertThat(base.resolve("a.txt")).exists();
        assertThat(base.resolve("b.txt")).doesNotExist();
        assertThat(base.resolve("dir/a.txt")).doesNotExist();
    }

    @Test
    void diskMissing_readsStillWork() throws Exception {
        Files.writeString(base.resolve("a.txt"), "x");

        assertThat(names(svcWithMediaDiskMissing().list("l", "/", "name", "asc"))).contains("a.txt");
    }

    @Test
    void diskMissing_aLocationOutsideTheMediaTreeKeepsWorking() throws Exception {
        Path internal = Files.createTempDirectory("fm-internal");
        when(locationService.resolveBase("internal")).thenReturn(internal);

        svcWithMediaDiskMissing().mkdir("internal", "/", "docs");

        assertThat(internal.resolve("docs")).isDirectory();
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
    void copyingFolderDoesNotOverwriteExistingDestination() throws Exception {
        Files.createDirectories(base.resolve("source"));
        Files.createDirectories(base.resolve("dest/source"));
        Files.writeString(base.resolve("source/file.txt"), "new");
        Files.writeString(base.resolve("dest/source/file.txt"), "original");

        assertThatThrownBy(() -> svc.copyItem("l", "/source", "/dest"))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(Files.readString(base.resolve("dest/source/file.txt"))).isEqualTo("original");
    }

    @Test
    void copyingFolderIntoDescendantIsRejected() throws Exception {
        Files.createDirectories(base.resolve("source/nested"));

        assertThatThrownBy(() -> svc.copyItem("l", "/source", "/source"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("itself or its descendants");
        assertThatThrownBy(() -> svc.copyItem("l", "/source", "/source/nested"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("itself or its descendants");
        assertThat(base.resolve("source/nested/source")).doesNotExist();
    }

    @Test
    void copyingFolderToNewDestinationPreservesItsContents() throws Exception {
        Files.createDirectories(base.resolve("source/nested"));
        Files.createDirectory(base.resolve("dest"));
        Files.writeString(base.resolve("source/nested/file.txt"), "content");

        svc.copyItem("l", "/source", "/dest");

        assertThat(Files.readString(base.resolve("dest/source/nested/file.txt"))).isEqualTo("content");
    }

    @Test
    void copyingFolderWithLinkToDestinationStopsWithoutRecursing() throws Exception {
        Files.createDirectory(base.resolve("source"));
        Files.createDirectory(base.resolve("dest"));
        createLinkOrSkip(base.resolve("source/link"), base.resolve("dest"));

        assertThatThrownBy(() -> svc.copyItem("l", "/source", "/dest"))
                .hasMessageContaining("incomplete destination may remain")
                .hasRootCauseMessage("Copy source links to the destination: " + base.resolve("dest"));
    }

    @Test
    void deletingLocationRootIsRejected() throws Exception {
        Files.writeString(base.resolve("keep.txt"), "content");

        assertThatThrownBy(() -> svc.delete("l", "/"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("location root");
        assertThat(base.resolve("keep.txt")).exists();
    }

    @Test
    void moveAndRenameDoNotOverwriteExistingFiles() throws Exception {
        Files.createDirectory(base.resolve("dest"));
        Files.writeString(base.resolve("file.txt"), "source");
        Files.writeString(base.resolve("other.txt"), "rename target");
        Files.writeString(base.resolve("dest/file.txt"), "move target");

        assertThatThrownBy(() -> svc.renameItem("l", "/file.txt", "other.txt"))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus()).isEqualTo(HttpStatus.CONFLICT));
        assertThatThrownBy(() -> svc.moveItem("l", "/file.txt", "/dest"))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(Files.readString(base.resolve("file.txt"))).isEqualTo("source");
        assertThat(Files.readString(base.resolve("other.txt"))).isEqualTo("rename target");
        assertThat(Files.readString(base.resolve("dest/file.txt"))).isEqualTo("move target");
    }

    @Test
    void delete_removes_nested_directory() throws Exception {
        Files.createDirectories(base.resolve("folder/nested"));
        Files.writeString(base.resolve("folder/nested/file.txt"), "content");

        svc.delete("l", "/folder");

        assertThat(base.resolve("folder")).doesNotExist();
    }

    @Test
    void mutationsThroughAnOutsideDirectoryLinkAreRejected() throws Exception {
        Path outside = Files.createTempDirectory("fm-outside");
        Files.writeString(outside.resolve("keep.txt"), "content");
        createLinkOrSkip(base.resolve("link"), outside);

        assertThatThrownBy(() -> svc.delete("l", "/link/keep.txt")).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> svc.renameItem("l", "/link/keep.txt", "changed.txt")).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> svc.moveItem("l", "/link/keep.txt", "/")).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> svc.mkdir("l", "/link", "new")).isInstanceOf(SecurityException.class);
        assertThat(Files.readString(outside.resolve("keep.txt"))).isEqualTo("content");
        assertThat(outside.resolve("new")).doesNotExist();
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
    void search_recursive_stopsAtLimit_andMatchesFolders() throws Exception {
        Files.createDirectories(base.resolve("target-dir"));
        for (int i = 0; i < 5; i++) Files.writeString(base.resolve("target-dir/target" + i + ".txt"), "x");

        List<FileItemDto> results = svc.search("l", "/", "target", true, 3);

        assertThat(results).hasSize(3);
        assertThat(svc.search("l", "/", "target", true, 50)).extracting(FileItemDto::getName).contains("target-dir");
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
