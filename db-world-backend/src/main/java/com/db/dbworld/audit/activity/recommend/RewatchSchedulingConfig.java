package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.CronTrigger;

import java.time.Instant;

/**
 * Runs {@link RewatchTrendService#refresh()} on the cron stored at
 * {@code recommend.rewatch.refresh-cron}. A fresh {@link CronTrigger} is built
 * from the live setting on every scheduling decision, so editing the cron in
 * the admin Settings page takes effect on the next fire — no restart.
 */
@Configuration
@EnableScheduling
@RequiredArgsConstructor
@Log4j2
public class RewatchSchedulingConfig implements SchedulingConfigurer {

    private static final String DEFAULT_CRON = "0 0 * * * *";

    private final RewatchTrendService rewatchTrendService;
    private final SettingsService     settings;

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.addTriggerTask(rewatchTrendService::refresh, this::nextExecution);
        log.info("Rewatch refresh scheduling registered (trigger-driven; reads cron from app_config)");
    }

    private Instant nextExecution(org.springframework.scheduling.TriggerContext ctx) {
        String cron = settings.getString(ConfigKeys.RECOMMEND_REWATCH_REFRESH_CRON);
        try {
            return new CronTrigger(cron).nextExecution(ctx);
        } catch (Exception e) {
            log.warn("Invalid rewatch cron '{}' — falling back to default '{}': {}",
                    cron, DEFAULT_CRON, e.getMessage());
            return new CronTrigger(DEFAULT_CRON).nextExecution(ctx);
        }
    }
}
