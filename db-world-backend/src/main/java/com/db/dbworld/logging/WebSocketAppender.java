package com.db.dbworld.logging;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.*;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;
import org.apache.logging.log4j.core.config.plugins.*;
import org.apache.logging.log4j.core.layout.PatternLayout;
import org.springframework.context.ApplicationContext;

import java.io.Serializable;

@Plugin(name = "WebSocketAppender",
        category = Core.CATEGORY_NAME,
        elementType = Appender.ELEMENT_TYPE)
public class WebSocketAppender extends AbstractAppender {

    protected WebSocketAppender(String name, Filter filter,
                                Layout<? extends Serializable> layout,
                                boolean ignoreExceptions) {
        super(name, filter, layout, ignoreExceptions, Property.EMPTY_ARRAY);
    }

    @PluginFactory
    public static WebSocketAppender createAppender(
            @PluginAttribute("name") String name,
            @PluginElement("Filter") Filter filter,
            @PluginElement("Layout") Layout<? extends Serializable> layout) {

        if (layout == null) layout = PatternLayout.createDefaultLayout();
        return new WebSocketAppender(name, filter, layout, true);
    }

    @Override
    public void append(LogEvent event) {
        try {
            String msg = new String(getLayout().toByteArray(event));

            LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
            ApplicationContext spring =
                    (ApplicationContext) ctx.getObject("springContext");

            if (spring != null) {
                spring.getBean(LogBroadcastService.class)
                        .broadcast(msg);
            }

        } catch (Exception ignored) {}
    }
}
