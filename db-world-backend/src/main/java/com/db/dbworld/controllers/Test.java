package com.db.dbworld.controllers;

import com.db.dbworld.dao.dbcinema.MovieTmdbDataRepository;
import com.db.dbworld.entities.dbcinema.MovieTmdbDataEntity;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.Credential;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.MovieTmdbDataDto;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.services.UtilsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonPrimitive;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping("/test")
public class Test {

    @Autowired
    RestTemplate restTemplate;

    @Autowired
    DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    MovieTmdbDataRepository movieTmdbDataRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private UtilsService utilsService;

    @GetMapping(value = "/1")
    public UserDto test1() {
        UserDto t = null;
        File file = new File("src/main/java/com/db/dbworld/entities/user_data.json");

        try {
            List<String> successIds = new ArrayList<>();
            List<String> failedIds = new ArrayList<>();
            AtomicInteger counter = new AtomicInteger();
//            Object usersJson = mapper.readValue(file, Object.class);
            String userJson = new String(Files.readAllBytes(Path.of("src/main/java/com/db/dbworld/entities/user_data.json")), StandardCharsets.UTF_8);
            JsonArray userArray = new Gson().fromJson(userJson, JsonArray.class);
//            userArray.asList().get()
            userArray.asList().forEach(
                    userJsonElement -> {
                        try {
                            counter.getAndIncrement();

                            UserDto userDto = new UserDto();


                            userDto.setUserId(userJsonElement.getAsJsonObject().get("_id").getAsString());
                            userDto.setFirstName(userJsonElement.getAsJsonObject().get("firstName").getAsString());
                            userDto.setLastName(userJsonElement.getAsJsonObject().get("lastName").getAsString());
//                            userDto.setAge(userJsonElement.getAsJsonObject().has("age") ? userJsonElement.getAsJsonObject().get("age").getAsInt() : null);
                            userDto.setDob(!userJsonElement.getAsJsonObject().has("dob") ? null : userJsonElement.getAsJsonObject().get("dob").getAsString());
                            userDto.setEmail(userJsonElement.getAsJsonObject().get("email").getAsString());
                            userDto.setGender(userJsonElement.getAsJsonObject().get("gender").getAsString());
                            userDto.setMobileNo(userJsonElement.getAsJsonObject().get("mobileNo").getAsLong());
                            userDto.setPassword(userJsonElement.getAsJsonObject().get("password").getAsString());

                            userService.createUser(userDto);
                            successIds.add(userDto.getUserId());
                        } catch (Exception ex) {
                            failedIds.add(String.valueOf(counter.get()));
                            System.out.println("====> " + counter.get() + " ====> Failed. =====> Error: " + ex.getMessage());
                        }
                    }
            );
            System.out.println(t);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return t;
    }

    @GetMapping(value = "/2")
    public List<Long> test2() {
        MovieTmdbDataDto t = null;
        AtomicInteger counter = new AtomicInteger();

        List<Long> successIds = new ArrayList<>();
        List<Long> failedIds = new ArrayList<>();

        Arrays.stream(DbWorldConstants.SeriesTmdbIds).forEach(
                tmdbId -> {
                    counter.getAndIncrement();
                    RequestPayloads.AddRecord record = new RequestPayloads.AddRecord();
                    record.setName("temp");
                    record.setType(DbWorldConstants.RECORD_TYPE_SERIES);
                    record.setTmdbId(tmdbId);

                    try {
                        dbCinemaRecordsService.addRecord(record);
                        successIds.add(tmdbId);
                        System.out.println("====> " + counter.get() + " -- TmdbId: " + tmdbId + " ====> Success.");
                    } catch (Exception e) {
                        failedIds.add(tmdbId);
                        System.out.println("====> " + counter.get() + " -- TmdbId: " + tmdbId + " ====> Failed. =====> Error: " + e.getMessage());
                    }

                    try {
                        Thread.sleep(1000 * 2); //2sec
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }

                }
        );

        System.out.println(successIds.toString());
        System.out.println(failedIds.toString());
        return successIds;
    }

    @GetMapping("/3")
    public String addRecordIdInTmdb() {
        System.out.println("fetching dbCinemaRecords");
        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsService.getRecords();
        AtomicInteger counter = new AtomicInteger();
        System.out.println("fetching dbCinemaRecords Done. /n updating in tmdb data");
        dbCinemaRecordsDtos.stream().forEach(dbCinemaRecordsDto -> {
            counter.getAndIncrement();
            MovieTmdbDataEntity movieTmdbDataEntity = movieTmdbDataRepository.findById(dbCinemaRecordsDto.getTmdbId()).get();
            movieTmdbDataEntity.setDbCinemaRecordId(dbCinemaRecordsDto.getRecordId());
            movieTmdbDataRepository.save(movieTmdbDataEntity);
            System.out.println(counter.get() + " ==> " + dbCinemaRecordsDto.getTmdbId() + " is updated.");
        });
        return "updated in " + counter.get() + " records";
    }

    @GetMapping("/4")
    public ApiResponse test4() throws IOException {

        List<RequestPayloads.AddCredential> credentials = new ArrayList<>();

        String credJson = new String(Files.readAllBytes(Path.of("D:\\Bhavya\\Workspace\\Intellij_Java\\db-world-webapp\\db-world-backend\\src\\main\\resources\\credential.json")), StandardCharsets.UTF_8);
        JsonArray credArray = new Gson().fromJson(credJson, JsonArray.class);
        credArray.forEach(jsonElement -> {
            AtomicReference<String> username = new AtomicReference<>();
            AtomicReference<String> password = new AtomicReference<>();
            AtomicReference<Long> pin = new AtomicReference<>();
            String host = null;
            JsonPrimitive hostObj = jsonElement.getAsJsonObject().getAsJsonPrimitive("host");
            JsonArray credHostArray = jsonElement.getAsJsonObject().getAsJsonArray("credentials").getAsJsonArray();
            credHostArray.forEach(credHost -> {
                username.set(credHost.getAsJsonObject().getAsJsonPrimitive("username").getAsString());
                password.set(credHost.getAsJsonObject().getAsJsonPrimitive("password").getAsString());
//                JsonObject pinElement = credHost.getAsJsonObject().get("pin").isJsonNull();
                pin.set(
                        credHost.getAsJsonObject().get("pin").isJsonNull()
                                ? 0l :
                                credHost.getAsJsonObject().getAsJsonPrimitive("pin").getAsLong());

                RequestPayloads.AddCredential credential = new RequestPayloads.AddCredential();
                credential.setUrl(hostObj.getAsString());
                credential.setUsername(username.get());
                credential.setPassword(password.get());
                credential.setPin(pin.get());

                credentials.add(credential);

            });
        });

        AtomicInteger count = new AtomicInteger();

        credentials.forEach(addCredential -> {
            Credential credential = new Credential();
            credential.setUsername(addCredential.getUsername());
            credential.setPassword(addCredential.getPassword());
            credential.setPin(addCredential.getPin());
            userService.addCredential("659d3b130956a22fcea25034", addCredential.getUrl(), credential);
            count.set(count.incrementAndGet());
        });

        System.out.println(count);

        return new ApiResponse(HttpStatus.OK, true, credentials);
    }

}
