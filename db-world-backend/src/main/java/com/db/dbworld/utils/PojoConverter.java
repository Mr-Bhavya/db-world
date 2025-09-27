package com.db.dbworld.utils;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.*;
import com.db.dbworld.entities.dbcinema.tmdb.credits.*;
import com.db.dbworld.entities.dbcinema.tmdb.images.BackDropImage;
import com.db.dbworld.entities.dbcinema.tmdb.images.ImagesEntity;
import com.db.dbworld.entities.dbcinema.tmdb.images.LogoImage;
import com.db.dbworld.entities.dbcinema.tmdb.images.PosterImage;
import com.db.dbworld.entities.dbcinema.tmdb.providers.*;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.*;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CastDto;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CreditsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CrewDto;
import com.db.dbworld.payloads.dbcinema.tmdb.images.Image;
import com.db.dbworld.payloads.dbcinema.tmdb.images.ImagesDto;
import com.db.dbworld.payloads.dbcinema.tmdb.provider.ProviderDto;
import com.db.dbworld.payloads.dbcinema.tmdb.provider.ProvidersDto;
import org.modelmapper.ModelMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PojoConverter {

    private static final Logger logger = LoggerFactory.getLogger(PojoConverter.class);

    @Autowired
    private ModelMapper modelMapper;

    public DBCinemaRecordsDto dbCinemaRecordsEntityToDto(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        logger.debug("Converting DBCinemaRecordsEntity to DTO for recordId: {}", dbCinemaRecordsEntity.getId());

        DBCinemaRecordsDto dbCinemaRecordsDto = new DBCinemaRecordsDto();
        dbCinemaRecordsDto.setRecordId(dbCinemaRecordsEntity.getId());
        dbCinemaRecordsDto.setType(dbCinemaRecordsEntity.getType());
        dbCinemaRecordsDto.setName(dbCinemaRecordsEntity.getName());
        dbCinemaRecordsDto.setShowOnTop(dbCinemaRecordsEntity.isShowOnTop());

        if (dbCinemaRecordsEntity.getTmdb() instanceof MovieTmdbDataEntity) {
            dbCinemaRecordsDto.setMovieTmdb(movieTmdbEntityToDto((MovieTmdbDataEntity) dbCinemaRecordsEntity.getTmdb()));
            logger.debug("Set MovieTmdb data for recordId: {}", dbCinemaRecordsEntity.getId());
        } else {
            dbCinemaRecordsDto.setSeriesTmdb(seriesTmdbEntityToDto((SeriesTmdbDataEntity) dbCinemaRecordsEntity.getTmdb()));
            logger.debug("Set SeriesTmdb data for recordId: {}", dbCinemaRecordsEntity.getId());
        }

        dbCinemaRecordsDto.setLiked(dbCinemaRecordsEntity.isLiked());
        dbCinemaRecordsDto.setWatchListed(dbCinemaRecordsEntity.isWatchListed());
        dbCinemaRecordsDto.setWatched(dbCinemaRecordsEntity.isWatched());

        logger.debug("Successfully converted DBCinemaRecordsEntity to DTO for recordId: {}", dbCinemaRecordsEntity.getId());
        return dbCinemaRecordsDto;
    }

    public void movieTmdbDtoToEntity(MovieTmdbDataDto movieTmdbDataDto, MovieTmdbDataEntity movieTmdbDataEntity) {
        logger.debug("Converting MovieTmdbDataDto to Entity for TMDB ID: {}", movieTmdbDataDto.getId());

        tmdbCommonDtoToEntity(movieTmdbDataDto, movieTmdbDataEntity);

        // Movies specific fields
        movieTmdbDataEntity.setBudget(movieTmdbDataDto.getBudget());
        movieTmdbDataEntity.setImdb_id(movieTmdbDataDto.getImdb_id());
        movieTmdbDataEntity.setRelease_date(movieTmdbDataDto.getRelease_date());
        movieTmdbDataEntity.setRevenue(movieTmdbDataDto.getRevenue());
        movieTmdbDataEntity.setRuntime(movieTmdbDataDto.getRuntime());
        movieTmdbDataEntity.setVideo(movieTmdbDataDto.isVideo());

        logger.debug("Successfully converted MovieTmdbDataDto to Entity for TMDB ID: {}", movieTmdbDataDto.getId());
    }

    public void seriesTmdbDtoToEntity(SeriesTmdbDataDto seriesTmdbDataDto, SeriesTmdbDataEntity seriesTmdbDataEntity) {
        logger.debug("Converting SeriesTmdbDataDto to Entity for TMDB ID: {}", seriesTmdbDataDto.getId());

        tmdbCommonDtoToEntity(seriesTmdbDataDto, seriesTmdbDataEntity);

        // Series specific fields
        seriesTmdbDataEntity.setFirst_air_date(seriesTmdbDataDto.getFirst_air_date());
        seriesTmdbDataEntity.setType(seriesTmdbDataDto.getType());
        seriesTmdbDataEntity.setIn_production(seriesTmdbDataDto.isIn_production());
        seriesTmdbDataEntity.setLast_air_date(seriesTmdbDataDto.getLast_air_date());
        seriesTmdbDataEntity.setNumber_of_episodes(seriesTmdbDataDto.getNumber_of_episodes());
        seriesTmdbDataEntity.setNumber_of_seasons(seriesTmdbDataDto.getNumber_of_seasons());

        if (seriesTmdbDataDto.getSeasons() != null) {
            seriesTmdbDataEntity.setSeasons(seriesTmdbDataDto.getSeasons().stream()
                    .map(season -> modelMapper.map(season, SeasonsEntity.class))
                    .collect(Collectors.toList()));
        }

        if (seriesTmdbDataDto.getNetworks() != null) {
            seriesTmdbDataEntity.setNetworks(seriesTmdbDataDto.getNetworks().stream()
                    .map(network -> modelMapper.map(network, NetworkEntity.class))
                    .collect(Collectors.toList()));
        }

        logger.debug("Successfully converted SeriesTmdbDataDto to Entity for TMDB ID: {}", seriesTmdbDataDto.getId());
    }

    public MovieTmdbDataDto movieTmdbEntityToDto(MovieTmdbDataEntity movieTmdbDataEntity) {
        logger.debug("Converting MovieTmdbDataEntity to DTO for TMDB ID: {}", movieTmdbDataEntity.getId());

        MovieTmdbDataDto movieTmdbDataDto = (MovieTmdbDataDto) tmdbCommonEntityToDto(movieTmdbDataEntity, new MovieTmdbDataDto());

        // Movies specific fields
        movieTmdbDataDto.setBudget(movieTmdbDataEntity.getBudget());
        movieTmdbDataDto.setImdb_id(movieTmdbDataEntity.getImdb_id());
        movieTmdbDataDto.setRelease_date(movieTmdbDataEntity.getRelease_date());
        movieTmdbDataDto.setRevenue(movieTmdbDataEntity.getRevenue());
        movieTmdbDataDto.setRuntime(movieTmdbDataEntity.getRuntime());
        movieTmdbDataDto.setVideo(movieTmdbDataEntity.isVideo());

        logger.debug("Successfully converted MovieTmdbDataEntity to DTO for TMDB ID: {}", movieTmdbDataEntity.getId());
        return movieTmdbDataDto;
    }

    public SeriesTmdbDataDto seriesTmdbEntityToDto(SeriesTmdbDataEntity seriesTmdbDataEntity) {
        logger.debug("Converting SeriesTmdbDataEntity to DTO for TMDB ID: {}", seriesTmdbDataEntity.getId());

        SeriesTmdbDataDto seriesTmdbDataDto = (SeriesTmdbDataDto) tmdbCommonEntityToDto(seriesTmdbDataEntity, new SeriesTmdbDataDto());

        // Series specific fields
        seriesTmdbDataDto.setFirst_air_date(seriesTmdbDataEntity.getFirst_air_date());
        seriesTmdbDataDto.setType(seriesTmdbDataEntity.getType());
        seriesTmdbDataDto.setIn_production(seriesTmdbDataEntity.isIn_production());
        seriesTmdbDataDto.setLast_air_date(seriesTmdbDataEntity.getLast_air_date());
        seriesTmdbDataDto.setNumber_of_episodes(seriesTmdbDataEntity.getNumber_of_episodes());
        seriesTmdbDataDto.setNumber_of_seasons(seriesTmdbDataEntity.getNumber_of_seasons());

        if (seriesTmdbDataEntity.getSeasons() != null) {
            seriesTmdbDataDto.setSeasons(seriesTmdbDataEntity.getSeasons().stream()
                    .map(seasonsEntity -> modelMapper.map(seasonsEntity, SeriesTmdbDataDto.Season.class))
                    .toList());
        }

        if (seriesTmdbDataEntity.getNetworks() != null) {
            seriesTmdbDataDto.setNetworks(seriesTmdbDataEntity.getNetworks().stream()
                    .map(networkEntity -> modelMapper.map(networkEntity, SeriesTmdbDataDto.Network.class))
                    .toList());
        }

        logger.debug("Successfully converted SeriesTmdbDataEntity to DTO for TMDB ID: {}", seriesTmdbDataEntity.getId());
        return seriesTmdbDataDto;
    }

    private void tmdbCommonDtoToEntity(TmdbDataDto tmdbDataDto, TmdbDataEntity tmdbDataEntity) {
        logger.debug("Converting common TMDB DTO to Entity for ID: {}", tmdbDataDto.getId());

        // Common fields
        tmdbDataEntity.setId(tmdbDataDto.getId());
        tmdbDataEntity.setAdult(tmdbDataDto.isAdult());
        tmdbDataEntity.setBackdrop_path(tmdbDataDto.getBackdrop_path());
        tmdbDataEntity.setHomepage(tmdbDataDto.getHomepage());
        tmdbDataEntity.setOriginal_language(tmdbDataDto.getOriginal_language());
        tmdbDataEntity.setOriginal_title(tmdbDataDto.getOriginal_title());
        tmdbDataEntity.setOverview(tmdbDataDto.getOverview());
        tmdbDataEntity.setPopularity(tmdbDataDto.getPopularity());
        tmdbDataEntity.setPoster_path(tmdbDataDto.getPoster_path());
        tmdbDataEntity.setStatus(tmdbDataDto.getStatus());
        tmdbDataEntity.setTagline(tmdbDataDto.getTagline());
        tmdbDataEntity.setTitle(tmdbDataDto.getTitle());
        tmdbDataEntity.setVote_average(tmdbDataDto.getVote_average());
        tmdbDataEntity.setVote_count(tmdbDataDto.getVote_count());

        // Collections mapping
        mapCollectionsDtoToEntity(tmdbDataDto, tmdbDataEntity);

        logger.debug("Successfully converted common TMDB DTO to Entity for ID: {}", tmdbDataDto.getId());
//        return tmdbDataEntity;
    }

    private void mapCollectionsDtoToEntity(TmdbDataDto tmdbDataDto, TmdbDataEntity tmdbDataEntity) {
        // Genres
        if (tmdbDataDto.getGenres() != null) {
            tmdbDataEntity.setGenres(tmdbDataDto.getGenres().stream()
                    .map(genresDto -> modelMapper.map(genresDto, GenresEntity.class))
                    .collect(Collectors.toList()));
        }

        // Production companies
        if (tmdbDataDto.getProduction_companies() != null && !tmdbDataDto.getProduction_companies().isEmpty()) {
            tmdbDataEntity.setProduction_companies(tmdbDataDto.getProduction_companies().stream()
                    .map(dto -> modelMapper.map(dto, ProductionCompaniesEntity.class))
                    .collect(Collectors.toList()));
        }

        // Production countries
        if (tmdbDataDto.getProduction_countries() != null && !tmdbDataDto.getProduction_countries().isEmpty()) {
            tmdbDataEntity.setProduction_countries(tmdbDataDto.getProduction_countries().stream()
                    .map(dto -> modelMapper.map(dto, ProductionCountriesEntity.class))
                    .collect(Collectors.toList()));
        }

        // Spoken languages
        if (tmdbDataDto.getSpoken_languages() != null && !tmdbDataDto.getSpoken_languages().isEmpty()) {
            tmdbDataEntity.setSpoken_languages(tmdbDataDto.getSpoken_languages().stream()
                    .map(dto -> modelMapper.map(dto, SpokenLanguageEntity.class))
                    .collect(Collectors.toList()));
        }

        // Videos
        if (tmdbDataDto.getVideos() != null && !tmdbDataDto.getVideos().isEmpty()) {
            tmdbDataEntity.setVideos(tmdbDataDto.getVideos().stream()
                    .map(videosDto -> modelMapper.map(videosDto, VideosEntity.class))
                    .collect(Collectors.toList()));
        }

        // Images
        mapImagesDtoToEntity(tmdbDataDto, tmdbDataEntity);

        // Credits
        mapCreditsDtoToEntity(tmdbDataDto, tmdbDataEntity);

        // Providers
        mapProvidersDtoToEntity(tmdbDataDto, tmdbDataEntity);
    }

    private void mapImagesDtoToEntity(TmdbDataDto tmdbDataDto, TmdbDataEntity tmdbDataEntity) {
        if (tmdbDataDto.getImages() == null) return;

        List<ImagesEntity> imagesEntities = new ArrayList<>();
        ImagesDto imagesDto = tmdbDataDto.getImages();

        mapImageList(imagesDto.getBackdrops(), tmdbDataEntity, imagesEntities, BackDropImage.class);
        mapImageList(imagesDto.getLogos(), tmdbDataEntity, imagesEntities, LogoImage.class);
        mapImageList(imagesDto.getPosters(), tmdbDataEntity, imagesEntities, PosterImage.class);

        tmdbDataEntity.setImages(imagesEntities);
    }

    private void mapImageList(List<Image> images, TmdbDataEntity tmdbDataEntity,
                              List<ImagesEntity> imagesEntities, Class<? extends ImagesEntity> imageClass) {
        if (images == null || images.isEmpty()) return;

        images.forEach(image -> {
            ImagesEntity existingImage = findExistingImage(tmdbDataEntity, image.getFile_path());
            ImagesEntity imageEntity = existingImage != null ? existingImage : createImageInstance(imageClass);

            mapImageProperties(imageEntity, image, tmdbDataEntity);
            imagesEntities.add(imageEntity);
        });
    }

    private ImagesEntity findExistingImage(TmdbDataEntity tmdbDataEntity, String filePath) {
        if (tmdbDataEntity.getImages() == null || filePath == null) return null;

        return tmdbDataEntity.getImages().stream()
                .filter(image -> filePath.equalsIgnoreCase(image.getFile_path()))
                .findFirst()
                .orElse(null);
    }

    private ImagesEntity createImageInstance(Class<? extends ImagesEntity> imageClass) {
        try {
            return imageClass.getDeclaredConstructor().newInstance();
        } catch (Exception e) {
            logger.error("Error creating image instance for class: {}", imageClass.getSimpleName(), e);
            throw new RuntimeException("Failed to create image instance", e);
        }
    }

    private void mapImageProperties(ImagesEntity imageEntity, Image image, TmdbDataEntity tmdbDataEntity) {
        imageEntity.setTmdbDataEntity(tmdbDataEntity);
        imageEntity.setHeight(image.getHeight());
        imageEntity.setWidth(image.getWidth());
        imageEntity.setVote_average(image.getVote_average());
        imageEntity.setVote_count(image.getVote_count());
        imageEntity.setAspect_ratio(image.getAspect_ratio());

        if (image.getIso_639_1() != null) {
            SpokenLanguageEntity spokenLanguage = new SpokenLanguageEntity();
            spokenLanguage.setIso_639_1(image.getIso_639_1());
            imageEntity.setIso_639_1(spokenLanguage);
        }
    }

    private void mapCreditsDtoToEntity(TmdbDataDto tmdbDataDto, TmdbDataEntity tmdbDataEntity) {
        if (tmdbDataDto.getCredits() == null) return;

        CreditsDto creditsDto = tmdbDataDto.getCredits();
        CreditsEntity creditsEntity = tmdbDataEntity.getCredits() != null ?
                tmdbDataEntity.getCredits() : new CreditsEntity();

        // Map cast
        if (creditsDto.getCast() != null && !creditsDto.getCast().isEmpty()) {
            creditsEntity.setCast(creditsDto.getCast().stream()
                    .map(this::mapCastDtoToEntity)
                    .collect(Collectors.toList()));
        }

        // Map crew
        if (creditsDto.getCrew() != null && !creditsDto.getCrew().isEmpty()) {
            creditsEntity.setCrew(creditsDto.getCrew().stream()
                    .map(this::mapCrewDtoToEntity)
                    .collect(Collectors.toList()));
        }

        tmdbDataEntity.setCredits(creditsEntity);
    }

    private CastEntity mapCastDtoToEntity(CastDto castDto) {
        CastEntity castEntity = new CastEntity();
        CharacterEntity characterEntity = new CharacterEntity();
        characterEntity.setName(castDto.getCharacter());

        castEntity.setPerson(modelMapper.map(castDto, PersonEntity.class));
        castEntity.setCast_id(castDto.getCast_id());
        castEntity.setCharacter(characterEntity);
        castEntity.setOrder(castDto.getOrder());

        return castEntity;
    }

    private CrewEntity mapCrewDtoToEntity(CrewDto crewDto) {
        CrewEntity crewEntity = new CrewEntity();

        JobEntity jobEntity = new JobEntity();
        jobEntity.setName(crewDto.getJob());

        DepartmentEntity departmentEntity = new DepartmentEntity();
        departmentEntity.setName(crewDto.getDepartment());

        crewEntity.setPerson(modelMapper.map(crewDto, PersonEntity.class));
        crewEntity.setJob(jobEntity);
        crewEntity.setDepartment(departmentEntity);

        return crewEntity;
    }

    private void mapProvidersDtoToEntity(TmdbDataDto tmdbDataDto, TmdbDataEntity tmdbDataEntity) {
        if (tmdbDataDto.getProviders() == null) return;

        ProvidersDto providersDto = tmdbDataDto.getProviders();
        ProvidersEntity providersEntity = tmdbDataEntity.getProviders() != null ?
                tmdbDataEntity.getProviders() : new ProvidersEntity();

        // Map buy providers
        if (providersDto.getBuy() != null && !providersDto.getBuy().isEmpty()) {
            providersEntity.setBuy(mapProviderList(providersDto.getBuy(),
                    providersEntity.getBuy(), BuyEntity.class));
        }

        // Map rent providers
        if (providersDto.getRent() != null && !providersDto.getRent().isEmpty()) {
            providersEntity.setRent(mapProviderList(providersDto.getRent(),
                    providersEntity.getRent(), RentEntity.class));
        }

        // Map flatrate providers
        if (providersDto.getFlatrate() != null && !providersDto.getFlatrate().isEmpty()) {
            providersEntity.setFlatRate(mapProviderList(providersDto.getFlatrate(),
                    providersEntity.getFlatRate(), FlatRateEntity.class));
        }

        tmdbDataEntity.setProviders(providersEntity);
    }

    private <T> List<T> mapProviderList(List<ProviderDto> providerDtos, List<T> existingProviders, Class<T> providerClass) {
        return providerDtos.stream().map(providerDto -> {
            T providerEntity = findExistingProvider(existingProviders, providerDto.getProvider_id(), providerClass);
            if (providerEntity == null) {
                try {
                    providerEntity = providerClass.getDeclaredConstructor().newInstance();
                } catch (Exception e) {
                    logger.error("Error creating provider instance: {}", providerClass.getSimpleName(), e);
                    throw new RuntimeException("Failed to create provider instance", e);
                }
            }
            modelMapper.map(providerDto, providerEntity);
            return providerEntity;
        }).collect(Collectors.toList());
    }

    private <T> T findExistingProvider(List<T> existingProviders, Long providerId, Class<T> providerClass) {
        if (existingProviders == null || existingProviders.isEmpty()) return null;

        // This would need reflection or a common interface to check provider_id
        // For now, we'll return null and create new instances
        return null;
    }

    private TmdbDataDto tmdbCommonEntityToDto(TmdbDataEntity tmdbDataEntity, TmdbDataDto tmdbDataDto) {
        logger.debug("Converting common TMDB Entity to DTO for ID: {}", tmdbDataEntity.getId());

        // Common fields
        tmdbDataDto.setId(tmdbDataEntity.getId());
        tmdbDataDto.setAdult(tmdbDataEntity.isAdult());
        tmdbDataDto.setBackdrop_path(tmdbDataEntity.getBackdrop_path());
        tmdbDataDto.setHomepage(tmdbDataEntity.getHomepage());
        tmdbDataDto.setOriginal_language(tmdbDataEntity.getOriginal_language());
        tmdbDataDto.setOriginal_title(tmdbDataEntity.getOriginal_title());
        tmdbDataDto.setOverview(tmdbDataEntity.getOverview());
        tmdbDataDto.setPopularity(tmdbDataEntity.getPopularity());
        tmdbDataDto.setPoster_path(tmdbDataEntity.getPoster_path());
        tmdbDataDto.setStatus(tmdbDataEntity.getStatus());
        tmdbDataDto.setTagline(tmdbDataEntity.getTagline());
        tmdbDataDto.setTitle(tmdbDataEntity.getTitle());
        tmdbDataDto.setVote_average(tmdbDataEntity.getVote_average());
        tmdbDataDto.setVote_count(tmdbDataEntity.getVote_count());

        // Collections mapping
        mapCollectionsEntityToDto(tmdbDataEntity, tmdbDataDto);

        logger.debug("Successfully converted common TMDB Entity to DTO for ID: {}", tmdbDataEntity.getId());
        return tmdbDataDto;
    }

    private void mapCollectionsEntityToDto(TmdbDataEntity tmdbDataEntity, TmdbDataDto tmdbDataDto) {
        // Genres
        if (tmdbDataEntity.getGenres() != null) {
            tmdbDataDto.setGenres(tmdbDataEntity.getGenres().stream()
                    .map(genresEntity -> modelMapper.map(genresEntity, GenresDto.class))
                    .toList());
        }

        // Production companies
        if (tmdbDataEntity.getProduction_companies() != null) {
            tmdbDataDto.setProduction_companies(tmdbDataEntity.getProduction_companies().stream()
                    .map(entity -> modelMapper.map(entity, ProductionCompaniesDto.class))
                    .toList());
        }

        // Production countries
        if (tmdbDataEntity.getProduction_countries() != null) {
            tmdbDataDto.setProduction_countries(tmdbDataEntity.getProduction_countries().stream()
                    .map(entity -> modelMapper.map(entity, ProductionCountriesDto.class))
                    .toList());
        }

        // Spoken languages
        if (tmdbDataEntity.getSpoken_languages() != null) {
            tmdbDataDto.setSpoken_languages(tmdbDataEntity.getSpoken_languages().stream()
                    .map(entity -> modelMapper.map(entity, SpokenLanguageDto.class))
                    .toList());
        }

        // Videos
        if (tmdbDataEntity.getVideos() != null) {
            tmdbDataDto.setVideos(tmdbDataEntity.getVideos().stream()
                    .map(videosEntity -> modelMapper.map(videosEntity, VideosDto.class))
                    .toList());
        }

        // Credits
        mapCreditsEntityToDto(tmdbDataEntity, tmdbDataDto);

        // Images
        mapImagesEntityToDto(tmdbDataEntity, tmdbDataDto);

        // Providers
        mapProvidersEntityToDto(tmdbDataEntity, tmdbDataDto);
    }

    private void mapCreditsEntityToDto(TmdbDataEntity tmdbDataEntity, TmdbDataDto tmdbDataDto) {
        if (tmdbDataEntity.getCredits() == null) return;

        CreditsDto creditsDto = new CreditsDto();
        CreditsEntity creditsEntity = tmdbDataEntity.getCredits();

        // Map cast
        if (creditsEntity.getCast() != null) {
            creditsDto.setCast(creditsEntity.getCast().stream()
                    .map(this::mapCastEntityToDto)
                    .toList());
        }

        // Map crew
        if (creditsEntity.getCrew() != null) {
            creditsDto.setCrew(creditsEntity.getCrew().stream()
                    .map(this::mapCrewEntityToDto)
                    .toList());
        }

        tmdbDataDto.setCredits(creditsDto);
    }

    private CastDto mapCastEntityToDto(CastEntity cast) {
        CastDto castDto = new CastDto();
        PersonEntity person = cast.getPerson();

        // Person fields
        castDto.setId(person.getId());
        castDto.setAdult(person.isAdult());
        castDto.setPopularity(person.getPopularity());
        castDto.setGender(person.getGender());
        castDto.setName(person.getName());
        castDto.setCredit_id(person.getCredit_id());
        castDto.setOriginal_name(person.getOriginal_name());
        castDto.setProfile_path(person.getProfile_path());
        castDto.setKnown_for_department(person.getKnown_for_department());

        // Cast specific fields
        castDto.setCast_id(cast.getCast_id());
        castDto.setCharacter(cast.getCharacter().getName());
        castDto.setOrder(cast.getOrder());

        return castDto;
    }

    private CrewDto mapCrewEntityToDto(CrewEntity crew) {
        CrewDto crewDto = new CrewDto();
        PersonEntity person = crew.getPerson();

        // Person fields
        crewDto.setId(person.getId());
        crewDto.setAdult(person.isAdult());
        crewDto.setPopularity(person.getPopularity());
        crewDto.setGender(person.getGender());
        crewDto.setName(person.getName());
        crewDto.setCredit_id(person.getCredit_id());
        crewDto.setOriginal_name(person.getOriginal_name());
        crewDto.setProfile_path(person.getProfile_path());
        crewDto.setKnown_for_department(person.getKnown_for_department());

        // Crew specific fields
        crewDto.setDepartment(crew.getDepartment().getName());
        crewDto.setJob(crew.getJob().getName());

        return crewDto;
    }

    private void mapImagesEntityToDto(TmdbDataEntity tmdbDataEntity, TmdbDataDto tmdbDataDto) {
        if (tmdbDataEntity.getImages() == null) return;

        ImagesDto imagesDto = new ImagesDto();

        List<Image> backdrops = new ArrayList<>();
        List<Image> posters = new ArrayList<>();
        List<Image> logos = new ArrayList<>();

        tmdbDataEntity.getImages().forEach(imageEntity -> {
            Image image = modelMapper.map(imageEntity, Image.class);

            if (imageEntity instanceof PosterImage) {
                posters.add(image);
            } else if (imageEntity instanceof LogoImage) {
                logos.add(image);
            } else if (imageEntity instanceof BackDropImage) {
                backdrops.add(image);
            }
        });

        imagesDto.setBackdrops(backdrops);
        imagesDto.setPosters(posters);
        imagesDto.setLogos(logos);
        tmdbDataDto.setImages(imagesDto);
    }

    private void mapProvidersEntityToDto(TmdbDataEntity tmdbDataEntity, TmdbDataDto tmdbDataDto) {
        if (tmdbDataEntity.getProviders() == null) return;

        ProvidersDto providersDto = new ProvidersDto();
        ProvidersEntity providersEntity = tmdbDataEntity.getProviders();

        if (providersEntity.getBuy() != null) {
            providersDto.setBuy(providersEntity.getBuy().stream()
                    .map(buyEntity -> modelMapper.map(buyEntity, ProviderDto.class))
                    .toList());
        }

        if (providersEntity.getRent() != null) {
            providersDto.setRent(providersEntity.getRent().stream()
                    .map(rentEntity -> modelMapper.map(rentEntity, ProviderDto.class))
                    .toList());
        }

        if (providersEntity.getFlatRate() != null) {
            providersDto.setFlatrate(providersEntity.getFlatRate().stream()
                    .map(flatRateEntity -> modelMapper.map(flatRateEntity, ProviderDto.class))
                    .toList());
        }

        tmdbDataDto.setProviders(providersDto);
    }
}