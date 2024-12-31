package com.db.dbworld.entities.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.providers.NetworkEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@DiscriminatorValue("series")
public class SeriesTmdbDataEntity extends TmdbDataEntity {

    private String first_air_date;
    private String type;
    private boolean in_production;
    private String last_air_date;
    private int number_of_episodes;
    private int number_of_seasons;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    public List<SeasonsEntity> seasons;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(name = "tmdb_network_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "network_id"))
    public List<NetworkEntity> networks;

//    public ArrayList<CreatedBy> created_by;
//    public ArrayList<Integer> episode_run_time;
//    public ArrayList<String> languages;
//    public LastEpisodeToAir last_episode_to_air;
//    public Object next_episode_to_air;
//    public ArrayList<Network> networks;



//    @Data
//    public static class CreatedBy{
//        public int id;
//        public String credit_id;
//        public String name;
//        public int gender;
//        public String profile_path;
//    }
//
//    @Data
//    public static class LastEpisodeToAir{
//        public int id;
//        public String name;
//        public String overview;
//        public double vote_average;
//        public int vote_count;
//        public String air_date;
//        public int episode_number;
//        public String episode_type;
//        public String production_code;
//        public int runtime;
//        public int season_number;
//        public int show_id;
//        public String still_path;
//    }
//
//    @Data
//    public static class Network{
//        public int id;
//        public String logo_path;
//        public String name;
//        public String origin_country;
//    }

}
