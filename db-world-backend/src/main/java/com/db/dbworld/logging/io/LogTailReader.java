package com.db.dbworld.logging.io;

import java.io.*;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

public class LogTailReader {

    public static List<String> tailLines(Path path, int lines) throws IOException {

        try (RandomAccessFile raf = new RandomAccessFile(path.toFile(), "r")) {

            long fileLength = raf.length();
            long pos = fileLength - 1;

            Deque<String> result = new ArrayDeque<>();
            StringBuilder sb = new StringBuilder();

            while (pos >= 0 && result.size() < lines) {
                raf.seek(pos);
                int c = raf.read();

                if (c == '\n') {
                    result.addFirst(sb.reverse().toString());
                    sb.setLength(0);
                } else {
                    sb.append((char) c);
                }
                pos--;
            }

            if (sb.length() > 0) {
                result.addFirst(sb.reverse().toString());
            }

            return List.copyOf(result);
        }
    }
}

