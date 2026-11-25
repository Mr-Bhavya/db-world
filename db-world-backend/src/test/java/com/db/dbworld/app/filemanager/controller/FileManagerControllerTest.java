package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.filemanager.download.DownloadService;
import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.dto.request.FileOperationRequest;
import com.db.dbworld.app.filemanager.dto.request.MkdirRequest;
import com.db.dbworld.app.filemanager.dto.request.RenameRequest;
import com.db.dbworld.app.filemanager.service.FileOperationsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.nio.file.NoSuchFileException;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FileManagerControllerTest {

    FileOperationsService service;
    DownloadService downloadService;
    FileManagerController controller;

    @BeforeEach
    void setUp() {
        service = mock(FileOperationsService.class);
        downloadService = mock(DownloadService.class);
        controller = new FileManagerController(service, downloadService);
    }

    @Test
    void list_delegatesWithLocationId() throws Exception {
        FileListDto dto = FileListDto.builder().currentPath("/").items(List.of()).build();
        when(service.list("l-1", "/docs", "name", "asc")).thenReturn(dto);

        ApiResponse<FileListDto> response = controller.list("l-1", "/docs", "name", "asc");

        verify(service).list("l-1", "/docs", "name", "asc");
        assertThat(response.getData()).isSameAs(dto);
    }

    @Test
    void search_delegatesWithLocationId() throws Exception {
        FileItemDto item = FileItemDto.builder().name("a.txt").build();
        when(service.search("l-1", "/", "a", true, 500)).thenReturn(List.of(item));

        ApiResponse<List<FileItemDto>> response = controller.search("l-1", "a", "/", true, 500);

        verify(service).search("l-1", "/", "a", true, 500);
        assertThat(response.getData()).containsExactly(item);
    }

    @Test
    void info_delegatesWithLocationId() throws Exception {
        FileItemDto item = FileItemDto.builder().name("a.txt").build();
        when(service.info("l-1", "/a.txt")).thenReturn(item);

        ApiResponse<FileItemDto> response = controller.info("l-1", "/a.txt");

        verify(service).info("l-1", "/a.txt");
        assertThat(response.getData()).isSameAs(item);
    }

    @Test
    void mkdir_delegatesWithLocationId() throws Exception {
        MkdirRequest req = new MkdirRequest();
        req.setLocationId("l-1");
        req.setPath("/");
        req.setName("docs");
        FileItemDto item = FileItemDto.builder().name("docs").build();
        when(service.mkdir("l-1", "/", "docs")).thenReturn(item);

        ApiResponse<FileItemDto> response = controller.mkdir(req);

        verify(service).mkdir("l-1", "/", "docs");
        assertThat(response.getData()).isSameAs(item);
    }

    @Test
    void rename_delegatesWithLocationId() throws Exception {
        RenameRequest req = new RenameRequest();
        req.setLocationId("l-1");
        req.setPath("/old");
        req.setNewName("newname");
        FileItemDto item = FileItemDto.builder().name("newname").build();
        when(service.renameItem("l-1", "/old", "newname")).thenReturn(item);

        ApiResponse<FileItemDto> response = controller.rename(req);

        verify(service).renameItem("l-1", "/old", "newname");
        assertThat(response.getData()).isSameAs(item);
    }

    @Test
    void move_delegatesWithLocationId() throws Exception {
        FileOperationRequest req = new FileOperationRequest();
        req.setLocationId("l-1");
        req.setSourcePath("/a.txt");
        req.setDestinationPath("/dest");
        FileItemDto item = FileItemDto.builder().name("a.txt").build();
        when(service.moveItem("l-1", "/a.txt", "/dest")).thenReturn(item);

        ApiResponse<FileItemDto> response = controller.move(req);

        verify(service).moveItem("l-1", "/a.txt", "/dest");
        assertThat(response.getData()).isSameAs(item);
    }

    @Test
    void copy_delegatesWithLocationId() throws Exception {
        FileOperationRequest req = new FileOperationRequest();
        req.setLocationId("l-1");
        req.setSourcePath("/a.txt");
        req.setDestinationPath("/dest");
        FileItemDto item = FileItemDto.builder().name("a.txt").build();
        when(service.copyItem("l-1", "/a.txt", "/dest")).thenReturn(item);

        ApiResponse<FileItemDto> response = controller.copy(req);

        verify(service).copyItem("l-1", "/a.txt", "/dest");
        assertThat(response.getData()).isSameAs(item);
    }

    @Test
    void delete_delegatesWithLocationId() throws Exception {
        ApiResponse<Void> response = controller.delete("l-1", "/a.txt");

        verify(service).delete("l-1", "/a.txt");
        assertThat(response.isSuccess()).isTrue();
    }

    @Test
    void ioFailureReturnsErrorRatherThanSuccess() throws Exception {
        doThrow(new IOException("disk error")).when(service).delete("l-1", "/a.txt");
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();

        mvc.perform(delete("/api/admin/file-manager/delete").param("locationId", "l-1").param("path", "/a.txt"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void missingFileStillReturnsNotFound() throws Exception {
        doThrow(new NoSuchFileException("/a.txt")).when(service).delete("l-1", "/a.txt");
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();

        mvc.perform(delete("/api/admin/file-manager/delete").param("locationId", "l-1").param("path", "/a.txt"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void issueDownloadTicket_delegatesAndReturnsTicketId() throws Exception {
        when(downloadService.issueTicket("l-1", "/a.txt")).thenReturn("ticket-123");

        ApiResponse<Map<String, String>> response = controller.issueDownloadTicket("l-1", "/a.txt");

        verify(downloadService).issueTicket("l-1", "/a.txt");
        assertThat(response.getData()).containsEntry("ticketId", "ticket-123");
    }
}
