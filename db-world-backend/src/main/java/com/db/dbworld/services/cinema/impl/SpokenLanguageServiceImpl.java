package com.db.dbworld.services.cinema.impl;

import com.db.dbworld.dao.dbcinema.tmdb.SpokenLanguageRepository;
import com.db.dbworld.entities.dbcinema.tmdb.SpokenLanguageEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.cinema.SpokenLanguageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;

import static com.db.dbworld.utils.DbWorldConstants.TMDB_LANGUAGES_CONFIGURATION_URL;

@Log4j2
@Service
public class SpokenLanguageServiceImpl implements SpokenLanguageService {

    @Autowired
    @Qualifier("tmdbRestTemplate")
    private RestTemplate tmdbRestTemplate;

    @Autowired
    private SpokenLanguageRepository spokenLanguageRepository;

    @Override
    public void updateLanguagesFromTMDB() {
        log.info("Fetching spoken languages from TMDB...");

        try {
            ResponseEntity<List<SpokenLanguageEntity>> response =
                    tmdbRestTemplate.exchange(
                            TMDB_LANGUAGES_CONFIGURATION_URL,
                            org.springframework.http.HttpMethod.GET,
                            null,
                            new ParameterizedTypeReference<>() {}
                    );

            List<SpokenLanguageEntity> languages = response.getBody();

            if (languages == null || languages.isEmpty()) {
                log.warn("No languages received from TMDB.");
                return;
            }

            spokenLanguageRepository.saveAll(languages);
            log.info("Saved {} spoken languages to database.", languages.size());

        } catch (Exception ex) {
            log.error("Failed to fetch/update spoken languages from TMDB", ex);
            throw new DbWorldException("Failed to fetch/update spoken languages from TMDB " + ex.getMessage());
        }
    }



}
