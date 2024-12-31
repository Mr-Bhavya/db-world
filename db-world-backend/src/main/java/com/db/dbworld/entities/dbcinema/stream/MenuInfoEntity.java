package com.db.dbworld.entities.dbcinema.stream;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@DiscriminatorValue("Menu")
public class MenuInfoEntity extends TrackInfoEntity {
//    private Map<String, String> extra;
}
