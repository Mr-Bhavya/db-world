package com.db.dbworld.security.crypto;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * One-time startup repair for fields accidentally encrypted by the old autoApply=true
 * StringCryptoConverter. Detects "AES:" prefixed values in non-credential tables and
 * decrypts them back to plaintext.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class DataRepairService {

    private final JdbcTemplate jdbc;
    private final CryptoProvider crypto;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void repairOnStartup() {
        repairUsers();
    }

    private void repairUsers() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, email, password, first_name, last_name, gender FROM new_db_world.users"
        );

        int fixed = 0;
        for (Map<String, Object> row : rows) {
            Long id   = ((Number) row.get("id")).longValue();
            String email     = asStr(row.get("email"));
            String password  = asStr(row.get("password"));
            String firstName = asStr(row.get("first_name"));
            String lastName  = asStr(row.get("last_name"));
            String gender    = asStr(row.get("gender"));

            String ce = fix(email);
            String cp = fix(password);
            String cf = fix(firstName);
            String cl = fix(lastName);
            String cg = fix(gender);

            if (!same(email, ce) || !same(password, cp)
                    || !same(firstName, cf) || !same(lastName, cl) || !same(gender, cg)) {

                jdbc.update("""
                        UPDATE new_db_world.users
                           SET email=?, password=?, first_name=?, last_name=?, gender=?
                         WHERE id=?
                        """, ce, cp, cf, cl, cg, id);
                fixed++;
            }
        }

        if (fixed > 0) {
            log.warn("DataRepair: fixed {} user record(s) with accidentally encrypted fields — this runs once and is safe to ignore going forward.", fixed);
        }
    }

    private String fix(String value) {
        if (value == null || !value.startsWith("AES:")) return value;
        return crypto.decrypt(value);
    }

    private String asStr(Object obj) {
        return obj == null ? null : obj.toString();
    }

    private boolean same(String a, String b) {
        return Objects.equals(a, b);
    }
}
