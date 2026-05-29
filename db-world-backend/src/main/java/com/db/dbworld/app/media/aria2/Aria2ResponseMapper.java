package com.db.dbworld.app.media.aria2;

import com.db.dbworld.app.media.aria2.model.Aria2AddDownloadResponse;
import com.db.dbworld.app.media.aria2.model.Aria2GlobalStat;
import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import com.db.dbworld.app.media.aria2.model.Aria2Version;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Maps Aria2 JSON RPC responses to typed Java objects.
 * Migrated from com.db.dbworld.services.aria2.Aria2ResponseMapper.
 * Re-uses existing model classes — no changes to the model layer.
 */
@Log4j2
@Component("appAria2ResponseMapper")
@RequiredArgsConstructor
public class Aria2ResponseMapper {

    private final ObjectMapper objectMapper;

    // ──────────────────────────────────────────────────────────────────────────

    public Aria2StatusParam mapToDownloadStatus(JsonNode node) {
        if (node == null || node.isNull()) return null;
        try {
            Aria2StatusParam status = objectMapper.convertValue(node, Aria2StatusParam.class);
            // Some Aria2 versions wrap the result in a nested "result" field
            if (status.getGid() == null && node.has("result")) {
                status = objectMapper.convertValue(node.get("result"), Aria2StatusParam.class);
            }
            return status;
        } catch (IllegalArgumentException e) {
            log.warn("mapToDownloadStatus fallback for node: {}", node, e);
            return fallbackStatus(node);
        }
    }

    public List<Aria2StatusParam> mapToDownloadStatusList(JsonNode node) {
        List<Aria2StatusParam> list = new ArrayList<>();
        if (node == null || !node.isArray()) return list;
        for (JsonNode item : node) {
            Aria2StatusParam s = mapToDownloadStatus(item);
            if (s != null) list.add(s);
        }
        return list;
    }

    public Aria2GlobalStat mapToGlobalStat(JsonNode node) {
        if (node == null) return null;
        try {
            return objectMapper.convertValue(node, Aria2GlobalStat.class);
        } catch (IllegalArgumentException e) {
            log.warn("mapToGlobalStat fallback", e);
            return fallbackGlobalStat(node);
        }
    }

    public Aria2Version mapToVersion(JsonNode node) {
        if (node == null) return null;
        try {
            return objectMapper.convertValue(node, Aria2Version.class);
        } catch (IllegalArgumentException e) {
            log.warn("mapToVersion fallback", e);
            Aria2Version v = new Aria2Version();
            if (node.has("version")) v.setVersion(node.get("version").asText());
            return v;
        }
    }

    public Aria2AddDownloadResponse mapToAddDownloadResponse(JsonNode node) {
        if (node == null) return null;
        String gid = node.isTextual() ? node.asText() : null;
        return new Aria2AddDownloadResponse(gid, gid != null ? "added" : "error");
    }

    public Integer mapToIntegerResult(JsonNode node) {
        return (node != null && node.isNumber()) ? node.asInt() : null;
    }

    // ──────────────────────────────────────────────────────────────────────────

    private Aria2StatusParam fallbackStatus(JsonNode node) {
        Aria2StatusParam s = new Aria2StatusParam();
        if (node.has("gid"))             s.setGid(node.get("gid").asText());
        if (node.has("status"))          s.setStatus(node.get("status").asText());
        if (node.has("totalLength"))     s.setTotalLength(node.get("totalLength").asLong());
        if (node.has("completedLength")) s.setCompletedLength(node.get("completedLength").asLong());
        return s;
    }

    private Aria2GlobalStat fallbackGlobalStat(JsonNode node) {
        Aria2GlobalStat s = new Aria2GlobalStat();
        if (node.has("downloadSpeed")) s.setDownloadSpeed(node.get("downloadSpeed").asLong());
        if (node.has("uploadSpeed"))   s.setUploadSpeed(node.get("uploadSpeed").asLong());
        if (node.has("numActive"))     s.setNumActive(node.get("numActive").asInt());
        if (node.has("numWaiting"))    s.setNumWaiting(node.get("numWaiting").asInt());
        return s;
    }
}
