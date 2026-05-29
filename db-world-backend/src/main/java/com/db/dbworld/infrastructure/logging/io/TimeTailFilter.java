package com.db.dbworld.infrastructure.logging.io;

import lombok.extern.log4j.Log4j2;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Log4j2
public class TimeTailFilter {

    public static List<String> filterByCutoff(
            List<String> lines,
            OffsetDateTime cutoff
    ) {
        List<String> out = new ArrayList<>();

        for (String line : lines) {
            int i = line.indexOf("\"timestamp\":\"");
            if (i < 0) continue;

            int start = i + 13;
            int end = line.indexOf('"', start);
            if (end < 0) continue;

            try {
                OffsetDateTime ts =
                        OffsetDateTime.parse(line.substring(start, end));

                if (ts.isAfter(cutoff)) {
                    out.add(line);
                }
            } catch (Exception e) {
                String sample = line.length() > 200 ? line.substring(0, 200) : line;
                log.debug("Skipping line with unparseable timestamp (sample='{}')", sample, e);
            }
        }

        return out;
    }
}
