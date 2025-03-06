package com.db.dbworld.payloads;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CustomPageImpl<T> {
    private int pageNumber;
    private int pageSize;
    private long totalElements;
    private boolean isEmpty;
    private boolean isFirst;
    private boolean isLast;
    private List<T> records;
    
    public CustomPageImpl(Page<T> page){
        this.pageNumber = page.getNumber();
        this.pageSize = page.getSize();
        this.totalElements = page.getTotalElements();
        this.isEmpty = page.isEmpty();
        this.isFirst = page.isFirst();
        this.isLast = page.isLast();
        this.records = page.getContent();
    }
    
}



