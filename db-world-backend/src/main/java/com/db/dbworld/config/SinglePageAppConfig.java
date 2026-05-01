package com.db.dbworld.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;
import org.springframework.web.servlet.resource.ResourceResolver;
import org.springframework.web.servlet.resource.ResourceResolverChain;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Configuration
public class SinglePageAppConfig implements WebMvcConfigurer {

    private static final Set<String> API_PREFIXES = Set.of(
            "/api/", "/actuator/", "/admin/", "/ws/", "/swagger-ui/", "/v3/"
    );

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/public/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic())
                .resourceChain(true)
                .addResolver(new SpaFallbackResourceResolver());
    }

    /**
     * Tries to resolve an actual classpath resource first; falls back to index.html
     * for SPA client-side routes. Spring's resourceChain(true) wraps this resolver
     * in a CachingResourceResolver automatically, so no manual cache is needed.
     */
    private static class SpaFallbackResourceResolver implements ResourceResolver {

        private static final Resource INDEX = new ClassPathResource("/public/index.html");
        private final PathResourceResolver delegate = new PathResourceResolver();

        @Override
        public Resource resolveResource(HttpServletRequest request, String path,
                                        List<? extends Resource> locations,
                                        ResourceResolverChain chain) {
            if (isApiPath(path)) return null;
            Resource resource = delegate.resolveResource(request, path, locations, chain);
            if (resource != null) return resource;
            try {
                return INDEX.exists() ? INDEX : null;
            } catch (Exception e) {
                return null;
            }
        }

        @Override
        public String resolveUrlPath(String path, List<? extends Resource> locations,
                                     ResourceResolverChain chain) {
            return delegate.resolveUrlPath(path, locations, chain);
        }

        private boolean isApiPath(String path) {
            if (path == null || path.isBlank()) return false;
            String p = path.startsWith("/") ? path : "/" + path;
            for (String prefix : API_PREFIXES) {
                if (p.startsWith(prefix)) return true;
            }
            return false;
        }
    }
}
