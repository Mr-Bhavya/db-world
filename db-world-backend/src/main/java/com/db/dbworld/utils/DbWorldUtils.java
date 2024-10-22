package com.db.dbworld.utils;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.MovieTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.tmdb.SeriesTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.*;
import com.db.dbworld.entities.dbcinema.tmdb.images.BackDropImage;
import com.db.dbworld.entities.dbcinema.tmdb.images.ImagesEntity;
import com.db.dbworld.entities.dbcinema.tmdb.images.LogoImage;
import com.db.dbworld.entities.dbcinema.tmdb.images.PosterImage;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.tmdb.SeriesTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CastDto;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CreditsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.credits.CrewDto;
import com.db.dbworld.payloads.dbcinema.tmdb.images.Image;
import com.db.dbworld.payloads.dbcinema.tmdb.images.ImagesDto;
import com.db.dbworld.security.JwtHelper;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Service
@Log4j2
public class DbWorldUtils {

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtHelper jwtHelper;

    @Autowired
    private ModelMapper modelMapper;

    public byte[] serialize(Object obj) throws IOException {
        try (
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ObjectOutputStream os = new ObjectOutputStream(out)
        ) {
            os.writeObject(obj);
            return out.toByteArray();
        } catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }

    }

    public Object deserialize(byte[] data) {
        try (
                ByteArrayInputStream in = new ByteArrayInputStream(data);
                ObjectInputStream is = new ObjectInputStream(in);
        ) {
            return is.readObject();
        } catch (IOException | ClassNotFoundException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    public void checkRecordType(String type) {
        if (!type.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) && !type.equalsIgnoreCase((DbWorldConstants.RECORD_TYPE_SERIES))) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Record Type is not correct. Please Try again with valid record type.");
        }
    }

    public String getTMDBRecordDetailsUrl(RequestPayloads.AddRecord record) {
        return (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? DbWorldConstants.TMDB_MOVIE_DETAILS_URL : DbWorldConstants.TMDB_SERIES_DETAILS_URL).
                replace(DbWorldConstants.REPLACE_ID_STRING, Long.toString(record.getTmdbId()));
    }

    public String getTMDBByQueryUrl(String recordType, String query, int year) {
        return (recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? DbWorldConstants.TMDB_SEARCH_MOVIE_PROVIDER_URL : DbWorldConstants.TMDB_SEARCH_SERIES_PROVIDER_URL).
                replace(DbWorldConstants.REPLACE_QUERY_STRING, query).replace(DbWorldConstants.REPLACE_YEAR_STRING, year == 0 ? "" : String.valueOf(year));
    }

    public String getTMDBRecordProviderUrl(RequestPayloads.AddRecord record) {
        return (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? DbWorldConstants.TMDB_MOVIE_PROVIDER_URL : DbWorldConstants.TMDB_SERIES_PROVIDER_URL).
                replace(DbWorldConstants.REPLACE_ID_STRING, Long.toString(record.getTmdbId()));
    }

    public List<String> readFileInList(String filePath) {
        try {
            return Files.readAllLines(Paths.get(filePath), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    public String decodeFileName(String encodedString) {
        String decodString = null;
        if (encodedString != null) {
            decodString = URLDecoder.decode(encodedString.replace("+", "%2B"), StandardCharsets.UTF_8);
            decodString = decodString.replace("%2B", "+");
            if (decodString.contains("/")) {
                decodString = decodString.replace("/", "").replace("|", "");
            }
        } else {
            throw new DbWorldException("Encoded String is null");
        }
        return decodString;
    }

    public void deleteFile(String path) {
        if (path == null || path.isEmpty()) {
            log.error("Path is null for delete operation.");
        } else {
            try {
                Files.delete(Path.of(path));
            } catch (IOException e) {
                log.error("Failed to delete file/folder: {}, Error: {}", path, e.getMessage());
            }
        }
    }

    public String getUserFromToken(String token) {
        String username = null;
        String errorMessage = null;
        try {
            username = this.jwtHelper.getUsernameFromToken(token);
        } catch (IllegalArgumentException e) {
            errorMessage = "Illegal Argument while fetching the username !!";
        } catch (ExpiredJwtException e) {
            errorMessage = "Given jwt token is expired !!";
        } catch (MalformedJwtException e) {
            errorMessage = "Some changed has done in token !! Invalid Token";
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }

        if (errorMessage != null) {
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, errorMessage);
        }
        return username;
    }

    public DBCinemaRecordsDto convertDbCinemaRecordEntityToDto(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        DBCinemaRecordsDto dbCinemaRecordsDto = this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class);
        dbCinemaRecordsDto.setRecordId(dbCinemaRecordsEntity.getId());
        if(dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)){
            dbCinemaRecordsDto.setMovieTmdb(convertMovieTmdbEntityToDto((MovieTmdbDataEntity) dbCinemaRecordsEntity.getTmdb()));
        }else if(dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)){
            dbCinemaRecordsDto.setSeriesTmdb(convertSeriesTmdbEntityToDto((SeriesTmdbDataEntity) dbCinemaRecordsEntity.getTmdb()));
        }
        return dbCinemaRecordsDto;
    }

    public SeriesTmdbDataEntity convertSeriesTmdbDtoToEntity(SeriesTmdbDataDto seriesTmdbDataDto) {
        SeriesTmdbDataEntity seriesTmdbDataEntity = this.modelMapper.map(seriesTmdbDataDto, SeriesTmdbDataEntity.class);
        seriesTmdbDataEntity.setImages(convertImageDtoToEntity(seriesTmdbDataDto.getImages()));
        seriesTmdbDataEntity.getCredits().setCast(convertCastDtoToEntity(seriesTmdbDataDto.getCredits()));
        seriesTmdbDataEntity.getCredits().setCrew(convertCrewDtoToEntity(seriesTmdbDataDto.getCredits()));
        return seriesTmdbDataEntity;
    }

    public SeriesTmdbDataDto convertSeriesTmdbEntityToDto(SeriesTmdbDataEntity seriesTmdbDataEntity) {
        SeriesTmdbDataDto seriesTmdbDataDto = this.modelMapper.map(seriesTmdbDataEntity, SeriesTmdbDataDto.class);
        seriesTmdbDataDto.setImages(convertImageEntityToDto(seriesTmdbDataEntity.getImages()));
        seriesTmdbDataDto.setCredits(convertCastCrewEntityToDto(seriesTmdbDataEntity.getCredits()));
        seriesTmdbDataDto.setSeasons(seriesTmdbDataEntity.getSeasons().stream().map(
                seasonsEntity -> this.modelMapper.map(seasonsEntity, SeriesTmdbDataDto.Season.class)
        ).toList());
        return seriesTmdbDataDto;
    }

    public MovieTmdbDataDto convertMovieTmdbEntityToDto(MovieTmdbDataEntity movieTmdbDataEntity) {
        MovieTmdbDataDto movieTmdbDataDto = this.modelMapper.map(movieTmdbDataEntity, MovieTmdbDataDto.class);
        movieTmdbDataDto.setImages(convertImageEntityToDto(movieTmdbDataEntity.getImages()));
        movieTmdbDataDto.setCredits(convertCastCrewEntityToDto(movieTmdbDataEntity.getCredits()));
        return movieTmdbDataDto;
    }

    public MovieTmdbDataEntity convertMovieTmdbDtoToEntity(MovieTmdbDataDto movieTmdbDataDto) {
        MovieTmdbDataEntity movieTmdbDataEntity = this.modelMapper.map(movieTmdbDataDto, MovieTmdbDataEntity.class);
        movieTmdbDataEntity.setImages(convertImageDtoToEntity(movieTmdbDataDto.getImages()));
        movieTmdbDataEntity.getCredits().setCrew(convertCrewDtoToEntity(movieTmdbDataDto.getCredits()));
        movieTmdbDataEntity.getCredits().setCast(convertCastDtoToEntity(movieTmdbDataDto.getCredits()));
        return movieTmdbDataEntity;
    }

    private CreditsDto convertCastCrewEntityToDto(CreditsEntity creditsEntity) {
        CreditsDto creditsDto = new CreditsDto();
        if(creditsEntity != null ) {
            List<CastEntity> casts = creditsEntity.getCast();
            List<CrewEntity> crews = creditsEntity.getCrew();
            if(casts != null){
                creditsDto.setCast(casts.stream().map(
                        cast -> {
                            CastDto castDto = this.modelMapper.map(cast.getPerson(), CastDto.class);
                            castDto.setCharacter(cast.getCharacter().getName());
                            castDto.setOrder(cast.getOrder());
                            return castDto;
                        }
                ).toList());
            }
            if(crews != null){
                creditsDto.setCrew(crews.stream().map(
                        recordCrewEntity -> {
                            CrewDto crewDto = this.modelMapper.map(recordCrewEntity.getPerson(), CrewDto.class);
                            crewDto.setDepartment(recordCrewEntity.getDepartment().getName());
                            crewDto.setJob(recordCrewEntity.getJob().getName());
                            return crewDto;
                        }
                ).toList());
            }
        }
        return creditsDto;
    }

    private ImagesDto convertImageEntityToDto(List<ImagesEntity> imagesEntities) {
        ImagesDto imagesDto = new ImagesDto();
        if (imagesEntities != null && !imagesEntities.isEmpty()) {
            List<Image> backdrops = imagesEntities.stream()
                    .filter(BackDropImage.class::isInstance) // Filter by BackDropImage
                    .map(imagesEntity -> this.modelMapper.map(imagesEntity, Image.class))
                    .toList();

            List<Image> logos = imagesEntities.stream()
                    .filter(LogoImage.class::isInstance) // Filter by PosterImage
                    .map(imagesEntity -> this.modelMapper.map(imagesEntity, Image.class))
                    .toList();

            List<Image> posters = imagesEntities.stream()
                    .filter(PosterImage.class::isInstance) // Filter by PosterImage
                    .map(imagesEntity -> this.modelMapper.map(imagesEntity, Image.class))
                    .toList();

            imagesDto.setBackdrops(backdrops);
            imagesDto.setLogos(logos);
            imagesDto.setPosters(posters);
        }
        return imagesDto;
    }

    private List<ImagesEntity> convertImageDtoToEntity(ImagesDto imagesDto) {
        List<ImagesEntity> imagesEntities = new ArrayList<>();
        if (imagesDto != null && imagesDto.getBackdrops() != null) {
            imagesEntities.addAll(imagesDto.getBackdrops().stream().map(
                    Image -> modelMapper.map(Image, BackDropImage.class)
            ).toList());
        }
        if (imagesDto != null && imagesDto.getLogos() != null) {
            imagesEntities.addAll(imagesDto.getLogos().stream().map(
                    Image -> modelMapper.map(Image, LogoImage.class)
            ).toList());
        }
        if (imagesDto != null && imagesDto.getPosters() != null) {
            imagesEntities.addAll(imagesDto.getPosters().stream().map(
                    Image -> modelMapper.map(Image, PosterImage.class)
            ).toList());
        }
        return imagesEntities;
    }

    private List<CrewEntity> convertCrewDtoToEntity(CreditsDto creditsDto) {
        if(creditsDto.getCrew() == null){
            return new ArrayList<>();
        }
        return creditsDto.getCrew().stream().map(
                crewDto -> {
                    CrewEntity crewEntity = new CrewEntity();
                    PersonEntity personEntity = this.modelMapper.map(crewDto, PersonEntity.class);
                    crewEntity.setPerson(personEntity);

                    JobEntity jobEntity = new JobEntity();
                    jobEntity.setName(crewDto.getJob());
                    crewEntity.setJob(jobEntity);

                    DepartmentEntity departmentEntity = new DepartmentEntity();
                    departmentEntity.setName(crewDto.getDepartment());
                    crewEntity.setDepartment(departmentEntity);

                    return crewEntity;
                }
        ).toList();
    }

    private List<CastEntity> convertCastDtoToEntity(CreditsDto creditsDto) {
        if(creditsDto.getCast() == null){
            return new ArrayList<>();
        }
        return creditsDto.getCast().stream().map(
                castDto -> {
                    CastEntity cast = new CastEntity();
                    PersonEntity personEntity = this.modelMapper.map(castDto, PersonEntity.class);
                    cast.setPerson(personEntity);

                    CharacterEntity characterEntity = new CharacterEntity();
                    characterEntity.setName(castDto.getCharacter());
                    cast.setCharacter(characterEntity);

                    cast.setOrder(castDto.getOrder());

                    return cast;
                }
        ).toList();
    }

}
