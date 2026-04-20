package com.db.dbworld.security.crypto;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.Setter;

@Converter(autoApply = true)
public class StringCryptoConverter implements AttributeConverter<String, String> {

    @Setter
    private static CryptoProvider cryptoProvider;

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        return cryptoProvider.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        return cryptoProvider.decrypt(dbData);
    }
}
