package com.db.dbworld.app.wallet.mapper;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class WalletMapperTest {
    @Test void mask_hidesAllButLastFour() {
        assertThat(WalletMapper.mask("1234 5678 9012")).isEqualTo("•••• 9012");
    }
    @Test void mask_shortValue_isFullyHidden() {
        assertThat(WalletMapper.mask("12")).isEqualTo("••••");
    }
    @Test void mask_nullOrBlank_isNull() {
        assertThat(WalletMapper.mask(null)).isNull();
        assertThat(WalletMapper.mask("  ")).isNull();
    }
}
