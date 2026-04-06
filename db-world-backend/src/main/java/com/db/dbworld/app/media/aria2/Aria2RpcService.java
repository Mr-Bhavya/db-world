package com.db.dbworld.app.media.aria2;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.app.media.aria2.model.Aria2AddDownloadResponse;
import com.db.dbworld.app.media.aria2.model.Aria2GlobalStat;
import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import com.db.dbworld.app.media.aria2.model.Aria2Version;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Aria2 JSON-RPC client — migrated from com.db.dbworld.services.aria2.Aria2RpcService.
 *
 * Key differences from the old version:
 *  - No dependency on the old StatusService; the new pipeline tracks state via
 *    TrackingService inside Aria2DownloadStrategy.
 *  - Uses the new Aria2DownloadMappingService (O(1) reverse lookup).
 *  - pause()/unpause()/forceRemove() no longer call statusService.updateMirrorStatus*();
 *    the caller (Aria2DownloadStrategy) is responsible for state transitions.
 *  - Logging stays, post-RPC mapping bookkeeping is kept via handlePostRpcActions().
 */
@Log4j2
@Service("appAria2RpcService")
public class Aria2RpcService {

    private static final Set<String> DOWNLOAD_START_METHODS = Set.of(
            "aria2.addUri", "aria2.addTorrent", "aria2.addMetalink"
    );

    private final RestTemplate               restTemplate;
    private final ObjectMapper               objectMapper;
    private final Aria2ResponseMapper        responseMapper;
    private final Aria2DownloadMappingService mappingService;
    private final String                     aria2RpcUrl;
    private final String                     secretToken;

