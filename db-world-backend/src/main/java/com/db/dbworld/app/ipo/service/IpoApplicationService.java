package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoApplicationDto;
import com.db.dbworld.app.ipo.dto.MyIpoDto;
import com.db.dbworld.app.ipo.dto.SaveApplicationRequest;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoUserApplicationEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoUserApplicationRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Applicant-level "My IPOs": each user's own saved application details for an IPO (application
 * number, DP client id, PAN last-4, a self-recorded allotment result) — every read/write is
 * scoped to the caller's {@code userId}, so one user never sees or touches another's rows.
 *
 * <p><b>PII rule:</b> a full PAN is never persisted or logged. {@link SaveApplicationRequest#pan()}
 * may carry a full PAN typed by the user; {@link #lastFourOfPan} reduces it to the last 4
 * characters before anything is written to the entity, and the full value is discarded the
 * moment {@link #upsert} returns — it never reaches a log line or a second method.
 */
@Service
public class IpoApplicationService {

    private final IpoUserApplicationRepository applicationRepository;
    private final IpoListingRepository listingRepository;
    private final IpoMapper mapper;

    public IpoApplicationService(IpoUserApplicationRepository applicationRepository,
                                  IpoListingRepository listingRepository,
                                  IpoMapper mapper) {
        this.applicationRepository = applicationRepository;
        this.listingRepository = listingRepository;
        this.mapper = mapper;
    }

    /** Creates or updates the caller's saved application for {@code ipoId}. 404s if the IPO itself doesn't exist. */
    @Transactional
    public IpoApplicationDto upsert(Long userId, String ipoId, SaveApplicationRequest req) {
        if (!listingRepository.existsById(ipoId)) {
            throw new DbWorldException(HttpStatus.NOT_FOUND, "IPO not found");
        }

        IpoUserApplicationEntity entity = applicationRepository.findByUserIdAndIpoId(userId, ipoId)
                .orElseGet(() -> IpoUserApplicationEntity.builder().userId(userId).ipoId(ipoId).build());

        entity.setApplicantName(req.applicantName());
        entity.setApplicationNo(req.applicationNo());
        entity.setDpClientId(req.dpClientId());
        entity.setAllotmentResult(req.allotmentResult());

        // Never overwrite a previously-saved panLast4 with null just because this call didn't
        // resupply the PAN (e.g. the user only edited the allotment result this time).
        String panLast4 = lastFourOfPan(req.pan());
        if (panLast4 != null) {
            entity.setPanLast4(panLast4);
        }

        return mapper.toApplicationDto(applicationRepository.save(entity));
    }

    public Optional<IpoApplicationDto> getMine(Long userId, String ipoId) {
        return applicationRepository.findByUserIdAndIpoId(userId, ipoId).map(mapper::toApplicationDto);
    }

    /** Every saved application for this user, joined with its IPO's summary; orphaned ipoIds (IPO since removed) are skipped. */
    public List<MyIpoDto> listMine(Long userId) {
        List<IpoUserApplicationEntity> applications = applicationRepository.findByUserId(userId);

        List<String> ipoIds = applications.stream().map(IpoUserApplicationEntity::getIpoId).toList();
        Map<String, IpoListingEntity> ipoById = listingRepository.findAllById(ipoIds).stream()
                .collect(Collectors.toMap(IpoListingEntity::getId, Function.identity()));

        List<MyIpoDto> result = new ArrayList<>(applications.size());
        for (IpoUserApplicationEntity application : applications) {
            IpoListingEntity ipo = ipoById.get(application.getIpoId());
            if (ipo != null) {
                result.add(mapper.toMyIpoDto(application, ipo));
            }
        }
        return result;
    }

    @Transactional
    public void delete(Long userId, String ipoId) {
        applicationRepository.deleteByUserIdAndIpoId(userId, ipoId);
    }

    /**
     * Reduces a possibly-full PAN down to its last 4 characters (whitespace stripped,
     * uppercased) — this is the ONLY PAN-derived value that is ever persisted or logged.
     *
     * @return {@code null} for null/blank input, signalling the caller should leave any
     * previously-saved {@code panLast4} untouched rather than clearing it.
     */
    private static String lastFourOfPan(String pan) {
        if (pan == null) {
            return null;
        }
        String cleaned = pan.replaceAll("\\s+", "").toUpperCase();
        if (cleaned.isBlank()) {
            return null;
        }
        return cleaned.length() <= 4 ? cleaned : cleaned.substring(cleaned.length() - 4);
    }
}
