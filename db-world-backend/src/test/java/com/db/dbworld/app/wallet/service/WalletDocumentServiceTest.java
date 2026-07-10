package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.wallet.dto.UpdateDocumentRequest;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class WalletDocumentServiceTest {

    WalletDocumentRepository docRepo;
    WalletShareRepository shareRepo;
    WalletTypeService typeService;
    WalletStorageService storage;
    SettingsService settings;
    WalletDocumentService service;

    WalletDocumentTypeEntity activeType;

    @BeforeEach
    void setUp() {
        docRepo = mock(WalletDocumentRepository.class);
        shareRepo = mock(WalletShareRepository.class);
        typeService = mock(WalletTypeService.class);
        storage = mock(WalletStorageService.class);
        settings = mock(SettingsService.class);
        service = new WalletDocumentService(docRepo, shareRepo, typeService, storage, settings, new WalletMapper());

        activeType = WalletDocumentTypeEntity.builder().id("t1").code("PAN").displayName("PAN Card").active(true).build();
        when(typeService.get("t1")).thenReturn(activeType);
        when(settings.getLong(anyString())).thenReturn(10_485_760L);
        when(settings.getString(anyString())).thenReturn("application/pdf,image/png,image/jpeg");
    }

    private MockMultipartFile pdf(byte[] body) {
        return new MockMultipartFile("file", "scan.pdf", "application/pdf", body);
    }

    @Test
    void create_rejectsOversizedFile() {
        when(settings.getLong(anyString())).thenReturn(3L); // 3-byte cap
        byte[] body = "%PDF-1.4 hello".getBytes();
        assertThatThrownBy(() -> service.create(1L, pdf(body), "t1", null, null, null, null, null))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void create_rejectsDisallowedContentType() {
        MockMultipartFile exe = new MockMultipartFile("file", "x.exe", "application/x-msdownload", "MZ...".getBytes());
        assertThatThrownBy(() -> service.create(1L, exe, "t1", null, null, null, null, null))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void create_rejectsMagicByteMismatch() {
        byte[] notReallyPdf = "GIF89a".getBytes();
        assertThatThrownBy(() -> service.create(1L, pdf(notReallyPdf), "t1", null, null, null, null, null))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void get_whenNotOwner_throwsNotFound() {
        when(docRepo.findByIdAndUserId("d1", 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(99L, "d1")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void delete_removesShares_blob_andRow() {
        WalletDocumentEntity e = new WalletDocumentEntity();
        e.setId("d1"); e.setUserId(5L); e.setStoredFileName("d1.enc");
        when(docRepo.findByIdAndUserId("d1", 5L)).thenReturn(Optional.of(e));

        service.delete(5L, "d1");

        verify(shareRepo).deleteByDocumentId("d1");
        verify(storage).delete(5L, "d1.enc");
        verify(docRepo).delete(e);
    }

    @Test
    void update_whenNotOwner_throwsNotFound() {
        when(docRepo.findByIdAndUserId("d1", 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.update(99L, "d1", new UpdateDocumentRequest("x", null, null, null, null)))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void loadContent_whenNotOwner_throwsNotFound() {
        when(docRepo.findByIdAndUserId("d1", 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.loadContent(99L, "d1")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void create_happyPath_storesBlobAndReturnsDto() {
        when(docRepo.save(any())).thenAnswer(a -> {
            var e = a.getArgument(0, WalletDocumentEntity.class);
            e.setId("new-id");
            return e;
        });

        var dto = service.create(1L, pdf("%PDF-1.4 hello".getBytes()), "t1", null, null, null, null, null);

        assertThat(dto.typeCode()).isEqualTo(activeType.getCode());
        assertThat(dto.typeDisplayName()).isEqualTo(activeType.getDisplayName());
        verify(storage).store(eq(1L), anyString(), any(byte[].class));
    }
}
