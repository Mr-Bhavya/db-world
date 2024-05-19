package com.db.dbworld.entities.user;

import lombok.Getter;
import lombok.Setter;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Getter
@Setter
@Document(collection = "PASSWORD_MANAGER_CREDENTIALS")
public class PasswordManagerCredential {
    @Id
    private ObjectId id;
    private String host;
    private List<byte[]> credentials;
    private byte[] ivParameterSpec;

}
