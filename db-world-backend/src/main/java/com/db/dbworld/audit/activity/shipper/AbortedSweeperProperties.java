package com.db.dbworld.audit.activity.shipper;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld.aborted-sweeper")
public class AbortedSweeperProperties {

    private boolean enabled = true;

    private int streamTimeoutMin = 15;

    private int downloadTimeoutMin = 30;
}
