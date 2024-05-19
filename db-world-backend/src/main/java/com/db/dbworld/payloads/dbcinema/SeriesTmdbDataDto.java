package com.db.dbworld.payloads.dbcinema;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;

@Data
@Document("SERIES_TMDB_DATA")
@EqualsAndHashCode(callSuper = true)
public class SeriesTmdbDataDto extends TmdbDataDto {

    public ArrayList<CreatedBy> created_by;
    public ArrayList<Integer> episode_run_time;
    public String first_air_date;
    public boolean in_production;
    public ArrayList<String> languages;
    public String last_air_date;
    public LastEpisodeToAir last_episode_to_air;
    public Object next_episode_to_air;
    public ArrayList<Network> networks;
    public int number_of_episodes;
    public int number_of_seasons;
    public ArrayList<Season> seasons;
    public String type;

    @Data
    public static class CreatedBy{
        public int id;
        public String credit_id;
        public String name;
        public int gender;
        public String profile_path;
    }

    @Data
    public static class LastEpisodeToAir{
        public int id;
        public String name;
        public String overview;
        public double vote_average;
        public int vote_count;
        public String air_date;
        public int episode_number;
        public String episode_type;
        public String production_code;
        public int runtime;
        public int season_number;
        public int show_id;
        public String still_path;
    }

    @Data
    public static class Network{
        public int id;
        public String logo_path;
        public String name;
        public String origin_country;
    }

    @Data
    public static class Season{
        public String air_date;
        public int episode_count;
        public int id;
        public String name;
        public String overview;
        public String poster_path;
        public int season_number;
        public double vote_average;
    }

}
