package com.db.dbworld.app.brand;

/**
 * A single brand/site suggestion returned to the client for the "search for a
 * site" field. {@code logoUrl} may be null — the client can also render the logo
 * from {@code domain} via the publishable logo.dev token.
 */
public record BrandSuggestion(String name, String domain, String logoUrl) {}
