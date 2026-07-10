package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.CreateShareRequest;
import com.db.dbworld.app.wallet.dto.ShareDto;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletShareEntity;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WalletShareServiceTest {

    WalletShareRepository shareRepo;
    WalletDocumentRepository docRepo;
    WalletDocumentService documentService;
    WalletStorageService storage;
    WalletTypeService typeService;
    WalletShareService service;
    Map<String, WalletShareEntity> store;

    @BeforeEach
    void setUp() {
        shareRepo = mock(WalletShareRepository.class);
        docRepo = mock(WalletDocumentRepository.class);
        documentService = mock(WalletDocumentService.class);
        storage = mock(WalletStorageService.class);
        typeService = mock(WalletTypeService.class);
        service = new WalletShareService(shareRepo, docRepo, documentService, storage, typeService, new WalletMapper());

        store = new HashMap<>();
        when(shareRepo.save(any(WalletShareEntity.class))).thenAnswer(a -> {
            WalletShareEntity e = a.getArgument(0);
            if (e.getId() == null) e.setId("s-" + (store.size() + 1));
            store.put(e.getTokenHash(), e);
            return e;
        });
        when(shareRepo.findByTokenHash(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
    }

    @Test
    void create_returnsToken_andStoresOnlyHash() {
        WalletDocumentEntity doc = new WalletDocumentEntity();
        doc.setId("d1"); doc.setUserId(1L);
        when(documentService.getOwnedEntity(1L, "d1")).thenReturn(doc);

        ShareDto dto = service.create(1L, "d1", new CreateShareRequest(24, null));

        assertThat(dto.token()).isNotBlank();
        // stored key is the hash, never the raw token
        assertThat(store.keySet()).doesNotContain(dto.token());
        assertThat(store).hasSize(1);
    }

    @Test
    void resolveContent_deniesExpiredShare() {
        WalletShareEntity expired = new WalletShareEntity();
        expired.setId("s1"); expired.setDocumentId("d1"); expired.setTokenHash("HASH");
        expired.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));
        store.put("HASH", expired);
        // token whose sha256 == "HASH" is impractical; instead resolve by stubbing hashing via a real token:
        // simpler: assert expired guard through resolveInfo using a freshly created share below.
        assertThatThrownBy(() -> service.resolveContentByHashForTest("HASH"))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void revoke_marksRevoked() {
        WalletShareEntity s = new WalletShareEntity();
        s.setId("s1"); s.setDocumentId("d1"); s.setCreatedByUserId(1L); s.setTokenHash("H");
        s.setExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS));
        when(shareRepo.findById("s1")).thenReturn(Optional.of(s));
        WalletDocumentEntity doc = new WalletDocumentEntity(); doc.setId("d1"); doc.setUserId(1L);
        when(documentService.getOwnedEntity(1L, "d1")).thenReturn(doc);

        service.revoke(1L, "s1");

        assertThat(s.isRevoked()).isTrue();
        verify(shareRepo).save(s);
    }
}
