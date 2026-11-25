package com.db.dbworld.app.media.aria2;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class Aria2RpcServiceParallelTest {
    private static final String RPC_URL = "http://localhost:6800/jsonrpc";
    private MockRestServiceServer server;
    private Aria2RpcService service;

    @BeforeEach
    void setUp() {
        RestTemplate restTemplate = new RestTemplate();
        server = MockRestServiceServer.bindTo(restTemplate).build();
        ObjectMapper mapper = new ObjectMapper();
        service = new Aria2RpcService(restTemplate, mapper, new Aria2ResponseMapper(mapper),
                new Aria2DownloadMappingService(), RPC_URL, "test");
    }

    @Test
    void prioritizesWaitingJobAndRaisesFullLimit() {
        rpc("aria2.tellStatus", "{\"gid\":\"job\",\"status\":\"waiting\"}");
        server.expect(requestTo(RPC_URL))
                .andExpect(jsonPath("$.method").value("aria2.changePosition"))
                .andExpect(jsonPath("$.params[1]").value("job"))
                .andExpect(jsonPath("$.params[2]").value(0))
                .andRespond(withSuccess("{\"result\":0}", MediaType.APPLICATION_JSON));
        rpc("aria2.getGlobalOption", "{\"max-concurrent-downloads\":\"1\"}");
        rpc("aria2.getGlobalStat", "{\"numActive\":\"1\"}");
        server.expect(requestTo(RPC_URL))
                .andExpect(jsonPath("$.method").value("aria2.changeGlobalOption"))
                .andExpect(jsonPath("$.params[1]['max-concurrent-downloads']").value("2"))
                .andRespond(withSuccess("{\"result\":\"OK\"}", MediaType.APPLICATION_JSON));

        service.startParallelDownload("job");
        server.verify();
    }

    @Test
    void doesNotChangeLimitForAlreadyActiveJob() {
        rpc("aria2.tellStatus", "{\"gid\":\"job\",\"status\":\"active\"}");
        service.startParallelDownload("job");
        server.verify();
    }

    @Test
    void rejectsPausedJobWithoutChangingGlobalLimit() {
        rpc("aria2.tellStatus", "{\"gid\":\"job\",\"status\":\"paused\"}");
        assertThatThrownBy(() -> service.startParallelDownload("job"))
                .hasMessageContaining("paused");
        server.verify();
    }

    @Test
    void acceptsJobThatStartsWhileItsPositionIsChanged() {
        rpc("aria2.tellStatus", "{\"gid\":\"job\",\"status\":\"waiting\"}");
        server.expect(requestTo(RPC_URL))
                .andExpect(jsonPath("$.method").value("aria2.changePosition"))
                .andRespond(withSuccess("{\"error\":{\"message\":\"not waiting\"}}", MediaType.APPLICATION_JSON));
        rpc("aria2.tellStatus", "{\"gid\":\"job\",\"status\":\"active\"}");
        service.startParallelDownload("job");
        server.verify();
    }

    private void rpc(String method, String result) {
        server.expect(requestTo(RPC_URL))
                .andExpect(jsonPath("$.method").value(method))
                .andRespond(withSuccess("{\"result\":" + result + "}", MediaType.APPLICATION_JSON));
    }
}
