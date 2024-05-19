package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.PasswordManagerRepository;
import com.db.dbworld.dao.user.UserAppDataRepository;
import com.db.dbworld.dao.user.UserRepository;
import com.db.dbworld.entities.user.PasswordManagerCredential;
import com.db.dbworld.entities.user.UserAppDataEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.entities.user.UserRoleEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.DuplicateResourceException;
import com.db.dbworld.exceptions.ResourceDbUpdateException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.Credential;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.PasswordManagerService;
import com.db.dbworld.services.RoleService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import lombok.extern.log4j.Log4j2;
import org.bson.types.ObjectId;
import org.modelmapper.ModelMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import java.io.IOException;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;

@Log4j2
@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserAppDataRepository userAppDataRepository;

    @Autowired
    private PasswordManagerRepository passwordManagerRepository;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private RoleService roleService;

    @Autowired
    private MongoOperations mongoOperations;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private PasswordManagerService credentialService;

    private final Logger logger = LoggerFactory.getLogger(UserService.class);

    // https://docs.spring.io/spring-data/mongodb/reference/mongodb/mapping/document-references.html
    @Override
    public UserDto createUser(UserDto userDto) {
        UserEntity createdUser = null;
        UserAppDataEntity userAppDataEntity = new UserAppDataEntity();
        UserEntity userEntity = modelMapper.map(userDto, UserEntity.class);

        try {
//            PasswordManagerCredential passwordManagerCredential = new PasswordManagerCredential();
            List<PasswordManagerCredential> passwordManagerCredentialList = new ArrayList<>();
            userEntity.setPasswordManager(passwordManagerCredentialList);
            createdUser = this.userRepository.save(userEntity);

            userAppDataEntity.setUser(createdUser);
            userAppDataEntity = userAppDataRepository.save(userAppDataEntity);

            UserRoleEntity userRoleEntity = mongoOperations.findOne(Query.query(Criteria.where("name").is(DbWorldConstants.VIEWER)), UserRoleEntity.class);

            Query query = new Query(Criteria.where("userId").is(createdUser.getUserId()));

            HashMap<String, Object> map = new HashMap<>();
            map.put("userAppData", userAppDataEntity);
            map.put("userRole", userRoleEntity);

            createdUser = mongoOperations.findAndModify(query, dbWorldUtils.createMongoDbUpdateObject(map), new FindAndModifyOptions().returnNew(true), UserEntity.class);

        } catch (DuplicateKeyException ex) {
            throw new DuplicateResourceException("user", "email", userDto.getEmail());
        }
        return modelMapper.map(createdUser, UserDto.class);
    }

    @Override
    public UserDto registerUser(UserDto userDto) {
        //set user role to viewer
//        userDto.setUserRole(DbWorldConstants.VIEWER);

        UserEntity userEntity = modelMapper.map(userDto, UserEntity.class);
        UserEntity createdUser = this.userRepository.save(userEntity);
        return modelMapper.map(createdUser, UserDto.class);
    }

    @Override
    public List<UserDto> getAllUsers() {
//        List<UserEntity> userEntityList = this.userRepository.findAll();
        List<UserEntity> userEntityList = this.mongoOperations.findAll(UserEntity.class);
        return userEntityList.stream().map(this::filterUserData).collect(Collectors.toList());
    }

    @Override
    public UserDto getUserById(String userId) {
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", "userid", userId));
        return filterUserData(userEntity);
    }

    @Override
    public String getUserIdByUsername(String username) {
        Query getUserIdQuery = Query.query(Criteria.where("email").is(username));
        getUserIdQuery.fields().include("userId");
        return mongoOperations.findOne(getUserIdQuery, UserEntity.class).getUserId().toString();
    }

    @Override
    public UserDto getUserByEmail(String email) {
        UserEntity userEntity = this.userRepository.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException("user", "email", email));
        return this.modelMapper.map(userEntity, UserDto.class);
    }

    @Override
    public UserDto updateUser(UserDto userDto, String userId) {
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", "userid", userId));

        Query query = new Query(Criteria.where("userId").is(userId));

        HashMap<String, Object> map = new HashMap<>();
        map.put("firstName", userDto.getFirstName());
        map.put("lastName", userDto.getLastName());
        map.put("dob", userDto.getDob());
        map.put("gender", userDto.getGender());
        map.put("mobileNo", userDto.getMobileNo());
        map.put("password", userDto.getPasswordManager());

        UserEntity updatedUserEntity = mongoOperations.findAndModify(query, dbWorldUtils.createMongoDbUpdateObject(map), new FindAndModifyOptions().returnNew(true), UserEntity.class);

        userDto = this.modelMapper.map(updatedUserEntity, UserDto.class);

        return userDto;
    }

    @Override
    public void deleteUserById(String userId) {
        this.userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "userid", userId)); //It will check user is available or not with userId
        this.userRepository.deleteById(userId);
    }

    @Override
    public List<UserDto> searchUser(String key) {
        return null;
    }

    @Override
    public List<UserDto.PasswordManagerCredential> getCredentialByUserId(String userId) {
        return null;
    }

    @Override
    public UserDto.UserRole addUpdateUserRoleByUserId(String userId, UserDto.UserRole role) {
        role = roleService.getRoleById(role.getId());

        Query query = new Query(Criteria.where("userId").is(userId));
        query.fields().include("userId", "userRole");

        UserRoleEntity userRoleEntity = new UserRoleEntity();
        userRoleEntity.setId(new ObjectId(role.getId()));
        userRoleEntity.setName(role.getName());

        Update update = new Update();
        update.set("userRole", userRoleEntity);

        UserEntity updatedUserEntity = mongoOperations.findAndModify(query, update, new FindAndModifyOptions().returnNew(true), UserEntity.class);
        return this.modelMapper.map(updatedUserEntity, UserDto.class).getUserRole();
    }

    @Override
    public UserDto.UserRole getRoleByUserId(String userId) {
        Query query = new Query();
        query.addCriteria(Criteria.where("userId").is(userId));
        query.fields().include("userId", "userRole");
        UserEntity userEntity = mongoOperations.findOne(query, UserEntity.class);
        if (userEntity == null)
            throw new ResourceNotFoundException("user", "userId", userId);
        return modelMapper.map(userEntity, UserDto.class).getUserRole();
    }

    @Override
    public UserDto updateRoleByUserId(String userId) {
        return null;
    }

    @Override
    public UserDto.UserAppData getUserAppDataByUserId(String userId) {
        Query query = new Query(Criteria.where("userId").is(userId));
        query.fields().include("userId", "userAppData");

        UserEntity userEntity = mongoOperations.findOne(query, UserEntity.class);
        if (userEntity == null)
            throw new ResourceNotFoundException("user", "userId", userId);
        return modelMapper.map(userEntity, UserDto.class).getUserAppData();
    }

    @Override
    public UserDto.UserAppData updateUserAppDataByUserId(String userId, UserDto.UserAppData userAppData) {

        UserAppDataEntity userAppDataEntity = this.modelMapper.map(userAppData, UserAppDataEntity.class);
        if (userAppDataEntity.getId() == null) {
            UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", "userId", userId));
            userAppDataEntity.setUser(userEntity);
            UserAppDataEntity newUserAppData = this.userAppDataRepository.save(userAppDataEntity);
            UpdateResult updateResult = this.mongoOperations.updateFirst(new Query(Criteria.where("userId").is(userId)), new Update().set("userAppData", newUserAppData), UserEntity.class);
            logger.info("UserEntity Update Result for userId: {} is {}", userId, updateResult);
            if (updateResult.getModifiedCount() != 1)
                throw new ResourceDbUpdateException("UserAppData", "updateUserAppDataByUserId");
            return this.modelMapper.map(newUserAppData, UserDto.UserAppData.class);
        } else {
            Query query = new Query(Criteria.where("id").is(userAppDataEntity.getId()));

            HashMap<String, Object> map = new HashMap<>();
            map.put("noOfLogin", userAppDataEntity.getNoOfLogin());
            map.put("loginDetails", userAppDataEntity.getLoginDetails());
            map.put("cinemaRecord", userAppDataEntity.getCinemaRecord());

            UserAppDataEntity updatedUserAppDataEntity = this.mongoOperations.findAndModify(query, dbWorldUtils.createMongoDbUpdateObject(map), new FindAndModifyOptions().returnNew(true), UserAppDataEntity.class);
            if (updatedUserAppDataEntity == null)
                throw new ResourceDbUpdateException("UserAppData", "updateUserAppDataByUserId");
            return this.modelMapper.map(updatedUserAppDataEntity, UserDto.UserAppData.class);
        }
    }

    @Override
    public void deleteUserAppDataById(String id) {
        UserAppDataEntity userAppDataEntity = this.userAppDataRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("UserAppData", "id", id));

        Query query = new Query(Criteria.where("userId").is(userAppDataEntity.getUser().getUserId()));
        Update update = new Update();
        update.unset("userAppData");
        UpdateResult updateResult = this.mongoOperations.updateFirst(query, update, UserEntity.class);
        logger.info("UserEntity Update Result for userId: {} is {}", userAppDataEntity.getUser().getUserId(), updateResult);
        if (updateResult.getModifiedCount() != 1)
            throw new ResourceDbUpdateException("UserEntity", "deleteUserAppDataById");

        this.userAppDataRepository.deleteById(id);
    }

    @Override
    public void deleteUserAppDataByUserId(String userId) {
        UserEntity user = this.userRepository.findById(userId).get();
        Query query = new Query(Criteria.where("user").is(user));
        Update update = new Update();
        update.unset("userAppData");
        UpdateResult updateResult = this.mongoOperations.updateFirst(query, update, UserEntity.class);
        logger.info("UserEntity Update Result for userId: {} is {}", userId, updateResult);
        DeleteResult deleteResult = this.mongoOperations.remove(query, UserAppDataEntity.class);
        logger.info("UserAppDataEntity delete Result for userId: {} is {}", userId, deleteResult);
        if (updateResult.getModifiedCount() != 1 || deleteResult.getDeletedCount() != 1 || updateResult.getModifiedCount() != deleteResult.getDeletedCount()) {
            throw new ResourceDbUpdateException("UserAppDataEntity, UserEntity", "deleteUserAppDataByUserId");
        }
    }

    //TODO
    @Override
    public void addCredential(String userId, String host, Credential credential) {

        //user got
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("user", "userId", userId));

        //get user password manger
        List<PasswordManagerCredential> passwordManagerCredentialList = userEntity.getPasswordManager();

        //update password manager credential list
        List<PasswordManagerCredential> updatedPasswordManagerCredentials = null;
        try {
            updatedPasswordManagerCredentials = credentialService
                    .addNewCredential(userId, passwordManagerCredentialList == null ? new ArrayList<>() : passwordManagerCredentialList, host, credential);

        } catch (InvalidAlgorithmParameterException | NoSuchAlgorithmException | NoSuchPaddingException |
                 IllegalBlockSizeException | InvalidKeySpecException | IOException | InvalidKeyException e) {
            throw new DbWorldException(e.getMessage());
        }
        userEntity.setPasswordManager(updatedPasswordManagerCredentials);
        UserEntity updatedUserEntity = this.userRepository.save(userEntity);
    }

    @Override
    public List<ResponsePayloads.PasswordManagerCredential> getCredentials(String userId) {
        Query query = new Query(Criteria.where("userId").is(userId));
        query.fields().include("passwordManager");
        UserEntity userEntity = this.mongoOperations.findOne(query, UserEntity.class);
        return credentialService.decryptCredential(userId, userEntity.getPasswordManager());
    }

    @Override
    public Credential getCredentialById(String userId, long credential) {
        return null;
    }

    @Override
    public void updateCredential(String userId, String host, Credential credential) {
        //user got
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("user", "userId", userId));

        //get user password manger
        List<PasswordManagerCredential> passwordManagerCredentialList = userEntity.getPasswordManager();

        //updated credential
        PasswordManagerCredential updatedCredential = credentialService.getUpdatedCredential(userId, passwordManagerCredentialList, host, credential);

        //save in db
        this.passwordManagerRepository.save(updatedCredential);
    }

    @Override
    public void deleteCredential(String userId, String passwordManagerId, long credentialId) {
        //user got
        UserEntity userEntity = this.userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("user", "userId", userId));

        //get user password manger
        List<PasswordManagerCredential> passwordManagerCredentialList = userEntity.getPasswordManager();

        //delete credential
        PasswordManagerCredential updatedCredential = credentialService.deleteCredential(userId, passwordManagerCredentialList, passwordManagerId, credentialId);

        //save in db
        this.passwordManagerRepository.save(updatedCredential);
    }

    private UserDto filterUserData(UserEntity userEntity) {
        UserDto userDto = this.modelMapper.map(userEntity, UserDto.class);
        if (userDto.getUserAppData() != null && userDto.getUserAppData().getLoginDetails() != null && userDto.getUserAppData().getLoginDetails().size() > 0)
            userDto.getUserAppData().setLoginDetails(userDto.getUserAppData().getLoginDetails().stream().limit(5).collect(Collectors.toList()));
        userDto.setPasswordManager(null);
//        userDto.setUserRole(null);
        if (userDto.getUserAppData() != null) {
            userDto.getUserAppData().setCinemaRecord(null);
        }
        return userDto;
    }

}
