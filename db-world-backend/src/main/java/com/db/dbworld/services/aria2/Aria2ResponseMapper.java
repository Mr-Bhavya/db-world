package com.db.dbworld.services.aria2;

import com.db.dbworld.services.aria2.model.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Log4j2
@Component
@RequiredArgsConstructor
public class Aria2ResponseMapper {
    private final ObjectMapper objectMapper;

    public Aria2StatusParam mapToDownloadStatus(JsonNode resultNode) {
        if (resultNode == null || resultNode.isNull()) {
            return null;
        }

        try {
            Aria2StatusParam status = objectMapper.convertValue(resultNode, Aria2StatusParam.class);

            // Handle nested result structure if present
            if (status.getGid() == null && resultNode.has("result")) {
                JsonNode innerResult = resultNode.get("result");
                status = objectMapper.convertValue(innerResult, Aria2StatusParam.class);
            }

            return status;
        } catch (IllegalArgumentException e) {
            log.warn("Failed to map download status from JSON: {}", resultNode, e);
            return createFallbackStatus(resultNode);
        }
    }

    public List<Aria2StatusParam> mapToDownloadStatusList(JsonNode resultNode) {
        List<Aria2StatusParam> statusList = new ArrayList<>();

        if (resultNode == null || !resultNode.isArray()) {
            return statusList;
        }

        for (JsonNode item : resultNode) {
            Aria2StatusParam status = mapToDownloadStatus(item);
            if (status != null) {
                statusList.add(status);
            }
        }

        return statusList;
    }

    public Aria2GlobalStat mapToGlobalStat(JsonNode resultNode) {
        if (resultNode == null) {
            return null;
        }

        try {
            return objectMapper.convertValue(resultNode, Aria2GlobalStat.class);
        } catch (IllegalArgumentException e) {
            log.warn("Failed to map global stat from JSON: {}", resultNode, e);
            return createFallbackGlobalStat(resultNode);
        }
    }

    public Aria2Version mapToVersion(JsonNode resultNode) {
        if (resultNode == null) {
            return null;
        }

        try {
            return objectMapper.convertValue(resultNode, Aria2Version.class);
        } catch (IllegalArgumentException e) {
            log.warn("Failed to map version from JSON: {}", resultNode, e);
            return createFallbackVersion(resultNode);
        }
    }

    public Aria2AddDownloadResponse mapToAddDownloadResponse(JsonNode resultNode) {
        if (resultNode == null) {
            return null;
        }

        try {
            String gid = resultNode.asText();
            return new Aria2AddDownloadResponse(gid, "added");
        } catch (IllegalArgumentException e) {
            log.warn("Failed to map add download response from JSON: {}", resultNode, e);
            return new Aria2AddDownloadResponse(null, "error");
        }
    }

    public String mapToSimpleResult(JsonNode resultNode) {
        if (resultNode == null) {
            return null;
        }

        if (resultNode.isTextual()) {
            return resultNode.asText();
        } else if (resultNode.isNumber()) {
            return resultNode.asText();
        } else if (resultNode.isBoolean()) {
            return String.valueOf(resultNode.asBoolean());
        } else {
            return resultNode.toString();
        }
    }

    public Integer mapToIntegerResult(JsonNode resultNode) {
        if (resultNode == null || !resultNode.isNumber()) {
            return null;
        }
        return resultNode.asInt();
    }

    private Aria2StatusParam createFallbackStatus(JsonNode resultNode) {
        Aria2StatusParam status = new Aria2StatusParam();

        if (resultNode.has("gid")) {
            status.setGid(resultNode.get("gid").asText());
        }
        if (resultNode.has("status")) {
            status.setStatus(resultNode.get("status").asText());
        }
        if (resultNode.has("totalLength")) {
            status.setTotalLength(resultNode.get("totalLength").asLong());
        }
        if (resultNode.has("completedLength")) {
            status.setCompletedLength(resultNode.get("completedLength").asLong());
        }

        return status;
    }

    private Aria2GlobalStat createFallbackGlobalStat(JsonNode resultNode) {
        Aria2GlobalStat stat = new Aria2GlobalStat();

        if (resultNode.has("downloadSpeed")) {
            stat.setDownloadSpeed(resultNode.get("downloadSpeed").asLong());
        }
        if (resultNode.has("uploadSpeed")) {
            stat.setUploadSpeed(resultNode.get("uploadSpeed").asLong());
        }
        if (resultNode.has("numActive")) {
            stat.setNumActive(resultNode.get("numActive").asInt());
        }
        if (resultNode.has("numWaiting")) {
            stat.setNumWaiting(resultNode.get("numWaiting").asInt());
        }

        return stat;
    }

    private Aria2Version createFallbackVersion(JsonNode resultNode) {
        Aria2Version version = new Aria2Version();

        if (resultNode.has("version")) {
            version.setVersion(resultNode.get("version").asText());
        }

        return version;
    }
}
