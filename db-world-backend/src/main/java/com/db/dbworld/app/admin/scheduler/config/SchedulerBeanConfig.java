package com.db.dbworld.app.admin.scheduler.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class SchedulerBeanConfig {

    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler s = new ThreadPoolTaskScheduler();
        s.setPoolSize(4);
        s.setThreadNamePrefix("job-scheduler-");
        s.setWaitForTasksToCompleteOnShutdown(false);
        return s;
    }
}
