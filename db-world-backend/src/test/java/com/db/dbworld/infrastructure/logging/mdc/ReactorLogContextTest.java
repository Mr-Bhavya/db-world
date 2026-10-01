package com.db.dbworld.infrastructure.logging.mdc;

import io.micrometer.context.ContextRegistry;
import org.apache.logging.log4j.ThreadContext;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Hooks;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The run log finds lines by {@code jobRunId}, so it has to survive every thread a job's
 * reactive work lands on: scheduler hops, delays, and Netty's event loop for HTTP responses.
 * A real local server is used because the event-loop hop is the one that used to lose it.
 */
class ReactorLogContextTest {

    private static DisposableServer server;
    private static WebClient client;
    private static final List<String> seen = new CopyOnWriteArrayList<>();

    @BeforeAll
    static void start() {
        ReactorLogContext.install();
        server = HttpServer.create().port(0)
                .route(r -> r.get("/ok", (req, res) -> res.sendString(Mono.just("ok")))
                             .get("/missing", (req, res) -> res.status(404).send()))
                .bindNow();
        // Mirrors TmdbWebClientConfig: the response is logged from a filter, on the event loop.
        ExchangeFilterFunction logsResponse = (request, next) -> next.exchange(request)
                .doOnSuccess(r -> record("response"));
        client = WebClient.builder().baseUrl("http://localhost:" + server.port()).filter(logsResponse).build();
    }

    @AfterAll
    static void stop() {
        server.disposeNow();
        Hooks.disableAutomaticContextPropagation();
        ContextRegistry.getInstance().removeThreadLocalAccessor(ReactorLogContext.ThreadContextAccessor.KEY);
    }

    @AfterEach
    void clear() {
        ThreadContext.clearMap();
        seen.clear();
    }

    private static void record(String what) {
        seen.add(what + " on " + Thread.currentThread().getName() + " -> " + ThreadContext.get("jobRunId"));
    }

    @Test
    void schedulerHopsKeepTheRunId() {
        ThreadContext.put("jobRunId", "run-1");

        // The TMDB orchestrator's shape: paced with delayElements, each item on boundedElastic.
        Flux.just(1, 2)
                .delayElements(Duration.ofMillis(5))
                .flatMap(i -> Mono.fromRunnable(() -> record("item")).subscribeOn(Schedulers.boundedElastic()))
                .blockLast();

        assertThat(seen).hasSize(2).allSatisfy(s -> assertThat(s).endsWith("-> run-1"));
    }

    @Test
    void webClientResponsesErrorsAndRetriesKeepTheRunId() {
        ThreadContext.put("jobRunId", "run-2");

        client.get().uri("/ok").retrieve().bodyToMono(String.class).block();
        client.get().uri("/missing").retrieve().bodyToMono(String.class)
                .doOnError(e -> record("error"))
                .retryWhen(Retry.fixedDelay(1, Duration.ofMillis(5)).doBeforeRetry(s -> record("retry")))
                .onErrorResume(e -> Mono.empty())
                .block();

        assertThat(seen).isNotEmpty().allSatisfy(s -> assertThat(s).endsWith("-> run-2"));
        assertThat(seen).anySatisfy(s -> assertThat(s).contains("on reactor-http"));
        assertThat(seen).anySatisfy(s -> assertThat(s).startsWith("retry"));
    }

    @Test
    void aPoolThreadDoesNotKeepAnEarlierRunsId() {
        ThreadContext.put("jobRunId", "run-3");
        Mono.fromRunnable(() -> record("first")).subscribeOn(Schedulers.single()).block();

        ThreadContext.clearMap();
        Mono.fromRunnable(() -> record("later")).subscribeOn(Schedulers.single()).block();

        assertThat(seen).containsExactly(
                seen.get(0).replace("-> run-3", "") + "-> run-3",
                seen.get(1).replace("-> null", "") + "-> null");
        assertThat(ThreadContext.isEmpty()).isTrue();
    }
}
