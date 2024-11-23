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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PojoConverter {

    @Autowired
    private ModelMapper modelMapper;

    public DBCinemaRecordsDto dbCinemaRecordsEntityToDto(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        DBCinemaRecordsDto dbCinemaRecordsDto = new DBCinemaRecordsDto();
        dbCinemaRecordsDto.setRecordId(dbCinemaRecordsEntity.getId());
        dbCinemaRecordsDto.setType(dbCinemaRecordsEntity.getType());
        dbCinemaRecordsDto.setName(dbCinemaRecordsEntity.getName());
        dbCinemaRecordsDto.setShowOnTop(dbCinemaRecordsEntity.isShowOnTop());
        if (dbCinemaRecordsEntity.getTmdb() instanceof MovieTmdbDataEntity) {
            dbCinemaRecordsDto.setMovieTmdb(movieTmdbEntityToDto((MovieTmdbDataEntity) dbCinemaRecordsEntity.getTmdb()));
        } else {
            dbCinemaRecordsDto.setSeriesTmdb(seriesTmdbEntityToDto((SeriesTmdbDataEntity) dbCinemaRecordsEntity.getTmdb()));
        }
        dbCinemaRecordsDto.setLiked(dbCinemaRecordsEntity.isLiked());
        dbCinemaRecordsDto.setWatchListed(dbCinemaRecordsEntity.isWatchListed());
        dbCinemaRecordsDto.setWatched(dbCinemaRecordsEntity.isWatched());
        return dbCinemaRecordsDto;
    }

    public MovieTmdbDataEntity movieTmdbDtoToEntity(MovieTmdbDataDto movieTmdbDataDto, MovieTmdbDataEntity movieTmdbDataEntity) {

        movieTmdbDataEntity = (MovieTmdbDataEntity) tmdbCommonDtoToEntity(movieTmdbDataDto, movieTmdbDataEntity);

        //Movies Own filed update
        movieTmdbDataEntity.setBudget(movieTmdbDataDto.getBudget());
        movieTmdbDataEntity.setImdb_id(movieTmdbDataDto.getImdb_id());
        movieTmdbDataEntity.setRelease_date(movieTmdbDataDto.getRelease_date());
        movieTmdbDataEntity.setRevenue(movieTmdbDataDto.getRevenue());
        movieTmdbDataEntity.setRuntime(movieTmdbDataDto.getRuntime());
        movieTmdbDataEntity.setVideo(movieTmdbDataDto.isVideo());

        return movieTmdbDataEntity;
    }

    public SeriesTmdbDataEntity seriesTmdbDtoToEntity(SeriesTmdbDataDto seriesTmdbDataDto, SeriesTmdbDataEntity seriesTmdbDataEntity) {

        seriesTmdbDataEntity = (SeriesTmdbDataEntity) tmdbCommonDtoToEntity(seriesTmdbDataDto, seriesTmdbDataEntity);

        //Series Own filed update
        seriesTmdbDataEntity.setFirst_air_date(seriesTmdbDataDto.getFirst_air_date());
        seriesTmdbDataEntity.setType(seriesTmdbDataDto.getType());
        seriesTmdbDataEntity.setIn_production(seriesTmdbDataDto.isIn_production());
        seriesTmdbDataEntity.setLast_air_date(seriesTmdbDataDto.getLast_air_date());
        seriesTmdbDataEntity.setNumber_of_episodes(seriesTmdbDataDto.getNumber_of_episodes());
        seriesTmdbDataEntity.setNumber_of_seasons(seriesTmdbDataDto.getNumber_of_seasons());

        if(seriesTmdbDataDto.getSeasons() != null){
            seriesTmdbDataEntity.setSeasons(seriesTmdbDataDto.getSeasons().stream().map(season ->
                this.modelMapper.map(season, SeasonsEntity.class)
            ).collect(Collectors.toList()));
        }

        if(seriesTmdbDataDto.getNetworks() != null){
            seriesTmdbDataEntity.setNetworks(seriesTmdbDataDto.getNetworks().stream().map(
                    network -> modelMapper.map(network, NetworkEntity.class)
            ).collect(Collectors.toList()));
        }

        return seriesTmdbDataEntity;
    }

    public MovieTmdbDataDto movieTmdbEntityToDto(MovieTmdbDataEntity movieTmdbDataEntity) {

        MovieTmdbDataDto movieTmdbDataDto = (MovieTmdbDataDto) tmdbCommonEntityToDto(movieTmdbDataEntity, new MovieTmdbDataDto());

        //Movies Own filed update
        movieTmdbDataDto.setBudget(movieTmdbDataEntity.getBudget());
        movieTmdbDataDto.setImdb_id(movieTmdbDataEntity.getImdb_id());
        movieTmdbDataDto.setRelease_date(movieTmdbDataEntity.getRelease_date());
        movieTmdbDataDto.setRevenue(movieTmdbDataEntity.getRevenue());
        movieTmdbDataDto.setRuntime(movieTmdbDataEntity.getRuntime());
        movieTmdbDataDto.setVideo(movieTmdbDataEntity.isVideo());

        return movieTmdbDataDto;
    }

    public SeriesTmdbDataDto seriesTmdbEntityToDto(SeriesTmdbDataEntity seriesTmdbDataEntity) {

        SeriesTmdbDataDto seriesTmdbDataDto = (SeriesTmdbDataDto) tmdbCommonEntityToDto(seriesTmdbDataEntity, new SeriesTmdbDataDto());

        //Series Own filed update
        seriesTmdbDataDto.setFirst_air_date(seriesTmdbDataEntity.getFirst_air_date());
        seriesTmdbDataDto.setType(seriesTmdbDataEntity.getType());
        seriesTmdbDataDto.setIn_production(seriesTmdbDataEntity.isIn_production());
        seriesTmdbDataDto.setLast_air_date(seriesTmdbDataEntity.getLast_air_date());
        seriesTmdbDataDto.setNumber_of_episodes(seriesTmdbDataEntity.getNumber_of_episodes());
        seriesTmdbDataDto.setNumber_of_seasons(seriesTmdbDataEntity.getNumber_of_seasons());

        if(seriesTmdbDataEntity.getSeasons() != null){
            seriesTmdbDataDto.setSeasons(seriesTmdbDataEntity.getSeasons().stream().map(
                    seasonsEntity -> this.modelMapper.map(seasonsEntity, SeriesTmdbDataDto.Season.class)
            ).toList());
        }

        if(seriesTmdbDataEntity.getNetworks() != null){
            seriesTmdbDataDto.setNetworks(seriesTmdbDataEntity.getNetworks().stream().map(
                    networkEntity -> modelMapper.map(networkEntity, SeriesTmdbDataDto.Network.class)
            ).toList());
        }

        return seriesTmdbDataDto;
    }

    public TmdbDataEntity tmdbCommonDtoToEntity(TmdbDataDto tmdbDataDto, TmdbDataEntity tmdbDataEntity){

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

        if (tmdbDataDto.getGenres() != null) {
            tmdbDataEntity.setGenres(tmdbDataDto.getGenres().stream().map(genresDto ->
                    modelMapper.map(genresDto, GenresEntity.class)
            ).collect(Collectors.toList()));
        }

        if (tmdbDataDto.getProduction_companies() != null && !tmdbDataDto.getProduction_companies().isEmpty()) {
            tmdbDataEntity.setProduction_companies(tmdbDataDto.getProduction_companies().stream().map(productionCompaniesDto ->
                    modelMapper.map(productionCompaniesDto, ProductionCompaniesEntity.class)
            ).collect(Collectors.toList()));
        }

        if (tmdbDataDto.getProduction_countries() != null && !tmdbDataDto.getProduction_countries().isEmpty()) {
            tmdbDataEntity.setProduction_countries(tmdbDataDto.getProduction_countries().stream().map(productionCountriesDto ->
                    modelMapper.map(productionCountriesDto, ProductionCountriesEntity.class)
            ).collect(Collectors.toList()));
        }

        if (tmdbDataDto.getSpoken_languages() != null && !tmdbDataDto.getSpoken_languages().isEmpty()) {
            tmdbDataEntity.setSpoken_languages(tmdbDataDto.getSpoken_languages().stream().map(spokenLanguageDto ->
                    modelMapper.map(spokenLanguageDto, SpokenLanguageEntity.class)
            ).collect(Collectors.toList()));
        }

        if (tmdbDataDto.getVideos() != null && !tmdbDataDto.getVideos().isEmpty()) {
            tmdbDataEntity.setVideos(tmdbDataDto.getVideos().stream().map(videosDto ->
                    modelMapper.map(videosDto, VideosEntity.class)
            ).collect(Collectors.toList()));
        }

        List<ImagesEntity> imagesEntities = new ArrayList<>();
        if (tmdbDataDto.getImages() != null) {

            List<Image> backdrops = tmdbDataDto.getImages().getBackdrops();
            List<Image> logos = tmdbDataDto.getImages().getLogos();
            List<Image> posters = tmdbDataDto.getImages().getPosters();

            if (backdrops != null && !backdrops.isEmpty()) {
                backdrops.forEach(image -> {
                    if (tmdbDataEntity.getImages() != null) {
                        BackDropImage backDropImage = (BackDropImage) tmdbDataEntity.getImages().stream()
                                .filter(imagesEntity -> imagesEntity.getFile_path() != null && imagesEntity.getFile_path().equalsIgnoreCase(image.getFile_path()))
                                .findFirst().orElse(new BackDropImage());

                        backDropImage.setTmdbDataEntity(tmdbDataEntity);
                        backDropImage.setHeight(image.getHeight());
                        backDropImage.setWidth(image.getWidth());
                        backDropImage.setVote_average(image.getVote_average());
                        backDropImage.setVote_count(image.getVote_count());
                        backDropImage.setAspect_ratio(image.getAspect_ratio());

                        if (image.getIso_639_1() != null) {
                            SpokenLanguageEntity spokenLanguage = new SpokenLanguageEntity();
                            spokenLanguage.setIso_639_1(image.getIso_639_1());
                            backDropImage.setIso_639_1(spokenLanguage);
                        }
                        imagesEntities.add(backDropImage);
                    } else {
                        imagesEntities.add(modelMapper.map(image, BackDropImage.class));
                    }

                });
            }

            if (logos != null && !logos.isEmpty()) {
                logos.forEach(image -> {
                    if (tmdbDataEntity.getImages() != null) {
                        LogoImage logoImage = (LogoImage) tmdbDataEntity.getImages().stream()
                                .filter(imagesEntity -> imagesEntity.getFile_path() != null && imagesEntity.getFile_path().equalsIgnoreCase(image.getFile_path()))
                                .findFirst().orElse(new LogoImage());

                        logoImage.setTmdbDataEntity(tmdbDataEntity);
                        logoImage.setHeight(image.getHeight());
                        logoImage.setWidth(image.getWidth());
                        logoImage.setVote_average(image.getVote_average());
                        logoImage.setVote_count(image.getVote_count());
                        logoImage.setAspect_ratio(image.getAspect_ratio());

                        if (image.getIso_639_1() != null) {
                            SpokenLanguageEntity spokenLanguage = new SpokenLanguageEntity();
                            spokenLanguage.setIso_639_1(image.getIso_639_1());
                            logoImage.setIso_639_1(spokenLanguage);
                        }

                        imagesEntities.add(logoImage);
                    } else {
                        imagesEntities.add(modelMapper.map(image, LogoImage.class));
                    }

                });
            }

            if (posters != null && !posters.isEmpty()) {
                posters.forEach(image -> {
                    if (tmdbDataEntity.getImages() != null) {
                        PosterImage posterImage = (PosterImage) tmdbDataEntity.getImages().stream()
                                .filter(imagesEntity -> imagesEntity.getFile_path() != null && imagesEntity.getFile_path().equalsIgnoreCase(image.getFile_path()))
                                .findFirst().orElse(new PosterImage());

                        posterImage.setTmdbDataEntity(tmdbDataEntity);
                        posterImage.setHeight(image.getHeight());
                        posterImage.setWidth(image.getWidth());
                        posterImage.setVote_average(image.getVote_average());
                        posterImage.setVote_count(image.getVote_count());
                        posterImage.setAspect_ratio(image.getAspect_ratio());

                        if (image.getIso_639_1() != null) {
                            SpokenLanguageEntity spokenLanguage = new SpokenLanguageEntity();
                            spokenLanguage.setIso_639_1(image.getIso_639_1());
                            posterImage.setIso_639_1(spokenLanguage);
                        }

                        imagesEntities.add(posterImage);
                    } else {
                        imagesEntities.add(modelMapper.map(image, PosterImage.class));
                    }
                });
            }

            tmdbDataEntity.setImages(imagesEntities);

            tmdbDataEntity.setProduction_countries(tmdbDataDto.getProduction_countries().stream().map(productionCountriesDto ->
                    modelMapper.map(productionCountriesDto, ProductionCountriesEntity.class)
            ).collect(Collectors.toList()));
        }

        if (tmdbDataDto.getCredits() != null) {

            List<CastEntity> castEntities;
            List<CrewEntity> crewEntities;
            List<CastDto> castDtos = tmdbDataDto.getCredits().getCast();
            List<CrewDto> crewDtos = tmdbDataDto.getCredits().getCrew();

            if (tmdbDataEntity.getCredits() != null) {
                castEntities = tmdbDataEntity.getCredits().getCast();
                crewEntities = tmdbDataEntity.getCredits().getCrew();
            } else {
                tmdbDataEntity.setCredits(new CreditsEntity());
                crewEntities = new ArrayList<>();
                castEntities = new ArrayList<>();
            }

            if (castDtos != null && !castDtos.isEmpty()) {
                tmdbDataEntity.getCredits().setCast(castDtos.stream().map(castDto -> {
                    CastEntity newCastEntity = new CastEntity();
                    CharacterEntity characterEntity = new CharacterEntity();
                    characterEntity.setName(castDto.getCharacter());

                    newCastEntity.setPerson(this.modelMapper.map(castDto, PersonEntity.class));
                    newCastEntity.setCast_id(castDto.getCast_id());
                    newCastEntity.setCharacter(characterEntity);
                    newCastEntity.setOrder(castDto.getOrder());

                    if (castEntities != null && !castEntities.isEmpty()) {
                        return castEntities.stream().filter(cast -> cast.equals(newCastEntity))
                                .findFirst().orElse(newCastEntity);
                    } else {
                        return newCastEntity;
                    }
                }).collect(Collectors.toList()));
            }

            if (crewDtos != null && !crewDtos.isEmpty()) {
                tmdbDataEntity.getCredits().setCrew(crewDtos.stream().map(crewDto -> {

                    CrewEntity newCrewEntity = new CrewEntity();
                    JobEntity jobEntity = new JobEntity();
                    jobEntity.setName(crewDto.getJob());
                    DepartmentEntity departmentEntity = new DepartmentEntity();
                    departmentEntity.setName(crewDto.getDepartment());

                    newCrewEntity.setPerson(modelMapper.map(crewDto, PersonEntity.class));
                    newCrewEntity.setJob(jobEntity);
                    newCrewEntity.setDepartment(departmentEntity);

                    if (crewEntities != null && !crewEntities.isEmpty()) {
                        return crewEntities.stream().filter(crew -> crew.equals(newCrewEntity))
                                .findFirst().orElse(newCrewEntity);
                    } else {
                        return newCrewEntity;
                    }
                }).collect(Collectors.toList()));
            }

        }

        ProvidersDto providersDto = tmdbDataDto.getProviders();
        ProvidersEntity providersEntity = tmdbDataEntity.getProviders() == null ? new ProvidersEntity() : tmdbDataEntity.getProviders();

        if (providersDto != null) {
            List<ProviderDto> buyDtos = providersDto.getBuy();
            List<ProviderDto> rentDtos = providersDto.getRent();
            List<ProviderDto> flatrateDtos = providersDto.getFlatrate();

            if (buyDtos != null && !buyDtos.isEmpty()) {
                List<BuyEntity> buyEntities = new ArrayList<>();
                if (providersEntity.getBuy() == null || providersEntity.getBuy().isEmpty()) {
                    buyDtos.forEach(providerDto -> {
                        BuyEntity buyEntity = new BuyEntity();
                        this.modelMapper.map(providerDto, buyEntity);
                        buyEntities.add(buyEntity);
                    });
                } else {
                    buyDtos.forEach(providerDto -> {
                        BuyEntity buyEntity = providersEntity.getBuy().stream().filter(buy -> buy.getProvider_id() == providerDto.getProvider_id())
                                .findFirst().orElse(new BuyEntity());
                        this.modelMapper.map(providerDto, buyEntity);
                        buyEntities.add(buyEntity);
                    });
                }
                providersEntity.setBuy(buyEntities);
            }

            if (rentDtos != null && !rentDtos.isEmpty()) {
                List<RentEntity> rentEntities = new ArrayList<>();
                if (providersEntity.getRent() == null || providersEntity.getRent().isEmpty()) {
                    rentDtos.forEach(providerDto -> {
                        RentEntity rentEntity = new RentEntity();
                        this.modelMapper.map(providerDto, rentEntity);
                        rentEntities.add(rentEntity);
                    });
                } else {
                    rentDtos.forEach(providerDto -> {
                        RentEntity rentEntity = providersEntity.getRent().stream().filter(rent -> rent.getProvider_id() == providerDto.getProvider_id())
                                .findFirst().orElse(new RentEntity());
                        this.modelMapper.map(providerDto, rentEntity);
                        rentEntities.add(rentEntity);
                    });
                }
                providersEntity.setRent(rentEntities);
            }

            if (flatrateDtos != null && !flatrateDtos.isEmpty()) {
                List<FlatRateEntity> flatRateEntities = new ArrayList<>();
                if (providersEntity.getFlatRate() == null || providersEntity.getFlatRate().isEmpty()) {
                    flatrateDtos.forEach(providerDto -> {
                        FlatRateEntity flatRateEntity = new FlatRateEntity();
                        this.modelMapper.map(providerDto, flatRateEntity);
                        flatRateEntities.add(flatRateEntity);
                    });
                } else {
                    flatrateDtos.forEach(providerDto -> {
                        FlatRateEntity flatRateEntity = providersEntity.getFlatRate().stream().filter(rent -> rent.getProvider_id() == providerDto.getProvider_id())
                                .findFirst().orElse(new FlatRateEntity());
                        this.modelMapper.map(providerDto, flatRateEntity);
                        flatRateEntities.add(flatRateEntity);
                    });
                }
                providersEntity.setFlatRate(flatRateEntities);
            }
            tmdbDataEntity.setProviders(providersEntity);
        }

        return tmdbDataEntity;
    }

    public TmdbDataDto tmdbCommonEntityToDto(TmdbDataEntity tmdbDataEntity, TmdbDataDto tmdbDataDto) {

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

        if (tmdbDataEntity.getGenres() != null) {
            tmdbDataDto.setGenres(tmdbDataEntity.getGenres().stream().map(genresEntity ->
                    modelMapper.map(genresEntity, GenresDto.class)
            ).toList());
        }

        if(tmdbDataEntity.getProduction_companies() != null){
            tmdbDataDto.setProduction_companies(tmdbDataEntity.getProduction_companies().stream().map(
                    productionCompaniesEntity -> modelMapper.map(productionCompaniesEntity, ProductionCompaniesDto.class)
            ).toList());
        }

        if(tmdbDataEntity.getProduction_countries() != null){
            tmdbDataDto.setProduction_countries(tmdbDataEntity.getProduction_countries().stream().map(
                    productionCountriesEntity -> modelMapper.map(productionCountriesEntity, ProductionCountriesDto.class)
            ).toList());
        }

        if(tmdbDataEntity.getSpoken_languages() != null){
            tmdbDataDto.setSpoken_languages(tmdbDataEntity.getSpoken_languages().stream().map(
                    spokenLanguageEntity -> modelMapper.map(spokenLanguageEntity, SpokenLanguageDto.class)
            ).toList());
        }

        if (tmdbDataEntity.getCredits() != null) {
            CreditsDto creditsDto = new CreditsDto();

            if (tmdbDataEntity.getCredits().getCast() != null) {
                creditsDto.setCast(tmdbDataEntity.getCredits().getCast().stream().map(
                        cast -> {
                            CastDto castDto = new CastDto();
                            castDto.setId(cast.getPerson().getId());
                            castDto.setAdult(cast.getPerson().isAdult());
                            castDto.setPopularity(cast.getPerson().getPopularity());
                            castDto.setGender(cast.getPerson().getGender());
                            castDto.setName(cast.getPerson().getName());
                            castDto.setCredit_id(cast.getPerson().getCredit_id());
                            castDto.setOriginal_name(cast.getPerson().getOriginal_name());
                            castDto.setProfile_path(cast.getPerson().getProfile_path());
                            castDto.setKnown_for_department(cast.getPerson().getKnown_for_department());

                            castDto.setCast_id(cast.getCast_id());
                            castDto.setCharacter(cast.getCharacter().getName());
                            castDto.setOrder(cast.getOrder());
                            return castDto;
                        }
                ).toList());
            }

            if (tmdbDataEntity.getCredits().getCrew() != null) {
                creditsDto.setCrew(tmdbDataEntity.getCredits().getCrew().stream().map(
                        crew -> {
                            CrewDto crewDto = new CrewDto();
                            crewDto.setId(crew.getPerson().getId());
                            crewDto.setAdult(crew.getPerson().isAdult());
                            crewDto.setPopularity(crew.getPerson().getPopularity());
                            crewDto.setGender(crew.getPerson().getGender());
                            crewDto.setName(crew.getPerson().getName());
                            crewDto.setCredit_id(crew.getPerson().getCredit_id());
                            crewDto.setOriginal_name(crew.getPerson().getOriginal_name());
                            crewDto.setProfile_path(crew.getPerson().getProfile_path());
                            crewDto.setKnown_for_department(crew.getPerson().getKnown_for_department());

                            crewDto.setDepartment(crew.getDepartment().getName());
                            crewDto.setJob(crew.getJob().getName());
                            return crewDto;
                        }
                ).toList());
            }
            tmdbDataDto.setCredits(creditsDto);
        }

        if (tmdbDataEntity.getVideos() != null) {
            tmdbDataDto.setVideos(tmdbDataEntity.getVideos().stream().map(
                    videosEntity -> modelMapper.map(videosEntity, VideosDto.class)
            ).toList());
        }

        if (tmdbDataEntity.getImages() != null) {
            ImagesDto imagesDto = new ImagesDto();
            List<Image> backDropImages = new ArrayList<>();
            List<Image> posterImages = new ArrayList<>();
            List<Image> logoImages = new ArrayList<>();
            tmdbDataEntity.getImages().forEach(
                    imagesEntity -> {
                        if (imagesEntity instanceof PosterImage) {
                            posterImages.add(this.modelMapper.map(imagesEntity, Image.class));
                        }
                        if (imagesEntity instanceof LogoImage) {
                            logoImages.add(this.modelMapper.map(imagesEntity, Image.class));
                        }
                        if (imagesEntity instanceof BackDropImage) {
                            backDropImages.add(this.modelMapper.map(imagesEntity, Image.class));
                        }
                    }
            );
            imagesDto.setBackdrops(backDropImages);
            imagesDto.setPosters(posterImages);
            imagesDto.setLogos(logoImages);

            tmdbDataDto.setImages(imagesDto);
        }

        if (tmdbDataEntity.getProviders() != null) {
            ProvidersDto providersDto = new ProvidersDto();
            if (tmdbDataEntity.getProviders().getBuy() != null) {
                providersDto.setBuy(tmdbDataEntity.getProviders().getBuy().stream().map(
                        buyEntity -> this.modelMapper.map(buyEntity, ProviderDto.class)
                ).toList());
            }
            if (tmdbDataEntity.getProviders().getRent() != null) {
                providersDto.setRent(tmdbDataEntity.getProviders().getRent().stream().map(
                        rentEntity -> this.modelMapper.map(rentEntity, ProviderDto.class)
                ).toList());
            }
            if (tmdbDataEntity.getProviders().getFlatRate() != null) {
                providersDto.setFlatrate(tmdbDataEntity.getProviders().getFlatRate().stream().map(
                        flatRateEntity -> this.modelMapper.map(flatRateEntity, ProviderDto.class)
                ).toList());
            }
            tmdbDataDto.setProviders(providersDto);
        }

        return tmdbDataDto;
    }

}
