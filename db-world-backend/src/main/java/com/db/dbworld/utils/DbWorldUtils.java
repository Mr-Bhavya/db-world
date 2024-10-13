package com.db.dbworld.utils;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.security.JwtHelper;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;

@Service
@Log4j2
public class DbWorldUtils {

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtHelper jwtHelper;

    public byte[] serialize(Object obj) throws IOException {
        try (
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ObjectOutputStream os = new ObjectOutputStream(out)
        ) {
            os.writeObject(obj);
            return out.toByteArray();
        } catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }

    }

    public Object deserialize(byte[] data) {
        try (
                ByteArrayInputStream in = new ByteArrayInputStream(data);
                ObjectInputStream is = new ObjectInputStream(in);
        ) {
            return is.readObject();
        } catch (IOException | ClassNotFoundException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    public Update createMongoDbUpdateObject(HashMap<String, Object> hashMap) {
        Update update = new Update();
        hashMap.forEach(update::set);
        return update;
    }

    public void checkRecordType(String type) {
        if (!type.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) && !type.equalsIgnoreCase((DbWorldConstants.RECORD_TYPE_SERIES))) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Record Type is not correct. Please Try again with valid record type.");
        }
    }

    public String getTMDBRecordDetailsUrl(RequestPayloads.AddRecord record) {
        return (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? DbWorldConstants.TMDB_MOVIE_DETAILS_URL : DbWorldConstants.TMDB_SERIES_DETAILS_URL).
                replace(DbWorldConstants.REPLACE_ID_STRING, Long.toString(record.getTmdbId()));
    }

    public String getTMDBByQueryUrl(String recordType, String query, int year) {
        return (recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? DbWorldConstants.TMDB_SEARCH_MOVIE_PROVIDER_URL : DbWorldConstants.TMDB_SEARCH_SERIES_PROVIDER_URL).
                replace(DbWorldConstants.REPLACE_QUERY_STRING, query).replace(DbWorldConstants.REPLACE_YEAR_STRING, year == 0 ? "" : String.valueOf(year) );
    }

    public String getTMDBRecordProviderUrl(RequestPayloads.AddRecord record) {
        return (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? DbWorldConstants.TMDB_MOVIE_PROVIDER_URL : DbWorldConstants.TMDB_SERIES_PROVIDER_URL).
                replace(DbWorldConstants.REPLACE_ID_STRING, Long.toString(record.getTmdbId()));
    }

    public List readFileInList(String filePath)
    {
        try {
            return Files.readAllLines(Paths.get(filePath), StandardCharsets.UTF_8);
        }
        catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    public String decodeFileName(String encodedString){
        String decodString = null;
        if(encodedString!=null){
            encodedString.replace("+", "%2B");
            decodString = URLDecoder.decode(encodedString.replace("+", "%2B"), StandardCharsets.UTF_8);
            decodString = decodString.replace("%2B", "+");
            if(decodString.contains("/")){
                decodString = decodString.replace("/","").replace("|","");
            }
        }else{
            throw new DbWorldException("Encoded String is null");
        }
        return decodString;
    }

    public String getTokenFromHttpRequest (HttpServletRequest request){
        String bearerToken = request.getHeader("Authorization");
        return bearerToken.substring(7);
    }

    public void deleteFile(String path){
        if(path == null || path.isEmpty()){
            log.error("Path is null for delete operation.");
        }else{
            try {
                Files.delete(Path.of(path));
            } catch (IOException e) {
                log.error("Failed to delete file/folder: {}, Error: {}", path, e.getMessage());
            }
        }
    }

    public String getUserFromToken(String token){
        String username = null;
        String errorMessage = null;
        try {
            username = this.jwtHelper.getUsernameFromToken(token);
        } catch (IllegalArgumentException e) {
            errorMessage = "Illegal Argument while fetching the username !!";
        } catch (ExpiredJwtException e) {
            errorMessage = "Given jwt token is expired !!";
        } catch (MalformedJwtException e) {
            errorMessage = "Some changed has done in token !! Invalid Token";
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }

        if(errorMessage != null){
            throw new DbWorldException(HttpStatus.UNAUTHORIZED, errorMessage);
        }
        return username;
    }

}
