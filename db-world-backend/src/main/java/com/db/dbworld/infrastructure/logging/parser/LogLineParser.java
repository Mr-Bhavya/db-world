package com.db.dbworld.logging.parser;

public interface LogLineParser<T> {
    T parse(String line);
}
