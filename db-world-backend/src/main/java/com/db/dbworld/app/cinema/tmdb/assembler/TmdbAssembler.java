package com.db.dbworld.app.cinema.tmdb.assembler;//package com.db.dbworld.cinema.tmdb.assembler;
//
//import com.db.dbworld.cinema.tmdb.credits.dto.CreditDto;
//import com.db.dbworld.cinema.tmdb.credits.entity.CreditEntity;
//import com.db.dbworld.cinema.tmdb.dto.MovieTmdbDto;
//import com.db.dbworld.cinema.tmdb.dto.TmdbDto;
//import com.db.dbworld.cinema.tmdb.dto.TvSeriesTmdbDto;
//import com.db.dbworld.cinema.tmdb.entities.MovieTmdbEntity;
//import com.db.dbworld.cinema.tmdb.entities.TmdbEntity;
//import com.db.dbworld.cinema.tmdb.entities.TvSeriesTmdbEntity;
//import com.db.dbworld.cinema.tmdb.enums.CreditType;
//import com.db.dbworld.cinema.tmdb.enums.ProviderType;
//import com.db.dbworld.cinema.tmdb.language.dto.SpokenLanguageDto;
//import com.db.dbworld.cinema.tmdb.language.entity.SpokenLanguageEntity;
//import com.db.dbworld.cinema.tmdb.language.repository.SpokenLanguageRepository;
//import com.db.dbworld.cinema.tmdb.mapper.TmdbMapper;
//import com.db.dbworld.cinema.tmdb.media.dto.ImageDto;
//import com.db.dbworld.cinema.tmdb.media.mapper.ImageMapper;
//import com.db.dbworld.cinema.tmdb.media.mapper.VideoMapper;
//import com.db.dbworld.cinema.tmdb.people.entity.PersonEntity;
//import com.db.dbworld.cinema.tmdb.people.mapper.PersonMapper;
//import com.db.dbworld.cinema.tmdb.people.repository.PersonRepository;
//import com.db.dbworld.cinema.tmdb.providers.dto.*;
//import com.db.dbworld.cinema.tmdb.providers.entity.*;
//import com.db.dbworld.cinema.tmdb.providers.mapper.ProviderMapper;
//import com.db.dbworld.cinema.tmdb.providers.repository.ProviderRepository;
//import com.db.dbworld.cinema.tmdb.review.dto.ReviewDto;
//import com.db.dbworld.cinema.tmdb.review.mapper.ReviewMapper;
//import lombok.RequiredArgsConstructor;
//import org.springframework.stereotype.Component;
//
//import java.util.*;
//import java.util.stream.Collectors;
//import java.util.stream.Stream;
//
//@Component
//@RequiredArgsConstructor
//public class TmdbAssembler {
//
//    private final TmdbMapper tmdbMapper;
//    private final VideoMapper videoMapper;
//    private final ImageMapper imageMapper;
//    private final ReviewMapper reviewMapper;
//    private final PersonMapper personMapper;
//    private final ProviderMapper providerMapper;
//
//    private final ProviderRepository providerRepository;
//    private final SpokenLanguageRepository languageRepository;
//    private final PersonRepository personRepository;
//
//    /* =======================================
//       MOVIE
//     ======================================= */
//
//    public MovieTmdbEntity assembleMovie(
//            MovieTmdbDto dto,
//            ProviderResponseDto providers,
//            List<ReviewDto> reviews
//    ) {
//
//        MovieTmdbEntity entity = (MovieTmdbEntity) tmdbMapper.toEntity(dto);
//
//        mapLanguages(dto, entity);
//        mapMedia(dto, entity);
//        mapCredits(dto, entity);
//        mapReviews(reviews, entity);
//        mapProviders(providers, entity);
//
//        return entity;
//    }
//
//    /* =======================================
//       TV SERIES
//     ======================================= */
//
//    public TvSeriesTmdbEntity assembleTvSeries(
//            TvSeriesTmdbDto dto,
//            ProviderResponseDto providers,
//            List<ReviewDto> reviews
//    ) {
//
//        TvSeriesTmdbEntity entity = (TvSeriesTmdbEntity) tmdbMapper.toEntity(dto);
//
//        mapLanguages(dto, entity);
//        mapMedia(dto, entity);
//        mapCredits(dto, entity);
//        mapReviews(reviews, entity);
//        mapProviders(providers, entity);
//
//        return entity;
//    }
//
//    /* =======================================
//       LANGUAGES
//     ======================================= */
//
//    private void mapLanguages(TmdbDto dto, TmdbEntity entity) {
//
//        if (dto.getSpoken_languages() == null) return;
//
//        List<String> codes = dto.getSpoken_languages()
//                .stream()
//                .map(SpokenLanguageDto::getIso_639_1)
//                .toList();
//
//        List<SpokenLanguageEntity> languages = languageRepository.findAllById(codes);
//
//        entity.setSpokenLanguages(languages);
//    }
//
//    /* =======================================
//       MEDIA
//     ======================================= */
//
//    private void mapMedia(TmdbDto dto, TmdbEntity entity) {
//
//        if (dto.getVideos() != null && dto.getVideos().getResults() != null) {
//
//            entity.setVideos(videoMapper.toEntityList(dto.getVideos().getResults()));
//            entity.getVideos().forEach(v -> v.setTmdb(entity));
//        }
//
//        if (dto.getImages() != null) {
//
//            List<ImageDto> images = Stream.of(
//                            dto.getImages().getPosters(),
//                            dto.getImages().getBackdrops(),
//                            dto.getImages().getLogos()
//                    )
//                    .filter(Objects::nonNull)
//                    .flatMap(Collection::stream)
//                    .map(i -> (ImageDto) i)
//                    .toList();
//
//            entity.setImages(imageMapper.toEntityList(images));
//            entity.getImages().forEach(i -> i.setTmdb(entity));
//        }
//    }
//
//    /* =======================================
//       CREDITS (CAST + CREW)
//     ======================================= */
//
//    private void mapCredits(TmdbDto dto, TmdbEntity entity) {
//
//        if (dto.getCredits() == null) return;
//
//        List<CreditDto> allCredits = new ArrayList<>();
//
//        if (dto.getCredits().getCast() != null)
//            allCredits.addAll(dto.getCredits().getCast());
//
//        if (dto.getCredits().getCrew() != null)
//            allCredits.addAll(dto.getCredits().getCrew());
//
//        if (allCredits.isEmpty()) return;
//
//        /* Collect person ids */
//        Set<Long> personIds = allCredits.stream()
//                .map(CreditDto::getId)
//                .collect(Collectors.toSet());
//
//        /* Load existing persons */
//        Map<Long, PersonEntity> existingPersons =
//                personRepository.findAllById(personIds)
//                        .stream()
//                        .collect(Collectors.toMap(PersonEntity::getId, p -> p));
//
//        /* Create missing persons */
//        List<PersonEntity> newPersons = new ArrayList<>();
//
//        for (CreditDto credit : allCredits) {
//
//            if (!existingPersons.containsKey(credit.getId())) {
//
//                PersonEntity p = personMapper.toEntity(credit);
//                p.setId(credit.getId());
//
//                newPersons.add(p);
//                existingPersons.put(p.getId(), p);
//            }
//        }
//
//        if (!newPersons.isEmpty()) {
//            personRepository.saveAll(newPersons);
//        }
//
//        /* Create credit entities */
//
//        List<CreditEntity> credits = new ArrayList<>();
//
//        for (CreditDto dtoCredit : allCredits) {
//
//            PersonEntity person = existingPersons.get(dtoCredit.getId());
//
//            CreditEntity credit = new CreditEntity();
//
//            credit.setTmdb(entity);
//            credit.setPerson(person);
//            credit.setCharacter(dtoCredit.getCharacter());
//            credit.setCastOrder(dtoCredit.getOrder());
//            credit.setDepartment(dtoCredit.getDepartment());
//            credit.setJob(dtoCredit.getJob());
//            credit.setCreditId(dtoCredit.getCredit_id());
//
//            credit.setCreditType(
//                    dto.getCredits().getCast() != null &&
//                            dto.getCredits().getCast().contains(dtoCredit)
//                            ? CreditType.CAST
//                            : CreditType.CREW
//            );
//
//            credits.add(credit);
//        }
//
//        entity.setCredits(credits);
//    }
//
//    /* =======================================
//       REVIEWS
//     ======================================= */
//
//    private void mapReviews(List<ReviewDto> reviews, TmdbEntity entity) {
//
//        if (reviews == null || reviews.isEmpty()) return;
//
//        entity.setReviews(reviewMapper.toEntityList(reviews));
//        entity.getReviews().forEach(r -> r.setTmdb(entity));
//    }
//
//    /* =======================================
//       PROVIDERS
//     ======================================= */
//
//    private void mapProviders(ProviderResponseDto response, TmdbEntity tmdbEntity) {
//
//        if (response == null || response.getResults() == null) return;
//
//        ProviderRegionDto region = response.getResults()
//                .getOrDefault("IN",
//                        response.getResults().values().stream().findFirst().orElse(null));
//
//        if (region == null) return;
//
//        List<ProviderDto> all = Stream.of(
//                        region.getFlatrate(),
//                        region.getBuy(),
//                        region.getRent()
//                )
//                .filter(Objects::nonNull)
//                .flatMap(Collection::stream)
//                .toList();
//
//        if (all.isEmpty()) return;
//
//        List<Long> ids = all.stream()
//                .map(ProviderDto::getProvider_id)
//                .distinct()
//                .toList();
//
//        Map<Long, ProviderEntity> existing =
//                providerRepository.findAllById(ids)
//                        .stream()
//                        .collect(Collectors.toMap(ProviderEntity::getId, p -> p));
//
//        List<ProviderEntity> newProviders = new ArrayList<>();
//
//        for (ProviderDto dto : all) {
//
//            if (!existing.containsKey(dto.getProvider_id())) {
//
//                ProviderEntity entity = providerMapper.toEntity(dto);
//                newProviders.add(entity);
//                existing.put(entity.getId(), entity);
//            }
//        }
//
//        if (!newProviders.isEmpty())
//            providerRepository.saveAll(newProviders);
//
//        List<TmdbProviderEntity> relations = new ArrayList<>();
//
//        addRelations(region.getFlatrate(), ProviderType.FLATRATE, existing, tmdbEntity, relations);
//        addRelations(region.getBuy(), ProviderType.BUY, existing, tmdbEntity, relations);
//        addRelations(region.getRent(), ProviderType.RENT, existing, tmdbEntity, relations);
//
//        tmdbEntity.setProviders(relations);
//    }
//
//    private void addRelations(
//            List<ProviderDto> providers,
//            ProviderType type,
//            Map<Long, ProviderEntity> providerMap,
//            TmdbEntity tmdbEntity,
//            List<TmdbProviderEntity> result
//    ) {
//
//        if (providers == null) return;
//
//        for (ProviderDto dto : providers) {
//
//            ProviderEntity provider = providerMap.get(dto.getProvider_id());
//
//            TmdbProviderEntity relation = new TmdbProviderEntity();
//
//            relation.setTmdb(tmdbEntity);
//            relation.setProvider(provider);
//            relation.setProviderType(type);
//
//            result.add(relation);
//        }
//    }
//}