package com.db.dbworld.services.aria2;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

@Log4j2
@Service
public class Aria2RpcService {
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String aria2RpcUrl;
    private final String secretToken;

    public Aria2RpcService(WebClient.Builder webClientBuilder,
                           ObjectMapper objectMapper,
                           @Value("${aria2.rpc.url}") String aria2RpcUrl,
                           @Value("${aria2.rpc.secret}") String secretToken) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        this.aria2RpcUrl = aria2RpcUrl;
        this.secretToken = secretToken;
    }

    public Mono<String> addUri(String uri, Map<String, Object> options) {
        return callRpc("aria2.addUri", new Object[]{
                new String[]{uri},
                options != null ? options : Map.of()
        }).map(JsonNode::asText);
    }

    public Mono<String> addTorrent(String torrent, Map<String, Object> options) {
        return callRpc("aria2.addTorrent", new Object[]{
                torrent,
                new String[]{},
                options != null ? options : Map.of()
        }).map(JsonNode::asText);
    }

    public Mono<String> resolveRealGid(String maybeMetadataGid) {
        return tellStatus(maybeMetadataGid)
                .map(status -> {
                    if (status.has("followedBy") && status.get("followedBy").isArray()) {
                        return status.get("followedBy").get(0).asText();
                    }
                    return maybeMetadataGid;
                });
    }

    public Mono<ObjectNode> tellStatus(String gid) {
        log.debug("Requesting status for GID: {}", gid);
        return callRpc("aria2.tellStatus", new Object[]{gid})
                .map(json -> {
                    log.debug("Status response for GID {}: {}", gid, json);
                    return (ObjectNode) json;
                })
                .onErrorResume(e -> {
                    log.error("Error getting status for GID: {}", gid, e);
                    return Mono.error(new RuntimeException("Failed to get download status: " + e.getMessage(), e));
                });
    }

    public Mono<String> pause(String gid) {
        log.debug("Attempting to pause download with GID: {}", gid);
        return resolveRealGid(gid)
                .flatMap(realGid -> {
                    log.debug("Resolved real GID: {}", realGid);
                    return callRpc("aria2.pause", new Object[]{realGid})
                            .map(JsonNode::asText)
                            .doOnSuccess(result -> log.debug("Paused GID {}: {}", realGid, result))
                            .doOnError(e -> log.error("Failed to pause GID: {}", realGid, e));
                })
                .timeout(Duration.ofSeconds(10))
                .onErrorResume(e -> {
                    log.error("Error during pause for GID: {}", gid, e);
                    return Mono.error(new RuntimeException("Failed to pause download: " + e.getMessage(), e));
                });
    }

    public Mono<String> unpause(String gid) {
        return callRpc("aria2.unpause", new Object[]{gid}).map(JsonNode::asText);
    }

    public Mono<String> remove(String gid) {
        return callRpc("aria2.forceRemove", new Object[]{gid}).map(JsonNode::asText);
    }

    public Mono<ObjectNode> getGlobalStat() {
        return callRpc("aria2.getGlobalStat", new Object[]{})
                .map(json -> (ObjectNode) json)
                .onErrorResume(e -> {
                    log.error("Failed to fetch global stats", e);
                    return Mono.error(new RuntimeException("Failed to get global stats", e));
                });
    }

    private Mono<JsonNode> callRpc(String method, Object[] rawParams) {
        try {
            ObjectNode request = objectMapper.createObjectNode();
            request.put("jsonrpc", "2.0");
            request.put("id", "1");
            request.put("method", method);

            // Inject token as the first param
            Object[] finalParams = new Object[rawParams.length + 1];
            finalParams[0] = "token:" + secretToken;
            System.arraycopy(rawParams, 0, finalParams, 1, rawParams.length);

            request.set("params", objectMapper.valueToTree(finalParams));

            log.debug("Making RPC call to {}: {}", aria2RpcUrl, request);

            return webClient.post()
                    .uri(aria2RpcUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .flatMap(body -> {
                        log.debug("Raw RPC response: {}", body);
                        try {
                            ObjectNode response = (ObjectNode) objectMapper.readTree(body);
                            if (response.has("error")) {
                                JsonNode errorNode = response.get("error");
                                String message = errorNode.has("message")
                                        ? errorNode.get("message").asText()
                                        : errorNode.toString();
                                log.error("Aria2 RPC Error: {}", message);
                                return Mono.error(new RuntimeException("Aria2 RPC Error: " + message));
                            }
                            if (!response.has("result")) {
                                log.error("Missing 'result' in Aria2 RPC response: {}", body);
                                return Mono.error(new RuntimeException("Missing 'result' in Aria2 RPC response"));
                            }
                            return Mono.just(response.get("result"));
                        } catch (Exception e) {
                            log.error("Failed to parse Aria2 response", e);
                            return Mono.error(new RuntimeException("Failed to parse Aria2 response", e));
                        }
                    })
                    .onErrorResume(WebClientResponseException.class, ex -> {
                        log.error("WebClient error: Status={}, Body={}",
                                ex.getStatusCode(), ex.getResponseBodyAsString(), ex);
                        return Mono.error(new RuntimeException("Aria2 communication error", ex));
                    });
        } catch (Exception e) {
            log.error("Error creating RPC request", e);
            return Mono.error(e);
        }
    }
}
