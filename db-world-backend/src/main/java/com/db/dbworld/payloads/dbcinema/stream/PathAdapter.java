package com.db.dbworld.payloads.dbcinema.stream;

import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

public class PathAdapter extends TypeAdapter<Path> {

    @Override
    public void write(JsonWriter out, Path value) throws IOException {
        if (value != null) {
            out.value(value.toString());  // Serialize Path as a string
        } else {
            out.nullValue();  // Handle null value for Path
        }
    }

    @Override
    public Path read(JsonReader in) throws IOException {
        String pathString = in.nextString();
        return pathString != null ? Paths.get(pathString) : null;  // Deserialize string back to Path
    }
}
