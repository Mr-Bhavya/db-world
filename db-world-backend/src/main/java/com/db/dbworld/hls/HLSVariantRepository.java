package com.db.dbworld.hls;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HLSVariantRepository extends JpaRepository<HLSVariantEntity, String> {

    List<HLSVariantEntity> findByHlsContentId(String hlsContentId);

    Optional<HLSVariantEntity> findByHlsContentIdAndResolutionName(String hlsContentId, String resolutionName);

    void deleteByHlsContentId(String id);
}
