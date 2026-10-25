package com.db.dbworld.app.pm.mapper;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.CredentialSummaryDto;
import com.db.dbworld.app.pm.dto.CustomFieldDto;
import com.db.dbworld.app.pm.dto.HostDto;
import com.db.dbworld.app.pm.dto.PasswordHistoryDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialHistoryEntity;
import com.db.dbworld.app.pm.entity.CustomFieldEntity;
import com.db.dbworld.app.pm.entity.CustomFieldType;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.util.PasswordStrength;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE, imports = PasswordStrength.class)
public interface PasswordManagerMapper {

    PasswordManagerDto toDto(PasswordManagerEntity entity);

    CredentialDto toDto(CredentialEntity entity);

    HostDto toDto(HostEntity entity);

    PasswordHistoryDto toDto(CredentialHistoryEntity entity);

    List<PasswordManagerDto> toDtoList(List<PasswordManagerEntity> entities);

    @Mapping(target = "passwordManager", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    CredentialEntity toEntity(CredentialDto dto);

    // A row from before types existed has no type: it is HIDDEN.
    @Mapping(target = "fieldType", source = "fieldType", qualifiedByName = "hiddenWhenUntyped")
    CustomFieldDto toDto(CustomFieldEntity entity);

    @Named("hiddenWhenUntyped")
    default CustomFieldType hiddenWhenUntyped(CustomFieldType type) {
        return type == null ? CustomFieldType.HIDDEN : type;
    }

    @Mapping(target = "credential", ignore = true)
    CustomFieldEntity toEntity(CustomFieldDto dto);

    // ── the list: what an entry holds, without the secrets ──────────────────────

    /**
     * An entry for the vault list or the Trash. Strength is scored on the trimmed password, as the
     * client's analyzeVault did; reused is worked out by the caller, who sees the whole vault.
     */
    @Mapping(target = "hasPassword", expression = "java(hasText(entity.getPassword()))")
    @Mapping(target = "hasPin", expression = "java(hasPin(entity.getPin()))")
    @Mapping(target = "hasNotes", expression = "java(hasText(entity.getNotes()))")
    @Mapping(target = "strength", expression = "java(PasswordStrength.level(PasswordStrength.trimmed(entity.getPassword())))")
    @Mapping(target = "reused", source = "reused")
    @Mapping(target = "breached", constant = "false")
    CredentialSummaryDto toSummary(CredentialEntity entity, boolean reused);

    @Mapping(target = "fieldType", source = "fieldType", qualifiedByName = "hiddenWhenUntyped")
    @Mapping(target = "fieldValue", expression = "java(shownValue(entity))")
    @Mapping(target = "hasValue", expression = "java(hasText(entity.getFieldValue()))")
    CredentialSummaryDto.FieldSummary toFieldSummary(CustomFieldEntity entity);

    // The helpers below are @Named so MapStruct never picks one on its own for some other
    // String or boolean property; they are only called from the expressions above.

    /** Only TEXT and URL values are shown in the clear; every other type (and an untyped row) is hidden. */
    @Named("shownValue")
    default String shownValue(CustomFieldEntity field) {
        CustomFieldType type = hiddenWhenUntyped(field.getFieldType());
        return type == CustomFieldType.TEXT || type == CustomFieldType.URL ? field.getFieldValue() : null;
    }

    @Named("hasText")
    default boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    /** "0" is what older clients saved for "no PIN", and the vault has never shown it as one. */
    @Named("hasPin")
    default boolean hasPin(String pin) {
        return hasText(pin) && !"0".equals(pin.trim());
    }

    // url is not part of the edit payload — preserve the value stored at add time.
    @Mapping(target = "url", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    // The custom fields are replaced by the service (clear + re-add, with their types kept). Mapped
    // here they would swap the managed list for unsaved entities, and the next query's flush fails.
    @Mapping(target = "customFields", ignore = true)
    // Null means "keep the stored value" for the three secrets, so a client that leaves one out cannot
    // wipe it. A blank string is the explicit clear and is copied like any other value.
    @Mapping(target = "password", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "pin", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "notes", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntityFromDto(CredentialDto dto, @MappingTarget CredentialEntity entity);
}
