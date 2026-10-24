package com.db.dbworld.app.media.ingestion.processing.fs;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class TempDirPrunerTest {

    @TempDir
    Path sandbox;

    /** The app's temp root lives inside the sandbox so the tests can also place folders outside it. */
    Path tempRoot;

    @BeforeEach
    void setUp() throws Exception {
        tempRoot = Files.createDirectories(sandbox.resolve("temp"));
    }

    /** Production gathered 109 of these: a finished job's folder with its files already deleted. */
    @Test
    void emptyJobFolder_isRemoved() throws Exception {
        Path job = Files.createDirectories(tempRoot.resolve("42-Inception"));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, job);

        assertThat(removed).isEqualTo(1);
        assertThat(job).doesNotExist();
        assertThat(tempRoot).isDirectory();
    }

    @Test
    void nonEmptyJobFolder_isKept() throws Exception {
        Path job = Files.createDirectories(tempRoot.resolve("42-Inception"));
        Path file = Files.writeString(job.resolve("S01E02.mkv"), "still downloading");

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, job);

        assertThat(removed).isZero();
        assertThat(file).hasContent("still downloading");
    }

    @Test
    void emptyParents_areRemovedUpToTheRoot() throws Exception {
        Path leaf = Files.createDirectories(tempRoot.resolve("42-Inception").resolve("pack").resolve("extras"));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, leaf);

        assertThat(removed).isEqualTo(3);
        assertThat(tempRoot.resolve("42-Inception")).doesNotExist();
        assertThat(tempRoot).isDirectory();
    }

    @Test
    void climbing_stopsAtTheFirstParentThatIsNotEmpty() throws Exception {
        Path job = Files.createDirectories(tempRoot.resolve("42-Inception"));
        Path sibling = Files.writeString(job.resolve("other-episode.mkv"), "x");
        Path extracted = Files.createDirectories(job.resolve("extracted"));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, extracted);

        assertThat(removed).isEqualTo(1);
        assertThat(extracted).doesNotExist();
        assertThat(sibling).exists();
    }

    /** A folder that is already gone does not stop its empty parent from being removed. */
    @Test
    void missingFolder_stillPrunesItsEmptyParent() throws Exception {
        Path job = Files.createDirectories(tempRoot.resolve("42-Inception"));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, job.resolve("already-deleted"));

        assertThat(removed).isEqualTo(1);
        assertThat(job).doesNotExist();
    }

    /** Folders other features own: pending files, upload sessions and the thumbnail cache. */
    @ParameterizedTest
    @ValueSource(strings = {"unassigned", "uploads", "fm-thumbs", "Unassigned"})
    void reservedFolder_isKeptEvenWhenEmpty(String name) throws Exception {
        Path reserved = Files.createDirectories(tempRoot.resolve(name));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, reserved);

        assertThat(removed).isZero();
        assertThat(reserved).isDirectory();
    }

    @ParameterizedTest
    @ValueSource(strings = {"unassigned", "uploads", "fm-thumbs"})
    void nothingInsideAReservedFolder_isTouched(String name) throws Exception {
        Path nested = Files.createDirectories(tempRoot.resolve(name).resolve("in-use"));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, nested);

        assertThat(removed).isZero();
        assertThat(nested).isDirectory();
    }

    @Test
    void tempRoot_isNeverRemoved() {
        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, tempRoot);

        assertThat(removed).isZero();
        assertThat(tempRoot).isDirectory();
    }

    @Test
    void folderOutsideTheRoot_isUntouched() throws Exception {
        Path outside = Files.createDirectories(sandbox.resolve("elsewhere").resolve("empty"));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, outside);

        assertThat(removed).isZero();
        assertThat(outside).isDirectory();
    }

    /** A folder name with ".." must not walk out of the temp root once normalised. */
    @Test
    void dotDotEscapeFromTheRoot_isUntouched() throws Exception {
        Path outside = Files.createDirectories(sandbox.resolve("elsewhere"));

        int removed = TempDirPruner.pruneEmptyDirs(tempRoot, tempRoot.resolve("..").resolve("elsewhere"));

        assertThat(removed).isZero();
        assertThat(outside).isDirectory();
        assertThat(tempRoot).isDirectory();
    }

    @Test
    void nullArguments_doNothing() {
        assertThat(TempDirPruner.pruneEmptyDirs(null, tempRoot)).isZero();
        assertThat(TempDirPruner.pruneEmptyDirs(tempRoot, null)).isZero();
        assertThat(tempRoot).isDirectory();
    }
}
