package com.db.dbworld.app.filemanager.path;

import org.junit.jupiter.api.Test;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.*;

class PathJailTest {
    final Path base = Path.of("/srv/dbworld").toAbsolutePath().normalize();

    @Test void resolvesRelativeUnderBase() {
        assertThat(PathJail.resolve(base, "/sub/dir")).isEqualTo(base.resolve("sub/dir"));
    }
    @Test void rootMapsToBase() {
        assertThat(PathJail.resolve(base, "/")).isEqualTo(base);
        assertThat(PathJail.resolve(base, null)).isEqualTo(base);
    }
    @Test void stripsLeadingSlashesSoNotAbsolute() {
        assertThat(PathJail.resolve(base, "//etc/passwd")).isEqualTo(base.resolve("etc/passwd"));
    }
    @Test void blocksTraversal() {
        assertThatThrownBy(() -> PathJail.resolve(base, "../../etc/passwd"))
            .isInstanceOf(SecurityException.class);
    }
    @Test void toRelativeRoundTrips() {
        Path p = base.resolve("a/b");
        assertThat(PathJail.toRelative(base, p)).isEqualTo("/a/b");
        assertThat(PathJail.toRelative(base, base)).isEqualTo("/");
    }
}
