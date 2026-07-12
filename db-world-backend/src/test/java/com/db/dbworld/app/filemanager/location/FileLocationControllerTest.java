package com.db.dbworld.app.filemanager.location;

import com.db.dbworld.app.filemanager.location.dto.FileLocationDto;
import com.db.dbworld.app.filemanager.location.dto.UpsertLocationRequest;
import com.db.dbworld.payloads.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class FileLocationControllerTest {

    FileLocationService service;
    FileLocationController controller;

    @BeforeEach
    void setUp() {
        service = mock(FileLocationService.class);
        controller = new FileLocationController(service);
    }

    private FileLocationEntity entity(String id) {
        return FileLocationEntity.builder()
                .id(id).label("Data").absolutePath(System.getProperty("java.io.tmpdir"))
                .enabled(true).sortOrder(0).createdAt(Instant.now()).updatedAt(Instant.now())
                .build();
    }

    @Test
    void list_returnsAllLocationsMapped() {
        when(service.listAll()).thenReturn(List.of(entity("l-1"), entity("l-2")));

        ApiResponse<List<FileLocationDto>> response = controller.list();

        verify(service).listAll();
        assertThat(response.getData()).hasSize(2);
        assertThat(response.getData().get(0).getId()).isEqualTo("l-1");
    }

    @Test
    void create_delegatesToServiceAndReturnsDto() {
        UpsertLocationRequest req = new UpsertLocationRequest("Data", System.getProperty("java.io.tmpdir"), true, 0);
        when(service.create(req)).thenReturn(entity("l-1"));

        ApiResponse<FileLocationDto> response = controller.create(req);

        verify(service).create(req);
        assertThat(response.getData().getId()).isEqualTo("l-1");
    }

    @Test
    void update_delegatesWithIdAndBody() {
        UpsertLocationRequest req = new UpsertLocationRequest("Renamed", System.getProperty("java.io.tmpdir"), true, 1);
        when(service.update(eq("l-1"), any())).thenReturn(entity("l-1"));

        ApiResponse<FileLocationDto> response = controller.update("l-1", req);

        verify(service).update("l-1", req);
        assertThat(response.getData().getId()).isEqualTo("l-1");
    }

    @Test
    void delete_delegatesWithId() {
        ApiResponse<Void> response = controller.delete("l-1");

        verify(service).delete("l-1");
        assertThat(response.isSuccess()).isTrue();
    }
}
