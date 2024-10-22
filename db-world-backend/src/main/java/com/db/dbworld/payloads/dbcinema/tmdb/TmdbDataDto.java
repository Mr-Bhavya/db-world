package com.db.dbworld.payloads.dbcinema.tmdb;

import com.db.dbworld.payloads.dbcinema.tmdb.credits.CreditsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.images.ImagesDto;
import com.db.dbworld.payloads.dbcinema.tmdb.provider.ProvidersDto;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;

import java.util.ArrayList;
import java.util.List;

@Data
public class TmdbDataDto {

    @Id
    private long id; //
    private String dbCinemaRecordId;
    private boolean adult; //
    private String backdrop_path; //
    private ArrayList<Genres> genres; //
    private String homepage; //
    private String original_language; //
    private String original_title; //original_name
    private String overview; //
    private double popularity; //
    private String poster_path; //
    private List<ProductionCompanies> production_companies; //
    private List<ProductionCountriesDto> production_countries; //
    private List<SpokenLanguageDto> spoken_languages; //
    private String status; //
    private String tagline; //
    private String title; //name
    private double vote_average; //
    private int vote_count; //
    private List<VideosDto> videos; //
    private ImagesDto images; //
    private CreditsDto credits; //
    private ProvidersDto providers; //

    @Getter
    @Setter
    @NoArgsConstructor
    private static class Genres {
        private int id;
        private String name;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class ProductionCompanies {
        private int id;
        private String logo_path;
        private String name;
        private String origin_country;
    }
}