    public Aria2RpcService(
            @Qualifier("aria2RestTemplate") RestTemplate restTemplate,
            ObjectMapper objectMapper,
            @Qualifier("appAria2ResponseMapper") Aria2ResponseMapper responseMapper,
            @Qualifier("appAria2DownloadMappingService") Aria2DownloadMappingService mappingService,
            @Value("${aria2.rpc-url}") String aria2RpcUrl,
            @Value("${aria2.secret}") String secretToken) {
        this.restTemplate   = restTemplate;
        this.objectMapper   = objectMapper;
        this.responseMapper = responseMapper;
        this.mappingService = mappingService;
        this.aria2RpcUrl    = aria2RpcUrl;
        this.secretToken    = secretToken;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Start downloads
    // ──────────────────────────────────────────────────────────────────────────

    public Aria2AddDownloadResponse addUri(String jobId, String uri, Map<String, Object> options) {
        JsonNode result = callRpc("aria2.addUri",
                new Object[]{new String[]{uri}, options != null ? options : Map.of()}, jobId);
        Aria2AddDownloadResponse resp = responseMapper.mapToAddDownloadResponse(result);
        log.info("Queued URI download — GID: {}, jobId: {}", resp.getGid(), jobId);
        return resp;
    }

    public Aria2AddDownloadResponse addTorrent(String jobId, String base64Torrent,
                                               Map<String, Object> options) {
        JsonNode result = callRpc("aria2.addTorrent",
                new Object[]{base64Torrent, new String[]{}, options != null ? options : Map.of()}, jobId);
        Aria2AddDownloadResponse resp = responseMapper.mapToAddDownloadResponse(result);
        log.info("Queued torrent — GID: {}, jobId: {}", resp.getGid(), jobId);
        return resp;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Status queries
    // ──────────────────────────────────────────────────────────────────────────

    /** Lightweight poll — uses BASIC_KEYS (gid, status, sizes). */
    public Aria2StatusParam tellStatus(String gid) {
        return tellStatus(gid, Aria2StatusKeys.BASIC_KEYS);
    }

    public Aria2StatusParam tellStatus(String gid, Set<String> keys) {
        try {
            ObjectNode resp = buildAndSend(buildTellStatusRequest("aria2.tellStatus", gid, keys));
            return responseMapper.mapToDownloadStatus(extractResult(resp));
        } catch (Exception e) {
            throw new DbWorldException("tellStatus failed for GID " + gid + ": " + e.getMessage(), e);
        }
    }

    public Aria2StatusParam requestFinalStatus(String gid) {
        try {
            return tellStatus(gid, Aria2StatusKeys.FINAL_STATUS_KEYS);
        } catch (Exception e) {
            log.error("requestFinalStatus failed for GID {}", gid, e);
            return errorStatus(gid, e.getMessage());
        }
    }

    public List<Aria2StatusParam> getActiveDownloads() {
        JsonNode result = callRpc("aria2.tellActive", new Object[]{}, null);
        return responseMapper.mapToDownloadStatusList(result);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Lifecycle management
    // ──────────────────────────────────────────────────────────────────────────

    /** Graceful pause. */
    public void pause(String gid) {
        try {
            String realGid = resolveRealGid(gid);
            callRpc("aria2.pause", new Object[]{realGid}, mappingService.getJobIdByGid(gid));
        } catch (Exception e) {
            throw new DbWorldException("pause failed for GID " + gid + ": " + e.getMessage(), e);
        }
    }

    /** Resume a paused download. */
    public void unpause(String gid) {
        try {
            callRpc("aria2.unpause", new Object[]{gid}, mappingService.getJobIdByGid(gid));
        } catch (Exception e) {
            throw new DbWorldException("unpause failed for GID " + gid + ": " + e.getMessage(), e);
        }
    }

    /** Immediate cancel — does not wait for pending I/O. */
    public void forceRemove(String gid) {
        try {
            callRpc("aria2.forceRemove", new Object[]{gid}, mappingService.getJobIdByGid(gid));
            mappingService.removeByGid(gid);
        } catch (Exception e) {
            log.error("forceRemove failed for GID {}", gid, e);
            throw new DbWorldException("forceRemove failed for GID " + gid + ": " + e.getMessage(), e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Utility
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Torrent metadata downloads have a fake GID that transitions to the real one.
     * This resolves the real GID via the followedBy field.
     */
    public String resolveRealGid(String maybeMetaGid) {
        try {
            Aria2StatusParam s = tellStatus(maybeMetaGid, Aria2StatusKeys.FOLLOWED_BY_KEY);
            if (s.getFollowedBy() != null && !s.getFollowedBy().isEmpty()) {
                String real = s.getFollowedBy().get(0);
                log.info("Resolved metadata GID {} → real GID {}", maybeMetaGid, real);
                return real;
            }
        } catch (Exception e) {
            log.warn("Could not resolve real GID for {}: {}", maybeMetaGid, e.getMessage());
        }
        return maybeMetaGid;
    }

    public Aria2GlobalStat getGlobalStat() {
        try {
            JsonNode result = callRpc("aria2.getGlobalStat", new Object[]{}, null);
            return responseMapper.mapToGlobalStat(result);
        } catch (Exception e) {
            throw new DbWorldException("getGlobalStat failed: " + e.getMessage(), e);
        }
    }

    public Aria2Version getVersion() {
        JsonNode result = callRpc("aria2.getVersion", new Object[]{}, null);
        return responseMapper.mapToVersion(result);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private RPC plumbing
    // ──────────────────────────────────────────────────────────────────────────

    private JsonNode callRpc(String method, Object[] rawParams, String jobId) {
        ObjectNode request = buildRequest(method, rawParams);
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(request.toString(), headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    aria2RpcUrl, HttpMethod.POST, entity, String.class);

            String body = response.getBody();
            if (body == null) throw new DbWorldException("Empty response from Aria2 RPC");

            ObjectNode resp = (ObjectNode) objectMapper.readTree(body);
            if (resp.has("error")) {
                String msg = resp.path("error").path("message").asText(resp.get("error").toString());
                throw new RuntimeException("Aria2 RPC error: " + msg);
            }
            if (!resp.has("result")) {
                throw new RuntimeException("Missing 'result' in Aria2 response");
            }

            JsonNode result = resp.get("result");
            handlePostRpcActions(method, jobId, result);
            return result;

        } catch (Exception e) {
            Throwable root = ("Self-suppression not permitted".equals(e.getMessage()) && e.getCause() != null)
                    ? e.getCause() : e;
            log.error("RPC call failed — method={}, jobId={}", method, jobId, root);
            throw new DbWorldException("RPC call failed [" + method + "]: " + root.getMessage(), root);
        }
    }

    private ObjectNode buildAndSend(ObjectNode request) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(request.toString(), headers);
        ResponseEntity<String> response = restTemplate.postForEntity(aria2RpcUrl, entity, String.class);
        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            return (ObjectNode) objectMapper.readTree(response.getBody());
        }
        throw new DbWorldException("HTTP " + response.getStatusCode() + " from Aria2 RPC");
    }

    private ObjectNode buildRequest(String method, Object[] rawParams) {
        ObjectNode req = objectMapper.createObjectNode();
        req.put("jsonrpc", "2.0");
        req.put("id", "1");
        req.put("method", method);
        ArrayNode params = req.putArray("params");
        params.add("token:" + secretToken);
        for (Object p : rawParams) {
            params.add(objectMapper.valueToTree(p));
        }
        return req;
    }

    private ObjectNode buildTellStatusRequest(String method, String gid, Set<String> keys) {
        ObjectNode req = objectMapper.createObjectNode();
        req.put("jsonrpc", "2.0");
        req.put("id", "ts-" + gid);
        req.put("method", method);
        ArrayNode params = req.putArray("params");
        params.add("token:" + secretToken);
        params.add(gid);
        if (keys != null && !keys.isEmpty()) {
            ArrayNode keysArr = params.addArray();
            keys.forEach(keysArr::add);
        }
        return req;
    }

    private JsonNode extractResult(ObjectNode response) {
        return response.has("result") ? response.get("result") : response;
    }

    private void handlePostRpcActions(String method, String jobId, JsonNode result) {
        if (DOWNLOAD_START_METHODS.contains(method) && result.isTextual() && jobId != null) {
            String gid = result.asText();
            mappingService.addMapping(jobId, gid);
            log.debug("Mapped jobId {} ↔ GID {}", jobId, gid);
        }
    }

    private Aria2StatusParam errorStatus(String gid, String message) {
        Aria2StatusParam s = new Aria2StatusParam();
        s.setGid(gid);
        s.setStatus("error");
        s.setErrorMessage(message);
        s.setErrorCode(-1);
        return s;
    }
}
