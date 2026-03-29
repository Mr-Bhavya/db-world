package com.db.dbworld.app.cinema.rail.dto;

import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RailPageDto {

    private Long railId;

    private int page;

    private int size;

    private boolean hasNext;

    private List<RailRecordDto> records;
}