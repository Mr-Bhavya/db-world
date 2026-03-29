package com.db.dbworld.infrastructure.logging.io;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.GZIPInputStream;

public class GzipLineReader {

    public static List<String> readAll(Path path, int maxLines) throws IOException {

        List<String> out = new ArrayList<>();

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(
                        new GZIPInputStream(new FileInputStream(path.toFile())),
                        StandardCharsets.UTF_8))) {

            String line;
            while ((line = br.readLine()) != null) {
                out.add(line);
                if (maxLines > 0 && out.size() >= maxLines) break;
            }
        }

        return out;
    }
}
