package com.db.dbworld.controllers;

import com.db.dbworld.entities.MovieTMDBData;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;

@RestController
@RequestMapping("/test")
public class Test {

    @GetMapping(value = "/1")
    public MovieTMDBData test1 (){
        MovieTMDBData t = null;
        File file = new File("src/main/java/com/db/dbworld/entities/MovieTMBDSamData.json");

        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
            t=mapper.readValue(file, MovieTMDBData.class);
            System.out.println(t);
        }catch (Exception e) {
            e.printStackTrace();
        }
        return t;
    }

}
