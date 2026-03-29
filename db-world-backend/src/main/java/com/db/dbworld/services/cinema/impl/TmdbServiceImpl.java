//package com.db.dbworld.services.cinema.impl;
//
//import com.db.dbworld.dao.dbcinema.tmdb.*;
//import com.db.dbworld.entities.dbcinema.tmdb.*;
//import com.db.dbworld.entities.dbcinema.tmdb.credits.*;
//import com.db.dbworld.entities.dbcinema.tmdb.images.ImagesEntity;
//import com.db.dbworld.services.cinema.TmdbService;
//import jakarta.persistence.EntityManager;
//import jakarta.persistence.PersistenceContext;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//
//import java.util.List;
//import java.util.Map;
//import java.util.Objects;
//import java.util.Set;
//import java.util.stream.Collectors;
//
//@Service
//@Transactional
//public class TmdbServiceImpl implements TmdbService {
//
//    @Autowired
//    private SpokenLanguageRepository spokenLanguageRepository;
//
//    @Autowired
//    private ProductionCountriesRepository productionCountriesRepository;
//
//    @Autowired
//    private ProductionCompaniesRepository productionCompaniesRepository;
//
//    @Autowired
//    private PersonRepository personRepository;
//
//    @Autowired
//    private DepartmentRepository departmentRepository;
//
//    @Autowired
//    private JobRepository jobRepository;
//
//    @Autowired
//    private CharacterRepository characterRepository;
//
//    @PersistenceContext
//    private EntityManager entityManager;
//
//    @Override
//    public TmdbDataEntity mergeTmdbEntity(TmdbDataEntity tmdbDataEntity) {
//        mergeSpokenLanguages(tmdbDataEntity.getSpoken_languages());
//        mergeProductionCountries(tmdbDataEntity.getProduction_countries());
//        mergeProductionCompanies(tmdbDataEntity.getProduction_companies());
//        mergeVideos(tmdbDataEntity.getVideos());
//        mergeImages(tmdbDataEntity.getImages());
//        mergeCredits(tmdbDataEntity.getCredits());
//
//        return entityManager.merge(tmdbDataEntity);
//    }
//
//    private void mergeSpokenLanguages(List<SpokenLanguageEntity> spokenLanguages) {
//        if (spokenLanguages == null || spokenLanguages.isEmpty()) {
//            return;
//        }
//
//        Set<String> languageCodes = spokenLanguages.stream()
//                .map(SpokenLanguageEntity::getIso_639_1)
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        Map<String, SpokenLanguageEntity> existingLanguages = spokenLanguageRepository.findMapByCodes(languageCodes);
//
//        spokenLanguages.forEach(language -> {
//            SpokenLanguageEntity existing = existingLanguages.get(language.getIso_639_1());
//            if (existing != null) {
//                // Update the existing entity with new data if needed
////                entityManager.merge(existing);
//            } else {
//                entityManager.persist(language);
//            }
//        });
//    }
//
//    private void mergeProductionCountries(List<ProductionCountriesEntity> productionCountries) {
//        if (productionCountries == null || productionCountries.isEmpty()) {
//            return;
//        }
//
//        Set<String> countryCodes = productionCountries.stream()
//                .map(ProductionCountriesEntity::getIso_3166_1)
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        Map<String, ProductionCountriesEntity> existingCountries = productionCountriesRepository.findMapByCodes(countryCodes);
//
//        productionCountries.forEach(country -> {
//            ProductionCountriesEntity existing = existingCountries.get(country.getIso_3166_1());
//            if (existing != null) {
//                entityManager.merge(existing);
//            } else {
//                entityManager.persist(country);
//            }
//        });
//    }
//
//    private void mergeProductionCompanies(List<ProductionCompaniesEntity> productionCompanies) {
//        if (productionCompanies == null || productionCompanies.isEmpty()) {
//            return;
//        }
//
//        Set<Integer> companyIds = productionCompanies.stream()
//                .map(ProductionCompaniesEntity::getId)
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        Map<Integer, ProductionCompaniesEntity> existingCompanies = productionCompaniesRepository.findMapByIds(companyIds);
//
//        productionCompanies.forEach(company -> {
//            ProductionCompaniesEntity existing = existingCompanies.get(company.getId());
//            if (existing != null) {
//                entityManager.merge(existing);
//            } else {
//                entityManager.persist(company);
//            }
//        });
//    }
//
//    private void mergeVideos(List<VideosEntity> videos) {
//        if (videos == null || videos.isEmpty()) {
//            return;
//        }
//
//        // Extract country and language codes from videos
//        Set<String> countryCodes = videos.stream()
//                .map(video -> video.getIso_3166_1())
//                .filter(Objects::nonNull)
//                .map(ProductionCountriesEntity::getIso_3166_1)
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        Set<String> languageCodes = videos.stream()
//                .map(video -> video.getIso_639_1())
//                .filter(Objects::nonNull)
//                .map(SpokenLanguageEntity::getIso_639_1)
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        // Pre-load existing entities
//        Map<String, ProductionCountriesEntity> existingCountries = productionCountriesRepository.findMapByCodes(countryCodes);
//        Map<String, SpokenLanguageEntity> existingLanguages = spokenLanguageRepository.findMapByCodes(languageCodes);
//
//        videos.forEach(video -> {
//            // Merge country
//            if (video.getIso_3166_1() != null) {
//                ProductionCountriesEntity existingCountry = existingCountries.get(video.getIso_3166_1().getIso_3166_1());
//                if (existingCountry != null) {
//                    video.setIso_3166_1(entityManager.merge(existingCountry));
//                } else {
//                    entityManager.persist(video.getIso_3166_1());
//                }
//            }
//
//            // Merge language
//            if (video.getIso_639_1() != null) {
//                SpokenLanguageEntity existingLanguage = existingLanguages.get(video.getIso_639_1().getIso_639_1());
//                if (existingLanguage != null) {
////                    video.setIso_639_1(entityManager.merge(existingLanguage));
//                    video.setIso_639_1(existingLanguage);
//                } else {
//                    entityManager.persist(video.getIso_639_1());
//                }
//            }
//        });
//    }
//
//    private void mergeImages(List<ImagesEntity> images) {
//        if (images == null || images.isEmpty()) {
//            return;
//        }
//
//        Set<String> languageCodes = images.stream()
//                .map(image -> image.getIso_639_1())
//                .filter(Objects::nonNull)
//                .map(SpokenLanguageEntity::getIso_639_1)
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        Map<String, SpokenLanguageEntity> existingLanguages = spokenLanguageRepository.findMapByCodes(languageCodes);
//
//        images.forEach(image -> {
//            if (image.getIso_639_1() != null) {
//                SpokenLanguageEntity existingLanguage = existingLanguages.get(image.getIso_639_1().getIso_639_1());
//                if (existingLanguage != null) {
//                    image.setIso_639_1(existingLanguage);
////                    image.setIso_639_1(entityManager.merge(existingLanguage));
//                } else {
//                    entityManager.persist(image.getIso_639_1());
//                }
//            }
//        });
//    }
//
//    private void mergeCredits(CreditsEntity credits) {
//        if (credits == null) {
//            return;
//        }
//
//        mergeCrew(credits.getCrew());
//        mergeCast(credits.getCast());
//    }
//
//    private void mergeCrew(List<CrewEntity> crewList) {
//        if (crewList == null || crewList.isEmpty()) return;
//
//        Set<Long> personIds = crewList.stream()
//                .map(c -> c.getPerson().getId())
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//        Set<String> departmentNames = crewList.stream()
//                .map(c -> c.getDepartment().getName())
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//        Set<String> jobNames = crewList.stream()
//                .map(c -> c.getJob().getName())
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        Map<Long, PersonEntity> existingPersons = personRepository.findMapByIds(personIds);
//        Map<String, DepartmentEntity> existingDepartments = departmentRepository.findMapByNames(departmentNames);
//        Map<String, JobEntity> existingJobs = jobRepository.findMapByNames(jobNames);
//
//        for (CrewEntity crew : crewList) {
//            // Person
//            PersonEntity person = crew.getPerson();
//            if (person != null) {
//                if (existingPersons.containsKey(person.getId())) {
//                    crew.setPerson(entityManager.getReference(PersonEntity.class, person.getId()));
//                } else {
//                    crew.setPerson(getOrCreateReference(PersonEntity.class, person.getId(), person));
//                }
//            }
//
//            // Department
//            DepartmentEntity department = crew.getDepartment();
//            if (department != null && department.getName() != null) {
//                DepartmentEntity managedDept = existingDepartments.get(department.getName());
//                if (managedDept != null) {
//                    crew.setDepartment(entityManager.getReference(DepartmentEntity.class, managedDept.getName()));
//                } else {
//                    entityManager.persist(department);
//                }
//            }
//
//            // Job
//            JobEntity job = crew.getJob();
//            if (job != null && job.getName() != null) {
//                JobEntity managedJob = existingJobs.get(job.getName());
//                if (managedJob != null) {
//                    crew.setJob(entityManager.getReference(JobEntity.class, managedJob.getName()));
//                } else {
//                    entityManager.persist(job);
//                }
//            }
//        }
//    }
//
//
//    private void mergeCast(List<CastEntity> castList) {
//        if (castList == null || castList.isEmpty()) return;
//
//        Set<Long> personIds = castList.stream()
//                .map(c -> c.getPerson().getId())
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//        Set<String> characterNames = castList.stream()
//                .map(c -> c.getCharacter().getName())
//                .filter(Objects::nonNull)
//                .collect(Collectors.toSet());
//
//        Map<Long, PersonEntity> existingPersons = personRepository.findMapByIds(personIds);
//        Map<String, CharacterEntity> existingCharacters = characterRepository.findMapByNames(characterNames);
//
//        for (CastEntity cast : castList) {
//            PersonEntity person = cast.getPerson();
//            if (person != null) {
//                if (existingPersons.containsKey(person.getId())) {
//                    cast.setPerson(entityManager.getReference(PersonEntity.class, person.getId()));
//                } else {
//                    cast.setPerson(getOrCreateReference(PersonEntity.class, person.getId(), person));
//                }
//            }
//
//            CharacterEntity character = cast.getCharacter();
//            if (character != null && character.getName() != null) {
//                CharacterEntity managedChar = existingCharacters.get(character.getName());
//                if (managedChar != null) {
//                    cast.setCharacter(entityManager.getReference(CharacterEntity.class, managedChar.getName()));
//                } else {
//                    entityManager.persist(character);
//                }
//            }
//        }
//    }
//
//
//    private <T> T getOrCreateReference(Class<T> clazz, Object id, T entity) {
//        if (id == null) {
//            // New entity, persist and return managed instance
//            entityManager.persist(entity);
//            return entity;
//        }
//        try {
//            return entityManager.getReference(clazz, id);
//        } catch (Exception e) {
//            // If reference not found, persist
//            entityManager.persist(entity);
//            return entity;
//        }
//    }
//
//    private <T> T getOrCreateByName(Map<String, T> existingMap, String name, Class<T> clazz, T entity) {
//        if (name == null) return entity;
//        T existing = existingMap.get(name);
//        if (existing != null) {
//            return entityManager.contains(existing) ? existing
//                    : entityManager.getReference(clazz, getId(existing));
//        }
//        entityManager.persist(entity);
//        return entity;
//    }
//
//    // Helper to extract ID via reflection for generics
//    private Object getId(Object entity) {
//        try {
//            return entity.getClass().getMethod("getId").invoke(entity);
//        } catch (Exception e) {
//            return null;
//        }
//    }
//
//}