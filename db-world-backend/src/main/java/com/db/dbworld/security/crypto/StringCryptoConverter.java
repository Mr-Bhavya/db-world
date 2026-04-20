package com.db.dbworld.security.crypto;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.Setter;

@Converter(autoApply = false)
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
        String value = cryptoProvider.decrypt(dbData);
        // Recover from double-encryption: migration service previously set encrypted values
        // directly on entity fields, causing JPA to encrypt them a second time.
        if (value != null && value.startsWith("AES:")) {
            value = cryptoProvider.decrypt(value);
        }
        return value;
    }
}
