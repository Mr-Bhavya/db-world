package com.db.dbworld.utils;

import com.db.dbworld.entities.dbcinema.tmdb.*;
import com.db.dbworld.entities.dbcinema.tmdb.credits.CastEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.CreditsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.CrewEntity;
import com.db.dbworld.entities.dbcinema.tmdb.images.BackDropImage;
import com.db.dbworld.entities.dbcinema.tmdb.images.ImagesEntity;
import com.db.dbworld.entities.dbcinema.tmdb.images.LogoImage;
import com.db.dbworld.entities.dbcinema.tmdb.images.PosterImage;
import com.db.dbworld.entities.dbcinema.tmdb.providers.BuyEntity;
import com.db.dbworld.entities.dbcinema.tmdb.providers.FlatRateEntity;
import com.db.dbworld.entities.dbcinema.tmdb.providers.ProvidersEntity;
import com.db.dbworld.entities.dbcinema.tmdb.providers.RentEntity;
import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CastDto;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CrewDto;
import com.db.dbworld.payloads.dbcinema.tmdb.images.Image;
import com.db.dbworld.payloads.dbcinema.tmdb.provider.ProviderDto;
import com.db.dbworld.payloads.dbcinema.tmdb.provider.ProvidersDto;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class PojoConverter {

    @Autowired
    private ModelMapper modelMapper;

    public MovieTmdbDataEntity movieTmdbDtoToEntity(MovieTmdbDataDto movieTmdbDataDto, MovieTmdbDataEntity movieTmdbDataEntity) {

        movieTmdbDataEntity.setId(movieTmdbDataDto.getId());
        movieTmdbDataEntity.setAdult(movieTmdbDataDto.isAdult());
        movieTmdbDataEntity.setBackdrop_path(movieTmdbDataDto.getBackdrop_path());
        movieTmdbDataEntity.setHomepage(movieTmdbDataDto.getHomepage());
        movieTmdbDataEntity.setOriginal_language(movieTmdbDataDto.getOriginal_language());
        movieTmdbDataEntity.setOriginal_title(movieTmdbDataDto.getOriginal_title());
        movieTmdbDataEntity.setOverview(movieTmdbDataDto.getOverview());
        movieTmdbDataEntity.setPopularity(movieTmdbDataDto.getPopularity());
        movieTmdbDataEntity.setPoster_path(movieTmdbDataDto.getPoster_path());
        movieTmdbDataEntity.setStatus(movieTmdbDataDto.getStatus());
        movieTmdbDataEntity.setTagline(movieTmdbDataDto.getTagline());
        movieTmdbDataEntity.setVote_average(movieTmdbDataDto.getVote_average());
        movieTmdbDataEntity.setVote_count(movieTmdbDataDto.getVote_count());

        if (!movieTmdbDataDto.getProduction_companies().isEmpty()) {
            movieTmdbDataEntity.setProduction_companies(movieTmdbDataDto.getProduction_companies().stream().map(productionCompaniesDto ->
                    modelMapper.map(productionCompaniesDto, ProductionCompaniesEntity.class)
            ).toList());
        }

        if (!movieTmdbDataDto.getProduction_countries().isEmpty()) {
            movieTmdbDataEntity.setProduction_countries(movieTmdbDataDto.getProduction_countries().stream().map(productionCountriesDto ->
                    modelMapper.map(productionCountriesDto, ProductionCountriesEntity.class)
            ).toList());
        }

        if (!movieTmdbDataDto.getSpoken_languages().isEmpty()) {
            movieTmdbDataEntity.setSpoken_languages(movieTmdbDataDto.getSpoken_languages().stream().map(spokenLanguageDto ->
                    modelMapper.map(spokenLanguageDto, SpokenLanguageEntity.class)
            ).toList());
        }

        if (!movieTmdbDataDto.getVideos().isEmpty()) {
            movieTmdbDataEntity.setVideos(movieTmdbDataDto.getVideos().stream().map(videosDto ->
                    modelMapper.map(videosDto, VideosEntity.class)
            ).toList());
        }

        List<ImagesEntity> imagesEntities = new ArrayList<>();
        if (movieTmdbDataDto.getImages() != null) {

            List<Image> backdrops = movieTmdbDataDto.getImages().getBackdrops();
            List<Image> logos = movieTmdbDataDto.getImages().getLogos();
            List<Image> posters = movieTmdbDataDto.getImages().getPosters();

            if (!backdrops.isEmpty()) {
                backdrops.stream().forEach(image -> {
                    BackDropImage backDropImage = (BackDropImage) movieTmdbDataEntity.getImages().stream()
                            .filter(imagesEntity -> imagesEntity.getFile_path().equalsIgnoreCase(image.getFile_path()))
                            .findFirst().orElse(new BackDropImage());

                    backDropImage.setTmdbDataEntity(movieTmdbDataEntity);
                    backDropImage.setHeight(image.getHeight());
                    backDropImage.setWidth(image.getWidth());
                    backDropImage.setVote_average(image.getVote_average());
                    backDropImage.setVote_count(image.getVote_count());
                    backDropImage.setAspect_ratio(image.getAspect_ratio());

                    SpokenLanguageEntity spokenLanguage = new SpokenLanguageEntity();
                    spokenLanguage.setIso_639_1(image.getIso_639_1());
                    backDropImage.setIso_639_1(spokenLanguage);

                    imagesEntities.add(backDropImage);

                });
            }

            if (!logos.isEmpty()) {
                backdrops.stream().forEach(image -> {
                    LogoImage logoImage = (LogoImage) movieTmdbDataEntity.getImages().stream()
                            .filter(imagesEntity -> imagesEntity.getFile_path().equalsIgnoreCase(image.getFile_path()))
                            .findFirst().orElse(new BackDropImage());

                    logoImage.setTmdbDataEntity(movieTmdbDataEntity);
                    logoImage.setHeight(image.getHeight());
                    logoImage.setWidth(image.getWidth());
                    logoImage.setVote_average(image.getVote_average());
                    logoImage.setVote_count(image.getVote_count());
                    logoImage.setAspect_ratio(image.getAspect_ratio());

                    SpokenLanguageEntity spokenLanguage = new SpokenLanguageEntity();
                    spokenLanguage.setIso_639_1(image.getIso_639_1());
                    logoImage.setIso_639_1(spokenLanguage);

                    imagesEntities.add(logoImage);

                });
            }

            if (!posters.isEmpty()) {
                backdrops.stream().forEach(image -> {
                    PosterImage posterImage = (PosterImage) movieTmdbDataEntity.getImages().stream()
                            .filter(imagesEntity -> imagesEntity.getFile_path().equalsIgnoreCase(image.getFile_path()))
                            .findFirst().orElse(new BackDropImage());

                    posterImage.setTmdbDataEntity(movieTmdbDataEntity);
                    posterImage.setHeight(image.getHeight());
                    posterImage.setWidth(image.getWidth());
                    posterImage.setVote_average(image.getVote_average());
                    posterImage.setVote_count(image.getVote_count());
                    posterImage.setAspect_ratio(image.getAspect_ratio());

                    SpokenLanguageEntity spokenLanguage = new SpokenLanguageEntity();
                    spokenLanguage.setIso_639_1(image.getIso_639_1());
                    posterImage.setIso_639_1(spokenLanguage);

                    imagesEntities.add(posterImage);

                });
            }

            movieTmdbDataEntity.setImages(imagesEntities);

            movieTmdbDataEntity.setProduction_countries(movieTmdbDataDto.getProduction_countries().stream().map(productionCountriesDto ->
                    modelMapper.map(productionCountriesDto, ProductionCountriesEntity.class)
            ).toList());
        }

        if(movieTmdbDataDto.getCredits() != null){
            List<CastDto> castDtos = movieTmdbDataDto.getCredits().getCast();
            List<CrewDto> crewDtos = movieTmdbDataDto.getCredits().getCrew();

            List<CastEntity> castEntities = movieTmdbDataEntity.getCredits().getCast();
            List<CrewEntity> crewEntities = movieTmdbDataEntity.getCredits().getCrew();

//            TODO

//            CreditsEntity creditsEntity = movieTmdbDataEntity.getCredits();
//            if(creditsEntity != null){
//                castDtos.stream().forEach(castDto -> {
//                    creditsEntity.getCast().stream().filter(castEntity -> castEntity.getPerson().get == castDto.get)
//                });
//            }
        }

        ProvidersDto providersDto = movieTmdbDataDto.getProviders();
        ProvidersEntity providersEntity = movieTmdbDataEntity.getProviders();

        if(providersDto != null){
            List<ProviderDto> buyDtos = providersDto.getBuy();
            List<ProviderDto> rentDtos = providersDto.getRent();
            List<ProviderDto> flatrateDtos = providersDto.getFlatrate();

            if(!buyDtos.isEmpty()){
                List<BuyEntity> buyEntities = new ArrayList<>();
                if(providersEntity.getBuy().isEmpty()){
                    buyDtos.stream().forEach(providerDto -> {
                        BuyEntity buyEntity = new BuyEntity();
                        this.modelMapper.map(providerDto, buyEntity);
                        buyEntities.add(buyEntity);
                    });
                }else{
                    buyDtos.stream().forEach(providerDto -> {
                        BuyEntity buyEntity = providersEntity.getBuy().stream().filter(buy -> buy.getProvider_id() == providerDto.getProvider_id())
                                .findFirst().orElse(new BuyEntity());
                        this.modelMapper.map(providerDto, buyEntity);
                        buyEntities.add(buyEntity);
                    });
                }
            }

            if(!rentDtos.isEmpty()){
                List<RentEntity> rentEntities = new ArrayList<>();
                if(providersEntity.getRent().isEmpty()){
                    rentDtos.stream().forEach(providerDto -> {
                        RentEntity rentEntity = new RentEntity();
                        this.modelMapper.map(providerDto, rentEntity);
                        rentEntities.add(rentEntity);
                    });
                }else{
                    rentDtos.stream().forEach(providerDto -> {
                        RentEntity rentEntity = providersEntity.getRent().stream().filter(rent -> rent.getProvider_id() == providerDto.getProvider_id())
                                .findFirst().orElse(new RentEntity());
                        this.modelMapper.map(providerDto, rentEntity);
                        rentEntities.add(rentEntity);
                    });
                }
            }

            if(!flatrateDtos.isEmpty()){
                List<FlatRateEntity> flatRateEntities = new ArrayList<>();
                if(providersEntity.getFlatRate().isEmpty()){
                    rentDtos.stream().forEach(providerDto -> {
                        FlatRateEntity flatRateEntity = new FlatRateEntity();
                        this.modelMapper.map(providerDto, flatRateEntity);
                        flatRateEntities.add(flatRateEntity);
                    });
                }else{
                    rentDtos.stream().forEach(providerDto -> {
                        FlatRateEntity flatRateEntity = providersEntity.getFlatRate().stream().filter(rent -> rent.getProvider_id() == providerDto.getProvider_id())
                                .findFirst().orElse(new FlatRateEntity());
                        this.modelMapper.map(providerDto, flatRateEntity);
                        flatRateEntities.add(flatRateEntity);
                    });
                }
            }

        }

        movieTmdbDataEntity.setBudget(movieTmdbDataDto.getBudget());
        movieTmdbDataEntity.setImdb_id(movieTmdbDataDto.getImdb_id());
        movieTmdbDataEntity.setRelease_date(movieTmdbDataDto.getRelease_date());
        movieTmdbDataEntity.setRevenue(movieTmdbDataDto.getRevenue());
        movieTmdbDataEntity.setRuntime(movieTmdbDataDto.getRuntime());
        movieTmdbDataEntity.setVideo(movieTmdbDataDto.isVideo());


        return movieTmdbDataEntity;
    }

}
