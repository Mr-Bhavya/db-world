package com.db.dbworld.filters;

import com.db.dbworld.context.RequestContext;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@Component("dbWorldRequestContextFilter")
public class RequestContextFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        try {
            RequestContext.init();
            HttpServletResponse res = (HttpServletResponse) response;
            res.setHeader("X-Request-Id", RequestContext.getRequestId());
            res.setHeader("X-Trace-Id", RequestContext.getTraceId());
            chain.doFilter(request, response);
        } finally {
            RequestContext.clear();
        }
    }
}

