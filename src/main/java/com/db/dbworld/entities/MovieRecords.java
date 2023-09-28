package com.db.dbworld.entities;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;

@Getter
@Setter
public class MovieRecords {
    private long id;
    private Db_World_Data db_world_data;
    private MovieTMDBData tmdbData;


    @Getter
    @Setter
    private class Db_World_Data{
        private String id;
        private String name;
        private Stream stream;
        private String ratting_count;
        private String ratting;
        private String watchlist_count;
        private String like_count;
        private String dislike_count;
        private ArrayList<Comment> comments;

        private class Stream{
            private ArrayList<Format> formats;
            private class Format{
                private String id;
                private String width;
                private String height;
                private String dynamic_range;
                private String url;
            }
        }

        private class Comment{
            private String id;
            private String comment_post_time_date;
            private String comment_post_by;
            private String comment_content;
        }

    }

}
