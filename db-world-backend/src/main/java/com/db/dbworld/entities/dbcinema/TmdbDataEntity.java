package com.db.dbworld.entities.dbcinema;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public abstract class TmdbDataEntity {

    @Id
    private long id;
    @Indexed(unique = true)
    private String dbCinemaRecordId;
    private boolean adult;
    private String backdrop_path;
    private ArrayList<Genres> genres;
    private String homepage;
    private String original_language;
    private String original_title;
    private String overview;
    private double popularity;
    private String poster_path;
    private ArrayList<ProductionCompanies> production_companies;
    private ArrayList<ProductionCountries> production_countries;
    private ArrayList<SpokenLanguage> spoken_languages;
    private String status;
    private String tagline;
    private String title;
    private double vote_average;
    private int vote_count;
    private ArrayList<Videos> videos;
    private Images images;
    private Credits credits;
    private Providers providers;

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

    @Getter
    @Setter
    @NoArgsConstructor
    private static class ProductionCountries {
        private String iso_3166_1;
        private String name;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class SpokenLanguage {
        private String english_name;
        private String iso_639_1;
        private String name;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class Images {
        private ArrayList<ImagesDetails> backdrops;
        private ArrayList<ImagesDetails> logos;
        private ArrayList<ImagesDetails> posters;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class ImagesDetails {
        private double aspect_ratio;
        private long height;
        private String iso_639_1;
        private String file_path;
        private double vote_average;
        private long vote_count;
        private long width;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class Videos {
        private String id;
        private String iso_639_1;
        private String iso_3166_1;
        private String name;
        private String key;
        private String site;
        private long size;
        private String type;
        private boolean official;
        private String published_at;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class Credits {
        private ArrayList<Credits.CastDetails> cast;
        private ArrayList<Credits.CrewDetails> crew;

        @Getter
        @Setter
        private static class CastDetails extends Credits.CreditDetails {
            private Long cast_id;
            private String character;
            private Long order;
        }

        @Getter
        @Setter
        private static class CrewDetails extends Credits.CreditDetails {
            private String department;
            private String job;
        }

        @Getter
        @Setter
        @NoArgsConstructor
        private static class CreditDetails {
            private boolean adult;
            private long gender;
            private long id;
            private String known_for_department;
            private String name;
            private String original_name;
            private double popularity;
            private String profile_path;
            private String credit_id;

        }

    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class Providers {

        private List<Provider> rent;
        private List<Provider> buy;
        private List<Provider> flatrate;

        @Getter
        @Setter
        @NoArgsConstructor
        private static class Provider {
            private long provider_id;
            private String logo_path;
            private String provider_name;
        }
    }
}
