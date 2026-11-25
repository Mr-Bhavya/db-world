package com.db.dbworld.app.media.aria2;

import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class Aria2ProgressTest {
    @Test
    void exposesAriaWaitingAndPausedEvenWithoutSize() {
        Aria2StatusParam status = new Aria2StatusParam();
        status.setStatus("waiting");
        assertThat(Aria2Progress.from(status).phase()).isEqualTo("aria2-waiting");
        status.setStatus("paused");
        assertThat(Aria2Progress.from(status).phase()).isEqualTo("aria2-paused");
        status.setStatus("active");
        assertThat(Aria2Progress.from(status).phase()).isEqualTo("downloading");
    }
}
