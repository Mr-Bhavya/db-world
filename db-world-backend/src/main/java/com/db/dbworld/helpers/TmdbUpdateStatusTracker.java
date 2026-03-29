//package com.db.dbworld.helpers;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.RequiredArgsConstructor;
//import org.springframework.stereotype.Service;
//
//import java.time.LocalDateTime;
//import java.util.Collections;
//import java.util.Map;
//import java.util.concurrent.ConcurrentHashMap;
//import java.util.concurrent.atomic.AtomicBoolean;
//import java.util.concurrent.atomic.AtomicInteger;
//import java.util.concurrent.atomic.AtomicReference;
//
//@Service
//public class TmdbUpdateStatusTracker {
//    private final AtomicBoolean isRunning = new AtomicBoolean(false);
//    private final AtomicReference<LocalDateTime> startTime = new AtomicReference<>();
//    private final AtomicReference<LocalDateTime> endTime = new AtomicReference<>();
//    private final AtomicBoolean isCancelled = new AtomicBoolean(false);
//    private final AtomicInteger processedCount = new AtomicInteger(0);
//    private final AtomicInteger successCount = new AtomicInteger(0);
//    private final AtomicInteger failedCount = new AtomicInteger(0);
//    private final AtomicInteger totalCount = new AtomicInteger(0);  // New field
//    private final AtomicReference<Map<Long, String>> failedRecords = new AtomicReference<>(new ConcurrentHashMap<>());
//
//    public void startProcess(int totalRecords) {
//        if (!isRunning.compareAndSet(false, true)) {
//            throw new IllegalStateException("Process is already running");
//        }
//        startTime.set(LocalDateTime.now());
//        endTime.set(null);
//        processedCount.set(0);
//        successCount.set(0);
//        failedCount.set(0);
//        totalCount.set(totalRecords);  // Initialize with total records
//        failedRecords.set(new ConcurrentHashMap<>());
//    }
//
//    public void recordSuccess() {
//        successCount.incrementAndGet();
//        processedCount.incrementAndGet();
//    }
//
//    public void recordFailure(Long id, String errorMessage) {
//        failedRecords.getAndUpdate(map -> {
//            Map<Long, String> newMap = new ConcurrentHashMap<>(map);
//            newMap.put(id, errorMessage);
//            return newMap;
//        });
//        failedCount.incrementAndGet();
//        processedCount.incrementAndGet();
//    }
//
//    public void completeProcess() {
//        endTime.set(LocalDateTime.now());
//        isRunning.set(false);
//    }
//
//    public void cancelProcess() {
//        isCancelled.set(true);
//    }
//
//    public boolean isCancelled() {
//        return isCancelled.get();
//    }
//
//    public DbWorldRecords.TmdbUpdateProcessStatus getCurrentStatus() {
//        return new DbWorldRecords.TmdbUpdateProcessStatus(
//                isRunning.get(),
//                startTime.get(),
//                endTime.get(),
//                processedCount.get(),
//                successCount.get(),
//                failedCount.get(),
//                totalCount.get(),  // Include total count
//                Collections.unmodifiableMap(failedRecords.get())
//        );
//    }
//
//    public boolean isRunning() {
//        return isRunning.get();
//    }
//}