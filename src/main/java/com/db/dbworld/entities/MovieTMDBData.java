package com.db.dbworld.entities;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;


@Getter
@Setter
@NoArgsConstructor
public class MovieTMDBData {

    private long id;
    private boolean adult;
    private String backdrop_path;
    private String belongs_to_collection;
    private long budget;
    private ArrayList<Genres> genres = new ArrayList<>();
    private String homepage;
    private String imdb_id;
    private String original_language;
    private String original_title;
    private String overview;
    private double popularity;
    private String poster_path;
    private ArrayList<ProductionCompanies> production_companies = new ArrayList<>();
    private ArrayList<ProductionCountries> production_countries = new ArrayList<>();
    private String release_date;
    private long revenue;
    private int runtime;
    private ArrayList<SpokenLanguage> spoken_languages = new ArrayList<>();
    private String status;
    private String tagline;
    private String title;
    private boolean video;
    private double vote_average;
    private int vote_count;
    private ArrayList<Videos> videos;
    private Images images;

    private Credits credits;

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
        private String published_at; //if OffsetDateTime didn't work then convert it into String object
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class Credits {
        private ArrayList<CastDetails> cast;
        private ArrayList<CrewDetails> crew;

        @Getter
        @Setter
        private static class CastDetails extends CreditDetails {
            private Long cast_id;
            private String character;
            private Long order;
        }

        @Getter
        @Setter
        private static class CrewDetails extends CreditDetails {
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


//    According to tmdb response
//    public class Videos {
//        private VideoResult[] results;
//
//        public class VideoResult {
//            private String iso639_1;
//            private String iso3166_1;
//            private String name;
//            private String key;
//            private String site;
//            private long size;
//            private String type;
//            private boolean official;
//            private OffsetDateTime publishedAt; //if OffsetDateTime didn't work then convert it into String object
//            private String id;
//        }
//    }

}
