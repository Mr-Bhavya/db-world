package com.db.dbworld.infrastructure.logging.parser;

public interface LogLineParser<T> {
    T parse(String line);
}
