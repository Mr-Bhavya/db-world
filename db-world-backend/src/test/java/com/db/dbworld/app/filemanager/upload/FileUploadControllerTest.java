package com.db.dbworld.app.filemanager.upload;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.upload.dto.InitUploadRequest;
import com.db.dbworld.app.filemanager.upload.dto.UploadSessionDto;
import com.db.dbworld.payloads.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class FileUploadControllerTest {

    UploadSessionService service;
    FileUploadController controller;

    @BeforeEach
    void setUp() {
        service = mock(UploadSessionService.class);
        controller = new FileUploadController(service);
    }

    private UploadSessionDto dto(String id) {
        return UploadSessionDto.builder().uploadId(id).totalSize(10).chunkSize(4)
                .receivedBytes(4).nextIndex(1).status("PENDING").build();
    }

    @Test
    void init_delegatesToService() throws Exception {
        InitUploadRequest req = new InitUploadRequest("l", "/", "a.bin", 10, null, null, null);
        when(service.init(req)).thenReturn(dto("u-1"));

        ApiResponse<UploadSessionDto> response = controller.init(req);

        verify(service).init(req);
        assertThat(response.getData().getUploadId()).isEqualTo("u-1");
    }

    @Test
    void chunk_appendsThenReturnsStatus() throws Exception {
        byte[] data = new byte[]{1, 2, 3, 4};
        when(service.status("u-1")).thenReturn(dto("u-1"));

        ApiResponse<UploadSessionDto> response = controller.chunk("u-1", 0, data);

        verify(service).appendChunk("u-1", 0, data);
        assertThat(response.getData().getUploadId()).isEqualTo("u-1");
    }

    @Test
    void status_delegatesToService() {
        when(service.status("u-1")).thenReturn(dto("u-1"));

        ApiResponse<UploadSessionDto> response = controller.status("u-1");

        verify(service).status("u-1");
        assertThat(response.getData().getNextIndex()).isEqualTo(1);
    }

    @Test
    void complete_delegatesToService() throws Exception {
        FileItemDto item = FileItemDto.builder().name("a.bin").path("/a.bin").build();
        when(service.complete("u-1")).thenReturn(item);

        ApiResponse<FileItemDto> response = controller.complete("u-1");

        verify(service).complete("u-1");
        assertThat(response.getData().getName()).isEqualTo("a.bin");
    }

    @Test
    void abort_delegatesToService() throws Exception {
        ApiResponse<Void> response = controller.abort("u-1");

        verify(service).abort("u-1");
        assertThat(response.isSuccess()).isTrue();
    }
}
