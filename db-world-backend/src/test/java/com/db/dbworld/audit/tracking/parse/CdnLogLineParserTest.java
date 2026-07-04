package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;

class CdnLogLineParserTest {

    private final CdnLogLineParser parser = new CdnLogLineParser(new ObjectMapper());

    private static final String PARTIAL = """
        {"time":"2026-07-04T10:00:00+00:00","remote_addr":"1.2.3.4","real_ip":"9.9.9.9",\
        "method":"GET","uri":"/id/abc","status":206,"bytes_sent":1024,\
        "content_range":"bytes 0-1023/10000","range_header":"bytes=0-",\
        "file":"m.mkv","file_id":"/id/abc","user":"u@x.com",\
        "download_id":"DL_1","request_id":"req-1","type":"DOWNLOAD",\
        "event":"PARTIAL","duration_sec":"0.50","user_agent":"aria2/1.36",\
        "conn":"42","server":"cdn"}""";

    @Test void parsesPartialRange() {
        Optional<CdnLogLine> r = parser.parse(PARTIAL);
        assertThat(r).isPresent();
        CdnLogLine l = r.get();
        assertThat(l.requestId()).isEqualTo("req-1");
        assertThat(l.activity()).isEqualTo(ActivityKind.DOWNLOAD);
        assertThat(l.status()).isEqualTo(206);
        assertThat(l.bytesSent()).isEqualTo(1024);
        assertThat(l.rangeStart()).isEqualTo(0);
        assertThat(l.rangeEnd()).isEqualTo(1023);
        assertThat(l.fileTotal()).isEqualTo(10000);
        assertThat(l.connId()).isEqualTo(42);
        assertThat(l.isComplete()).isFalse();
    }

    @Test void streamTypeMapsToStream() {
        String s = PARTIAL.replace("\"type\":\"DOWNLOAD\"", "\"type\":\"ONLINE\"");
        assertThat(parser.parse(s).orElseThrow().activity()).isEqualTo(ActivityKind.STREAM);
    }

    @Test void status200IsComplete_evenWithoutContentRange() {
        String full = PARTIAL.replace("\"status\":206", "\"status\":200")
                             .replace("\"content_range\":\"bytes 0-1023/10000\",", "");
        CdnLogLine l = parser.parse(full).orElseThrow();
        assertThat(l.isComplete()).isTrue();
        assertThat(l.rangeStart()).isNull();
    }

    @Test void range206ReachingEndIsComplete() {
        String end = PARTIAL.replace("bytes 0-1023/10000", "bytes 9000-9999/10000");
        assertThat(parser.parse(end).orElseThrow().isComplete()).isTrue();
    }

    @Test void missingRequestIdIsDropped() {
        String noReq = PARTIAL.replace("\"request_id\":\"req-1\",", "\"request_id\":\"\",");
        assertThat(parser.parse(noReq)).isEmpty();
    }

    @Test void assetOrWrongTypeDropped() {
        String asset = PARTIAL.replace("\"type\":\"DOWNLOAD\"", "\"type\":\"\"");
        assertThat(parser.parse(asset)).isEmpty();
    }

    @Test void malformedJsonReturnsEmpty() {
        assertThat(parser.parse("{not json")).isEmpty();
        assertThat(parser.parse("")).isEmpty();
        assertThat(parser.parse(null)).isEmpty();
    }
}
