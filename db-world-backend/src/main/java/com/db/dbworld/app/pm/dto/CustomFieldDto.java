package com.db.dbworld.app.pm.dto;

import com.db.dbworld.app.pm.entity.CustomFieldType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CustomFieldDto {
    private String id;
    private String fieldKey;
    private String fieldValue;
    // Null from an older client or an old row: read as HIDDEN.
    private CustomFieldType fieldType;
}
