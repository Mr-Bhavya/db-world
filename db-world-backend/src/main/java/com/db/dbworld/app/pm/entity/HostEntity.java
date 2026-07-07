package com.db.dbworld.app.pm.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.*;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "HOST", schema = "db_world")
public class HostEntity {
    @Id
    private String name;

    @OneToMany(mappedBy = "host")
    private List<PasswordManagerEntity> passwordManagerEntities;

    public HostEntity(String name) {
        this.name = name;
    }
}
