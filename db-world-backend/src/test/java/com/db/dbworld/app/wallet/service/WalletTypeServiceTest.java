package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.UpsertDocumentTypeRequest;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletDocumentTypeRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WalletTypeServiceTest {

    WalletDocumentTypeRepository typeRepo;
    WalletDocumentRepository docRepo;
    WalletTypeService service;
    Map<String, WalletDocumentTypeEntity> store;

    @BeforeEach
    void setUp() {
        typeRepo = mock(WalletDocumentTypeRepository.class);
        docRepo  = mock(WalletDocumentRepository.class);
        store = new HashMap<>();
        when(typeRepo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(typeRepo.existsByCode(any())).thenAnswer(a ->
                store.values().stream().anyMatch(t -> t.getCode().equals(a.getArgument(0))));
        when(typeRepo.save(any(WalletDocumentTypeEntity.class))).thenAnswer(a -> {
            WalletDocumentTypeEntity e = a.getArgument(0);
            if (e.getId() == null) e.setId("t-" + (store.size() + 1));
            store.put(e.getId(), e);
            return e;
        });
        service = new WalletTypeService(typeRepo, docRepo);
    }

    @Test
    void create_rejectsDuplicateCode() {
        service.create(new UpsertDocumentTypeRequest("PAN", "PAN Card", null, null, false, null, true, 0));
        assertThatThrownBy(() -> service.create(
                new UpsertDocumentTypeRequest("PAN", "Another", null, null, false, null, true, 1)))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void get_missing_throwsNotFound() {
        assertThatThrownBy(() -> service.get("nope")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void deleteOrDeactivate_whenInUse_deactivatesInsteadOfDeleting() {
        WalletDocumentTypeEntity t = service.create(
                new UpsertDocumentTypeRequest("DL", "Driving Licence", null, null, true, "DL No", true, 0));
        when(docRepo.countByDocumentTypeId(t.getId())).thenReturn(2L);

        boolean deleted = service.deleteOrDeactivate(t.getId());

        assertThat(deleted).isFalse();
        assertThat(store.get(t.getId()).isActive()).isFalse();
        verify(typeRepo, never()).deleteById(t.getId());
    }
}
