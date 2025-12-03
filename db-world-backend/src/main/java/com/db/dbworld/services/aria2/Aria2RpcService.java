package com.db.dbworld.services.aria2;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.aria2.Aria2ResponseMapper;
import com.db.dbworld.services.aria2.model.*;
import com.db.dbworld.services.mirror.StatusService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Log4j2
@Service
public class Aria2RpcService {
    private static final Set<String> DOWNLOAD_START_METHODS = Set.of(
            "aria2.addUri", "aria2.addTorrent", "aria2.addMetalink"
    );
    private static final Set<String> DOWNLOAD_MANAGEMENT_METHODS = Set.of(
            "aria2.pause", "aria2.unpause", "aria2.remove"
    );

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final Aria2ResponseMapper responseMapper;
    private final String aria2RpcUrl;
    private final String secretToken;
    private final Aria2DownloadMappingService aria2DownloadMappingService;
    private final StatusService statusService;

    @Autowired
    public Aria2RpcService(@Qualifier("aria2RestTemplate") RestTemplate restTemplate,
                           ObjectMapper objectMapper,
                           Aria2ResponseMapper responseMapper,
                           @Value("${aria2.rpc.url}") String aria2RpcUrl,
                           @Value("${aria2.rpc.secret}") String secretToken,
                           Aria2DownloadMappingService aria2DownloadMappingService,
                           StatusService statusService) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.responseMapper = responseMapper;
        this.aria2RpcUrl = aria2RpcUrl;
        this.secretToken = secretToken;
        this.aria2DownloadMappingService = aria2DownloadMappingService;
        this.statusService = statusService;
    }

    // Download operations with typed responses
    public Aria2AddDownloadResponse addUri(String mirrorId, String uri, Map<String, Object> options) {
        JsonNode result = callRpc("aria2.addUri", new Object[]{
                new String[]{uri},
                options != null ? options : Map.of()
        }, mirrorId);

        Aria2AddDownloadResponse response = responseMapper.mapToAddDownloadResponse(result);
        log.info("Added download to aria2c queue. GID: {}, MirrorId: {}", response.getGid(), mirrorId);
        return response;
    }

    public Aria2AddDownloadResponse addTorrent(String mirrorId, String torrent, Map<String, Object> options) {
        JsonNode result = callRpc("aria2.addTorrent", new Object[]{
                torrent,
                new String[]{},
                options != null ? options : Map.of()
        }, mirrorId);

        Aria2AddDownloadResponse response = responseMapper.mapToAddDownloadResponse(result);
        log.info("Added torrent to aria2c. GID: {}, MirrorId: {}", response.getGid(), mirrorId);
        return response;
    }

    // Status operations with typed responses
    public Aria2StatusParam tellStatus(String gid) {
        try {
            return tellStatus(gid, Aria2StatusKeys.BASIC_KEYS);
        }catch (Exception e){
            throw new DbWorldException("Error while fetching status for GID: "+ gid + " Error: "+e.getMessage());
        }
    }

    public Aria2StatusParam tellActiveStatus(String gid){
        try {
            return tellStatus(gid, Aria2StatusKeys.ACTIVE_KEYS);
        } catch (Exception e) {
            throw new DbWorldException("Error while fetching active status for GID: "+ gid + " Error: "+e.getMessage());
        }
    }

    public Aria2StatusParam tellCompleteStatus(String gid){
        try {
            return tellStatus(gid, Aria2StatusKeys.COMPLETE_KEYS);
        } catch (Exception e) {
            throw new DbWorldException("Error while fetching complete status for GID: "+ gid + " Error: "+e.getMessage());
        }
    }

    public Aria2StatusParam tellStatus(String gid, Set<String> keys) throws Exception {
        ObjectNode response = createAndExecuteTellRequest("aria2.tellStatus", "tellStatus-" + gid, keys, gid);
        JsonNode resultNode = extractResultNode(response);
        return responseMapper.mapToDownloadStatus(resultNode);
    }

    // Download management with typed responses
    public void pause(String gid) {
        try {
            String result = executeDownloadManagement("aria2.pause", gid, "pause", "paused");
            statusService.updateMirrorStatusWithPause(aria2DownloadMappingService.getMirrorIdByGid(gid));
        } catch (Exception e) {
            throw new DbWorldException("Failed to pause download for GID: " + gid + " Error: " + e.getMessage());
        }
    }

    public void unpause(String gid) {
        try {
            String result = executeDownloadManagement("aria2.unpause", gid, "unpause", "unpaused");
            statusService.updateMirrorStatusWithResume(aria2DownloadMappingService.getMirrorIdByGid(gid));
        } catch (Exception e) {
            throw new DbWorldException("Failed to resume download for GID: " + gid + " Error: " + e.getMessage());
        }
    }

    public void remove(String gid) {
        try {
            String mirrorId = aria2DownloadMappingService.getMirrorIdByGid(gid);
            String result = executeDownloadManagement("aria2.remove", gid, "remove", "removed");
            statusService.updateMirrorStatusWithCancelled(mirrorId);
        } catch (Exception e) {
            throw new DbWorldException("Failed to stop download for GID: " + gid + " Error: " + e.getMessage());
        }
    }

    public void forceRemove(String gid) {
        try {
            String result = executeDownloadManagement("aria2.forceRemove", gid, "forceRemove", "force removed");
            statusService.updateMirrorStatusWithCancelled(aria2DownloadMappingService.getMirrorIdByGid(gid));
        } catch (Exception e) {
            log.error("Failed to force remove GID: {}", gid, e);
            throw new DbWorldException("Failed to force stop download for GID: " + gid + " Error: " + e.getMessage());
        }
    }

    // Queue management with typed responses
    public Aria2GlobalStat getGlobalStat() {
        try {
            JsonNode json = callRpc("aria2.getGlobalStat", new Object[]{}, null);
            return responseMapper.mapToGlobalStat(json);
        } catch (Exception e) {
            log.error("Failed to fetch global stats", e);
            throw new RuntimeException("Failed to get global stats", e);
        }
    }

    public Aria2Version getVersion() {
        JsonNode result = callRpc("aria2.getVersion", new Object[]{}, null);
        return responseMapper.mapToVersion(result);
    }

    // Get downloads with typed responses
    public List<Aria2StatusParam> getActiveDownloads() {
        JsonNode result = callRpc("aria2.tellActive", new Object[]{}, null);
        return responseMapper.mapToDownloadStatusList(result);
    }

    public List<Aria2StatusParam> getWaitingDownloads(int offset, int num) {
        JsonNode result = callRpc("aria2.tellWaiting", new Object[]{offset, num}, null);
        return responseMapper.mapToDownloadStatusList(result);
    }

    public List<Aria2StatusParam> getStoppedDownloads(int offset, int num) {
        JsonNode result = callRpc("aria2.tellStopped", new Object[]{offset, num}, null);
        return responseMapper.mapToDownloadStatusList(result);
    }

    // Change download position in queue
    public Integer changePosition(String gid, int pos, String how) {
        JsonNode result = callRpc("aria2.changePosition", new Object[]{gid, pos, how}, null);
        return responseMapper.mapToIntegerResult(result);
    }

    public Aria2StatusParam requestFinalStatus(String gid) {
        try {
            Aria2StatusParam status = tellStatus(gid, Aria2StatusKeys.FINAL_STATUS_KEYS);
            log.debug("Retrieved final status for GID: {} - Status: {}", gid, status.getStatus());
            return status;
        } catch (Exception e) {
            log.error("Failed to request final status for GID: {}", gid, e);
            return createErrorStatus(gid, e.getMessage());
        }
    }

    // List operations with typed responses
    public List<Aria2StatusParam> tellActive() throws Exception {
        return tellActive(Aria2StatusKeys.ACTIVE_KEYS);
    }

    public List<Aria2StatusParam> tellActive(Set<String> keys) throws Exception {
        ObjectNode response = createAndExecuteTellRequest("aria2.tellActive", "tellActive", keys, -1, -1);
        JsonNode resultNode = extractResultNode(response);
        return responseMapper.mapToDownloadStatusList(resultNode);
    }

    public List<Aria2StatusParam> tellWaiting() throws Exception {
        return tellWaiting(0, 100, Aria2StatusKeys.ACTIVE_KEYS);
    }

    public List<Aria2StatusParam> tellWaiting(int offset, int num) throws Exception {
        return tellWaiting(offset, num, Aria2StatusKeys.ACTIVE_KEYS);
    }

    public List<Aria2StatusParam> tellWaiting(int offset, int num, Set<String> keys) throws Exception {
        ObjectNode response = createAndExecuteTellRequest("aria2.tellWaiting", "tellWaiting", keys, offset, num);
        JsonNode resultNode = extractResultNode(response);
        return responseMapper.mapToDownloadStatusList(resultNode);
    }

    public List<Aria2StatusParam> tellStopped(int offset, int num) throws Exception {
        return tellStopped(offset, num, Aria2StatusKeys.BASIC_KEYS);
    }

    public List<Aria2StatusParam> tellStopped(int offset, int num, Set<String> keys) throws Exception {
        ObjectNode response = createAndExecuteTellRequest("aria2.tellStopped", "tellStopped", keys, offset, num);
        JsonNode resultNode = extractResultNode(response);
        return responseMapper.mapToDownloadStatusList(resultNode);
    }

    // Utility methods
    public String resolveRealGid(String maybeMetadataGid) {
        try {
            Aria2StatusParam status = tellStatus(maybeMetadataGid, Aria2StatusKeys.FOLLOWED_BY_KEY);
            if (status.getFollowedBy() != null && !status.getFollowedBy().isEmpty()) {
                String realGid = status.getFollowedBy().get(0);
                log.info("Resolved metadata GID {} to real GID: {}", maybeMetadataGid, realGid);
                return realGid;
            }
            return maybeMetadataGid;
        } catch (Exception e) {
            log.error("Failed to resolve real GID for: {}", maybeMetadataGid, e);
            return maybeMetadataGid;
        }
    }

    // Private helper methods (same as before but with JsonNode extraction)
    private JsonNode extractResultNode(ObjectNode response) {
        if (response.has("result")) {
            return response.get("result");
        }
        return response;
    }

    private Aria2StatusParam createErrorStatus(String gid, String errorMessage) {
        Aria2StatusParam status = new Aria2StatusParam();
        status.setGid(gid);
        status.setStatus("error");
        status.setErrorMessage(errorMessage);
        status.setErrorCode(-1);
        return status;
    }


    private JsonNode callRpc(String method, Object[] rawParams, String mirrorId) {
        try {
            ObjectNode request = createRpcRequest(method, mirrorId, rawParams);
            log.info("Making RPC call to {}: {}", aria2RpcUrl, request);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(request.toString(), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    aria2RpcUrl, HttpMethod.POST, entity, String.class);

            String body = response.getBody();
            log.info("Raw RPC response: {}", body);

            if (body == null) {
                throw new DbWorldException("Empty response from Aria2 RPC");
            }

            ObjectNode responseNode = (ObjectNode) objectMapper.readTree(body);

            if (responseNode.has("error")) {
                JsonNode errorNode = responseNode.get("error");
                String message = errorNode.has("message")
                        ? errorNode.get("message").asText()
                        : errorNode.toString();
                log.error("Aria2 RPC Error: {}", message);
                throw new RuntimeException("Aria2 RPC Error: " + message);
            }

            if (!responseNode.has("result")) {
                log.error("Missing 'result' in Aria2 RPC response: {}", body);
                throw new RuntimeException("Missing 'result' in Aria2 RPC response");
            }

            JsonNode result = responseNode.get("result");
            handlePostRpcActions(method, mirrorId, result);
            return result;

        } catch (HttpStatusCodeException ex) {
            log.error("HTTP error: Status={}, Body={}",
                    ex.getStatusCode(), ex.getResponseBodyAsString(), ex);
            throw new DbWorldException("Aria2 communication error: " + ex.getMessage(), ex);
        } catch (Exception e) {
            log.error("Error in RPC call - Method: {}, MirrorId: {}", method, mirrorId, e);
            throw new DbWorldException("RPC call failed: " + e.getMessage(), e);
        }
    }

    private ObjectNode executeRpcCall(ObjectNode request) throws Exception {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(request.toString(), headers);

            ResponseEntity<String> response = restTemplate.postForEntity(aria2RpcUrl, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return (ObjectNode) objectMapper.readTree(response.getBody());
            } else {
                throw new DbWorldException("RPC call failed with status: " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("RPC call failed for method: {}", request.path("method").asText(), e);
            throw e;
        }
    }

    private ObjectNode createRpcRequest(String method, String mirrorId, Object[] rawParams) {
        ObjectNode request = createBaseRpcRequest("1", method);
        ArrayNode paramsArray = objectMapper.createArrayNode();
        paramsArray.add("token:" + secretToken);

        for (Object param : rawParams) {
            paramsArray.add(objectMapper.valueToTree(param));
        }

        request.set("params", paramsArray);
        return request;
    }

    private ObjectNode createBaseRpcRequest(String id, String method) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("jsonrpc", "2.0");
        request.put("id", id);
        request.put("method", method);
        return request;
    }

    private ObjectNode createAndExecuteTellRequest(String method, String requestId, Set<String> keys, int offset, int num) throws Exception {
        ObjectNode request = createBaseRpcRequest(requestId + "-" + System.currentTimeMillis(), method);
        ArrayNode params = request.putArray("params");
        params.add("token:" + secretToken);

        if (offset >= 0 && num >= 0) {
            params.add(offset);
            params.add(num);
        }

        if (keys != null && !keys.isEmpty()) {
            ArrayNode keysArray = params.addArray();
            for (String key : keys) {
                keysArray.add(key);
            }
        }

        return executeRpcCall(request);
    }

    private ObjectNode createAndExecuteTellRequest(String method, String requestId, Set<String> keys, String gid) throws Exception {
        ObjectNode request = createBaseRpcRequest(requestId, method);
        ArrayNode params = request.putArray("params");
        params.add("token:" + secretToken);
        params.add(gid);

        if (keys != null && !keys.isEmpty()) {
            ArrayNode keysArray = params.addArray();
            for (String key : keys) {
                keysArray.add(key);
            }
        }

        return executeRpcCall(request);
    }

    private void handlePostRpcActions(String method, String mirrorId, JsonNode result) {
        if (DOWNLOAD_START_METHODS.contains(method) && result.isTextual()) {
            String gid = result.asText();
            aria2DownloadMappingService.addMappingToActiveDownloads(mirrorId, gid);
            log.info("Added active download mapping - GID: {} → MirrorId: {}", gid, mirrorId);
            statusService.logAndAppendHtml(statusService.getStatusById(mirrorId),
                    "Added active download mapping - GID:" + gid + "  → MirrorId: " + mirrorId, false);
        } else if (DOWNLOAD_MANAGEMENT_METHODS.contains(method) && "aria2.remove".equals(method)) {
            if (result.isTextual()) {
                String gid = result.asText();
                statusService.updateMirrorStatusWithCancelled(mirrorId);
                statusService.logAndAppendHtml(statusService.getStatusById(mirrorId),
                        "Download stopped for GID " + gid + " and mirror " + mirrorId, false);
                statusService.logAndAppendHtml(statusService.getStatusById(mirrorId),
                        "Removed download mapping for GID:" + gid + ", MirrorId: " + mirrorId, false);
                log.info("Removed download mapping for GID: {}", gid);
                aria2DownloadMappingService.removeMapping(gid);
            }
        }
    }

    private String executeDownloadManagement(String method, String gid, String action, String pastTense) {
        log.info("{} download with GID: {}", action, gid);
        try {
            String realGid = "aria2.pause".equals(method) ? resolveRealGid(gid) : gid;
            String mirrorId = aria2DownloadMappingService.getMirrorIdByGid(gid);
            String result = callRpc(method, new Object[]{realGid}, mirrorId).asText();
            log.info("Successfully {} GID: {}", pastTense, realGid);
            return result;
        } catch (Exception e) {
            log.error("Failed to {} GID: {}", action, gid, e);
            throw new DbWorldException("Failed to " + action + " download: " + e.getMessage(), e);
        }
    }
}