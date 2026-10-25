package com.db.dbworld.app.pm.dto;

import java.util.List;

/** One site's group of entries in the vault list or the Trash, without any secret. */
public record VaultGroupDto(String id, HostDto host, List<CredentialSummaryDto> credentials) {
}
