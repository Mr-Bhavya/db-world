package com.db.dbworld.entities.pm;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "HOST", schema = "db_world")
public class HostEntity implements Serializable {
    @Id
    private String name;

    @OneToMany(mappedBy = "host")
    private List<PasswordManagerEntity> passwordManagerEntities;
}
