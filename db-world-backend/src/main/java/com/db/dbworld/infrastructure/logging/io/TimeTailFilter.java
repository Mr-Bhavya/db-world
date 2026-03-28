package com.db.dbworld.logging.io;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

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

            OffsetDateTime ts =
                    OffsetDateTime.parse(line.substring(start, end));

            if (ts.isAfter(cutoff)) {
                out.add(line);
            }
        }

        return out;
    }
}
