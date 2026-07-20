package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.UpsertDocumentTypeRequest;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletDocumentTypeRepository;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class WalletTypeService {

    private final WalletDocumentTypeRepository typeRepo;
    private final WalletDocumentRepository docRepo;

    // code, displayName, requiresNumber, numberLabel, sortOrder
    private record Seed(String code, String name, boolean requiresNumber, String numberLabel, int order) {}
    private static final List<Seed> DEFAULTS = List.of(
            new Seed("AADHAAR",         "Aadhaar Card",    true,  "Aadhaar Number", 0),
            new Seed("PAN",             "PAN Card",        true,  "PAN Number",     1),
            new Seed("DRIVING_LICENCE", "Driving Licence", true,  "Licence Number", 2),
            new Seed("PASSPORT",        "Passport",        true,  "Passport Number",3),
            new Seed("VOTER_ID",        "Voter ID",        true,  "EPIC Number",    4),
            new Seed("OTHER",           "Other",           false, null,             5)
    );

    /** Idempotent seed — never overwrites an existing row (mirrors SchedulerAdminService.seedDefaults). */
    @PostConstruct
    void seedDefaults() {
        try {
            for (Seed s : DEFAULTS) {
                if (typeRepo.findByCode(s.code()).isEmpty()) {
                    WalletDocumentTypeEntity e = WalletDocumentTypeEntity.builder()
                            .code(s.code()).displayName(s.name())
                            .requiresNumber(s.requiresNumber()).numberLabel(s.numberLabel())
                            .active(true).sortOrder(s.order())
                            .build();
                    typeRepo.save(e);
                    log.info("Seeded wallet document type {}", s.code());
                }
            }
        } catch (Exception ex) {
            log.warn("Wallet type seeding skipped: {}", ex.getMessage());
        }
    }

    public List<WalletDocumentTypeEntity> listActive() { return typeRepo.findByActiveTrueOrderBySortOrderAsc(); }
    public List<WalletDocumentTypeEntity> listAll()    { return typeRepo.findAllByOrderBySortOrderAsc(); }

    public WalletDocumentTypeEntity get(String id) {
        return typeRepo.findById(id)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Document type not found"));
    }

    public Map<String, WalletDocumentTypeEntity> byId() {
        return typeRepo.findAll().stream()
                .collect(Collectors.toMap(WalletDocumentTypeEntity::getId, Function.identity()));
    }

    public WalletDocumentTypeEntity create(UpsertDocumentTypeRequest req) {
        String code = req.code().trim().toUpperCase();
        if (typeRepo.existsByCode(code)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A document type with code " + code + " already exists");
        }
        WalletDocumentTypeEntity e = WalletDocumentTypeEntity.builder()
                .code(code).displayName(req.displayName().trim())
                .description(req.description()).iconKey(req.iconKey())
                .requiresNumber(req.requiresNumber()).numberLabel(req.numberLabel())
                .active(req.active() == null || req.active())
                .sortOrder(req.sortOrder() == null ? 0 : req.sortOrder())
                .build();
        return typeRepo.save(e);
    }

    public WalletDocumentTypeEntity update(String id, UpsertDocumentTypeRequest req) {
        WalletDocumentTypeEntity e = get(id);
        String code = req.code().trim().toUpperCase();
        if (!code.equals(e.getCode()) && typeRepo.existsByCode(code)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A document type with code " + code + " already exists");
        }
        e.setCode(code);
        e.setDisplayName(req.displayName().trim());
        e.setDescription(req.description());
        e.setIconKey(req.iconKey());
        e.setRequiresNumber(req.requiresNumber());
        e.setNumberLabel(req.numberLabel());
        if (req.active() != null)    e.setActive(req.active());
        if (req.sortOrder() != null) e.setSortOrder(req.sortOrder());
        return typeRepo.save(e);
    }

    /** Hard-deletes if unused; otherwise deactivates. Returns true if hard-deleted. */
    public boolean deleteOrDeactivate(String id) {
        WalletDocumentTypeEntity e = get(id);
        if (docRepo.countByDocumentTypeId(id) > 0) {
            e.setActive(false);
            typeRepo.save(e);
            return false;
        }
        typeRepo.deleteById(id);
        return true;
    }
}
