package com.db.dbworld.logging;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LoggerContext;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class Log4j2SpringContextInjector {

    private final ApplicationContext applicationContext;

    @PostConstruct
    public void inject() {
        LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
        ctx.putObject("springContext", applicationContext);
        System.out.println("Spring context injected into Log4j2");
    }
}
