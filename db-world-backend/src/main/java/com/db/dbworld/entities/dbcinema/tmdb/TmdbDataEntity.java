package com.db.dbworld.entities.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.CreditsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.images.ImagesEntity;
import com.db.dbworld.entities.dbcinema.tmdb.providers.ProvidersEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
//@EqualsAndHashCode(of = "id")
@Table(name = "TMDB_DATA", schema = "db_world")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "record_type", discriminatorType = DiscriminatorType.STRING)
public class TmdbDataEntity {
    @Id
    private long id;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "db_cinema_record", referencedColumnName = "id")
    private DBCinemaRecordsEntity dbCinemaRecordsEntity;

    private boolean adult;
    private String backdrop_path;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(name = "tmdb_genres_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "genres_id"))
    private List<GenresEntity> genres;

    private String homepage;
    private String original_language;
    private String original_title;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String overview;

    private double popularity;
    private String poster_path;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(name = "tmdb_production_companies_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "production_companies_id"))
    private List<ProductionCompaniesEntity> production_companies;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(name = "tmdb_countries_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "countries_id"))
    private List<ProductionCountriesEntity> production_countries;

    @ManyToMany
    @JoinTable(name = "tmdb_spoken_languages_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "spoken_languages_id"))
    private List<SpokenLanguageEntity> spoken_languages;
    private String status;
    private String tagline;
    private String title;
    private double vote_average;
    private int vote_count;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private List<VideosEntity> videos;

    @OneToMany(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private List<ImagesEntity> images;

//    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST})
//    @JoinTable(name = "tmdb_credits_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
//            inverseJoinColumns = @JoinColumn(name = "credit_id"))
//    private List<CreditsEntity> credits;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "credits", referencedColumnName = "id")
    private CreditsEntity credits;

//    @OneToMany(mappedBy = "tmdb", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
//    private List<CastEntity> casts;


    //    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.MERGE})
//    @JoinTable(name = "tmdb_providers_mapping",
//            joinColumns = {@JoinColumn(name = "tmdb_id")},
//            inverseJoinColumns = {@JoinColumn(name = "provider_id")})
    @OneToOne(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinColumn(name = "providers", referencedColumnName = "id")
    private ProvidersEntity providers;


//    @Entity
//    public static class Images{
//        private List<BackDropImage> backDropImages;
//        private List<LogoImage> logoImages;
//        private List<PosterImage> posterImages;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class Genres {
//        private int id;
//        private String name;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class ProductionCompanies {
//        private int id;
//        private String logo_path;
//        private String name;
//        private String origin_country;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class ProductionCountries {
//        private String iso_3166_1;
//        private String name;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class SpokenLanguage {
//        private String english_name;
//        private String iso_639_1;
//        private String name;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class Images {
//        private ArrayList<Image> backdrops;
//        private ArrayList<Image> logos;
//        private ArrayList<Image> posters;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class Image {
//        private double aspect_ratio;
//        private long height;
//        private String iso_639_1;
//        private String file_path;
//        private double vote_average;
//        private long vote_count;
//        private long width;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class Videos {
//        private String id;
//        private String iso_639_1;
//        private String iso_3166_1;
//        private String name;
//        private String key;
//        private String site;
//        private long size;
//        private String type;
//        private boolean official;
//        private String published_at;
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class Credits {
//        private ArrayList<Credits.CastDetails> cast;
//        private ArrayList<Credits.CrewDetails> crew;
//
//        @Getter
//        @Setter
//        private static class CastDetails extends Credits.CreditDetails {
//            private Long cast_id;
//            private String character;
//            private Long order;
//        }
//
//        @Getter
//        @Setter
//        private static class CrewDetails extends Credits.CreditDetails {
//            private String department;
//            private String job;
//        }
//
//        @Getter
//        @Setter
//        @NoArgsConstructor
//        private static class CreditDetails {
//            private boolean adult;
//            private long gender;
//            private long id;
//            private String known_for_department;
//            private String name;
//            private String original_name;
//            private double popularity;
//            private String profile_path;
//            private String credit_id;
//
//        }
//
//    }
//
//    @Getter
//    @Setter
//    @NoArgsConstructor
//    private static class Providers {
//
//        private List<Provider> rent;
//        private List<Provider> buy;
//        private List<Provider> flatrate;
//
//        @Getter
//        @Setter
//        @NoArgsConstructor
//        private static class Provider {
//            private long provider_id;
//            private String logo_path;
//            private String provider_name;
//        }
//    }
}
