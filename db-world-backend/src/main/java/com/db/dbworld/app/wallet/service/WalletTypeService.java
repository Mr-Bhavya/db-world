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
import java.util.Set;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class WalletTypeService {

    private final WalletDocumentTypeRepository typeRepo;
    private final WalletDocumentRepository docRepo;

    /**
     * One seeded document type. `category` groups the picker and `iconKey` is a SEMANTIC name the
     * client maps to a component - neither is an icon-library identifier, so the schema stays
     * independent of whatever the frontend renders with.
     */
    private record Seed(String code, String name, boolean requiresNumber, String numberLabel,
                        String category, String iconKey) {}

    /**
     * The Indian document set, grouped.
     *
     * The original six (Aadhaar / PAN / Driving Licence / Passport / Voter ID / Other) keep their
     * codes exactly. Documents reference a type by id so a code change would orphan nothing, but it
     * would still break every admin script and saved filter that keys off them.
     *
     * Deliberately ABSENT: credit and debit cards. A wallet that invites you to photograph a card -
     * number, expiry and CVV together on one image - is a liability whatever the encryption at
     * rest, and no legitimate process ever asks you to produce one as a document.
     *
     * `sortOrder` is the list index, so ordering is positional: move a line and the picker moves
     * with it, with nothing to keep in sync by hand.
     */
    /**
     * The types that actually expire. Everything else - Aadhaar, PAN, every certificate, every
     * marksheet - does not, which is roughly seven in ten of the set, and prompting for an expiry
     * date on those is a field guaranteed to stay blank.
     */
    private static final Set<String> EXPIRING_CODES = Set.of(
            "PASSPORT", "VISA", "OCI_CARD",
            "DRIVING_LICENCE", "VEHICLE_RC", "VEHICLE_INSURANCE", "PUC_CERTIFICATE",
            "HEALTH_INSURANCE", "DISABILITY_UDID",
            "EMPLOYEE_ID", "RENT_AGREEMENT", "RATION_CARD"
    );

    private static final List<Seed> DEFAULTS = List.of(
            // Identity
            new Seed("AADHAAR",               "Aadhaar Card",                   true,  "Aadhaar Number",         "IDENTITY",  "identity"),
            new Seed("PAN",                   "PAN Card",                       true,  "PAN Number",             "IDENTITY",  "tax"),
            new Seed("VOTER_ID",              "Voter ID",                       true,  "EPIC Number",            "IDENTITY",  "vote"),
            new Seed("RATION_CARD",           "Ration Card",                    true,  "Ration Card Number",     "IDENTITY",  "identity"),
            new Seed("BIRTH_CERTIFICATE",     "Birth Certificate",              false, null,                     "IDENTITY",  "certificate"),
            new Seed("MARRIAGE_CERTIFICATE",  "Marriage Certificate",           false, null,                     "IDENTITY",  "certificate"),
            new Seed("DOMICILE_CERTIFICATE",  "Domicile Certificate",           false, null,                     "IDENTITY",  "certificate"),
            new Seed("CASTE_CERTIFICATE",     "Caste Certificate",              false, null,                     "IDENTITY",  "certificate"),
            new Seed("INCOME_CERTIFICATE",    "Income Certificate",             false, null,                     "IDENTITY",  "certificate"),
            new Seed("DISABILITY_UDID",       "Disability (UDID) Card",         true,  "UDID Number",            "IDENTITY",  "health"),

            // Travel
            new Seed("PASSPORT",              "Passport",                       true,  "Passport Number",        "TRAVEL",    "passport"),
            new Seed("VISA",                  "Visa",                           true,  "Visa Number",            "TRAVEL",    "travel"),
            new Seed("OCI_CARD",              "OCI / PIO Card",                 true,  "OCI Number",             "TRAVEL",    "passport"),

            // Vehicle
            new Seed("DRIVING_LICENCE",       "Driving Licence",                true,  "Licence Number",         "VEHICLE",   "licence"),
            new Seed("VEHICLE_RC",            "Vehicle RC",                     true,  "Registration Number",    "VEHICLE",   "vehicle"),
            new Seed("VEHICLE_INSURANCE",     "Vehicle Insurance",              true,  "Policy Number",          "VEHICLE",   "insurance"),
            new Seed("PUC_CERTIFICATE",       "PUC Certificate",                false, null,                     "VEHICLE",   "vehicle"),

            // Education
            new Seed("MARKSHEET_10",          "Class 10 Marksheet",             false, null,                     "EDUCATION", "education"),
            new Seed("MARKSHEET_12",          "Class 12 Marksheet",             false, null,                     "EDUCATION", "education"),
            new Seed("DEGREE_CERTIFICATE",    "Degree Certificate",             false, null,                     "EDUCATION", "education"),
            new Seed("TRANSFER_CERTIFICATE",  "Transfer / Leaving Certificate", false, null,                     "EDUCATION", "education"),

            // Financial
            new Seed("BANK_PASSBOOK",         "Bank Passbook",                  true,  "Account Number",         "FINANCIAL", "bank"),
            new Seed("CANCELLED_CHEQUE",      "Cancelled Cheque",               false, null,                     "FINANCIAL", "bank"),
            new Seed("DEMAT_CMR",             "Demat CMR",                      true,  "DP / Client ID",         "FINANCIAL", "bank"),
            new Seed("FORM_16",               "Form 16",                        false, null,                     "FINANCIAL", "tax"),
            new Seed("ITR_ACKNOWLEDGEMENT",   "ITR Acknowledgement",            true,  "Acknowledgement Number", "FINANCIAL", "tax"),

            // Health
            new Seed("HEALTH_INSURANCE",      "Health Insurance",               true,  "Policy Number",          "HEALTH",    "insurance"),
            new Seed("ABHA_CARD",             "ABHA Health ID",                 true,  "ABHA Number",            "HEALTH",    "health"),
            new Seed("VACCINATION_CERT",      "Vaccination Certificate",        false, null,                     "HEALTH",    "health"),

            // Work
            new Seed("EMPLOYEE_ID",           "Employee ID",                    true,  "Employee ID",            "WORK",      "work"),
            new Seed("OFFER_LETTER",          "Offer Letter",                   false, null,                     "WORK",      "work"),
            new Seed("EXPERIENCE_LETTER",     "Experience / Relieving Letter",  false, null,                     "WORK",      "work"),
            new Seed("PF_UAN",                "PF / UAN",                       true,  "UAN",                    "WORK",      "work"),

            // Property
            new Seed("PROPERTY_DEED",         "Sale Deed / Property Papers",    false, null,                     "PROPERTY",  "property"),
            new Seed("RENT_AGREEMENT",        "Rent Agreement",                 false, null,                     "PROPERTY",  "property"),
            new Seed("UTILITY_BILL",          "Utility Bill",                   true,  "Consumer Number",        "PROPERTY",  "property"),

            // Catch-all, always last
            new Seed("OTHER",                 "Other",                          false, null,                     "OTHER",     "other")
    );

    /**
     * Idempotent seed. Inserts any code that is not there yet and - separately - BACKFILLS the
     * grouping fields on rows that predate them.
     *
     * The backfill is the part that matters on an existing install: this method has always been
     * insert-only, so the six types seeded before `category`/`iconKey` existed would have kept a
     * null for both forever and fallen into the picker's catch-all group. It only ever writes over
     * a NULL, so an admin who has set either by hand is never overruled, and it deliberately leaves
     * `displayName`, `numberLabel` and `sortOrder` alone - those are theirs to customise.
     */
    @PostConstruct
    void seedDefaults() {
        try {
            int order = 0;
            for (Seed s : DEFAULTS) {
                final int sortOrder = order++;
                typeRepo.findByCode(s.code()).ifPresentOrElse(
                        existing -> backfillGrouping(existing, s),
                        () -> {
                            WalletDocumentTypeEntity e = WalletDocumentTypeEntity.builder()
                                    .code(s.code()).displayName(s.name())
                                    .requiresNumber(s.requiresNumber()).numberLabel(s.numberLabel())
                                    .category(s.category()).iconKey(s.iconKey())
                                    .hasExpiry(EXPIRING_CODES.contains(s.code()))
                                    .active(true).sortOrder(sortOrder)
                                    .build();
                            typeRepo.save(e);
                            log.info("Seeded wallet document type {}", s.code());
                        });
            }
        } catch (Exception ex) {
            log.warn("Wallet type seeding skipped: {}", ex.getMessage());
        }
    }

    /** Fills `category`/`iconKey` on an existing row when - and only when - they are still null. */
    private void backfillGrouping(WalletDocumentTypeEntity e, Seed s) {
        boolean changed = false;
        if (e.getCategory() == null || e.getCategory().isBlank()) { e.setCategory(s.category()); changed = true; }
        if (e.getIconKey() == null || e.getIconKey().isBlank())   { e.setIconKey(s.iconKey());   changed = true; }
        if (e.getHasExpiry() == null) { e.setHasExpiry(EXPIRING_CODES.contains(s.code())); changed = true; }
        if (changed) {
            typeRepo.save(e);
            log.info("Backfilled grouping for wallet document type {}", s.code());
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
                .description(req.description()).iconKey(req.iconKey()).category(req.category())
                .requiresNumber(req.requiresNumber()).numberLabel(req.numberLabel())
                .hasExpiry(req.hasExpiry())
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
        e.setCategory(req.category());
        e.setRequiresNumber(req.requiresNumber());
        e.setNumberLabel(req.numberLabel());
        e.setHasExpiry(req.hasExpiry());
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
