package com.db.dbworld.app.cinema.tmdb.media.mapper;

import com.db.dbworld.cinema.tmdb.client.dto.*;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapper;
import com.db.dbworld.cinema.tmdb.media.dto.*;
import com.db.dbworld.cinema.tmdb.media.entity.*;
import com.db.dbworld.cinema.tmdb.mapper.BaseMapperConfig;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.ArrayList;
import java.util.List;

@Mapper(config = BaseMapperConfig.class)
public interface ImageMapper extends BaseMapper<ImageDto, ImageEntity> {

    /* =====================================================
       CONCRETE DTO → ENTITY
     ===================================================== */

    BackdropImageEntity toEntity(BackdropImageDto dto);

    PosterImageEntity toEntity(PosterImageDto dto);

    LogoImageEntity toEntity(LogoImageDto dto);

    /* =====================================================
       DISPATCH DTO → ENTITY
     ===================================================== */

    @Override
    default ImageEntity toEntity(ImageDto dto) {

        if (dto == null) return null;

        if (dto instanceof BackdropImageDto backdrop) {
            return toEntity(backdrop);
        }

        if (dto instanceof PosterImageDto poster) {
            return toEntity(poster);
        }

        if (dto instanceof LogoImageDto logo) {
            return toEntity(logo);
        }

        throw new IllegalArgumentException(
                "Unsupported ImageDto type: " + dto.getClass()
        );
    }

    /* =====================================================
       ENTITY → DTO
     ===================================================== */

    BackdropImageDto toDto(BackdropImageEntity entity);

    PosterImageDto toDto(PosterImageEntity entity);

    LogoImageDto toDto(LogoImageEntity entity);

    @Override
    default ImageDto toDto(ImageEntity entity) {

        if (entity == null) return null;

        if (entity instanceof BackdropImageEntity backdrop) {
            return toDto(backdrop);
        }

        if (entity instanceof PosterImageEntity poster) {
            return toDto(poster);
        }

        if (entity instanceof LogoImageEntity logo) {
            return toDto(logo);
        }

        throw new IllegalArgumentException(
                "Unsupported ImageEntity type: " + entity.getClass()
        );
    }

    /* =====================================================
       TMDB → ENTITY
     ===================================================== */

    @Mapping(source = "file_path", target = "filePath")
    @Mapping(source = "aspect_ratio", target = "aspectRatio")
    @Mapping(source = "vote_average", target = "voteAverage")
    @Mapping(source = "vote_count", target = "voteCount")
    @Mapping(source = "iso_639_1", target = "iso6391")
    BackdropImageEntity fromTmdb(BackdropImageTmdbResponse response);

    @Mapping(source = "file_path", target = "filePath")
    @Mapping(source = "aspect_ratio", target = "aspectRatio")
    @Mapping(source = "vote_average", target = "voteAverage")
    @Mapping(source = "vote_count", target = "voteCount")
    @Mapping(source = "iso_639_1", target = "iso6391")
    PosterImageEntity fromTmdb(PosterImageTmdbResponse response);

    @Mapping(source = "file_path", target = "filePath")
    @Mapping(source = "aspect_ratio", target = "aspectRatio")
    @Mapping(source = "vote_average", target = "voteAverage")
    @Mapping(source = "vote_count", target = "voteCount")
    @Mapping(source = "iso_639_1", target = "iso6391")
    LogoImageEntity fromTmdb(LogoImageTmdbResponse response);

    /* =====================================================
       WRAPPER → ENTITY LIST
     ===================================================== */

    default List<ImageEntity> fromTmdb(ImagesTmdbResponse response) {

        if (response == null) return List.of();

        List<ImageEntity> images = new ArrayList<>();

        if (response.getBackdrops() != null) {
            response.getBackdrops().forEach(i -> images.add(fromTmdb(i)));
        }

        if (response.getPosters() != null) {
            response.getPosters().forEach(i -> images.add(fromTmdb(i)));
        }

        if (response.getLogos() != null) {
            response.getLogos().forEach(i -> images.add(fromTmdb(i)));
        }

        return images;
    }
}