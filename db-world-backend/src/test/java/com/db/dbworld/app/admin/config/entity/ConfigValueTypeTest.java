package com.db.dbworld.app.admin.config.entity;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ConfigValueTypeTest {

    @Test
    void boolean_parsesTrueFalse_caseInsensitive() {
        assertThat(ConfigValueType.BOOLEAN.parse("true")).isEqualTo(Boolean.TRUE);
        assertThat(ConfigValueType.BOOLEAN.parse("FALSE")).isEqualTo(Boolean.FALSE);
        assertThat(ConfigValueType.BOOLEAN.isValid("true")).isTrue();
        assertThat(ConfigValueType.BOOLEAN.isValid("yes")).isFalse();
    }

    @Test
    void integer_parsesAndValidates() {
        assertThat(ConfigValueType.INTEGER.parse("42")).isEqualTo(42);
        assertThat(ConfigValueType.INTEGER.isValid("42")).isTrue();
        assertThat(ConfigValueType.INTEGER.isValid("4.2")).isFalse();
        assertThat(ConfigValueType.INTEGER.isValid("abc")).isFalse();
    }

    @Test
    void longs_parseAndValidate() {
        assertThat(ConfigValueType.LONG.parse("5242880")).isEqualTo(5242880L);
        assertThat(ConfigValueType.LONG.isValid("9999999999")).isTrue();
        assertThat(ConfigValueType.LONG.isValid("x")).isFalse();
    }

    @Test
    void string_acceptsAnything() {
        assertThat(ConfigValueType.STRING.parse("0 0 * * * *")).isEqualTo("0 0 * * * *");
        assertThat(ConfigValueType.STRING.isValid("")).isTrue();
    }
}
