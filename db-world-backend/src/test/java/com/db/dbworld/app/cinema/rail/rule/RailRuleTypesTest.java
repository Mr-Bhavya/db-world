package com.db.dbworld.app.cinema.rail.rule;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Keeps {@link RailRuleTypes} honest against {@code RailResolverImpl}'s switch.
 *
 * <p>This exists because the two drifted badly: the metadata endpoint advertised five rule types,
 * the frontend hardcoded eight, and the resolver handled ten. {@code forYou} and
 * {@code rewatchTrending} were therefore fully working rails that no admin could create, and nothing
 * failed — the lists just quietly disagreed.
 *
 * <p>Reading the resolver's source is admittedly crude, but the alternative is worse: the switch is
 * on a String from JSON, so there is no enum to reflect over, and a runtime probe can't distinguish
 * "handled, returned empty" from "fell through to default". Parsing the {@code case} labels catches
 * the mistake that actually happened — someone adds a branch and forgets the registry.
 */
class RailRuleTypesTest {

    private static final Path RESOLVER = Path.of(
            "src/main/java/com/db/dbworld/app/cinema/rail/service/impl/RailResolverImpl.java");

    /** Every {@code case "x"} label inside resolveIds' switch. */
    private static Set<String> resolverCases() throws IOException {
        String src = Files.readString(RESOLVER);

        // Narrow to the paginated ID resolver — resolveSlice has its own, smaller switch.
        int from = src.indexOf("public Slice<Long> resolveIds(RailEntity rail, Pageable pageable, Long category, PageType requestedPage)");
        assertThat(from).as("resolveIds(4-arg) should exist — did it get renamed?").isGreaterThan(0);
        int to = src.indexOf("/* ================================================================", from);
        String body = src.substring(from, to > from ? to : src.length());

        Matcher m = Pattern.compile("case\\s+\"([a-zA-Z]+)\"").matcher(body);
        Set<String> cases = new java.util.LinkedHashSet<>();
        while (m.find()) cases.add(m.group(1));
        return cases;
    }

    @Test
    void everyResolverCaseIsOfferedToAdmins() throws IOException {
        Set<String> handled = resolverCases();
        assertThat(handled).as("parsed no case labels — the regex or the switch shape changed")
                .isNotEmpty();

        assertThat(RailRuleTypes.values())
                .as("rule types the resolver handles but the admin UI can't offer — "
                        + "these are working rails nobody can create")
                .containsAll(handled);
    }

    @Test
    void everyOfferedTypeIsActuallyHandled() throws IOException {
        Set<String> handled = resolverCases();

        // The reverse drift: offering a type that falls through to `default -> empty slice`, so the
        // rail silently renders nothing.
        assertThat(handled)
                .as("rule types offered to admins that the resolver does not implement")
                .containsAll(RailRuleTypes.values());
    }

    @Test
    void everyTypeHasALabelAndDescription() {
        assertThat(RailRuleTypes.all()).allSatisfy(t -> {
            assertThat(t.value()).isNotBlank();
            assertThat(t.label()).isNotBlank();
            assertThat(t.description()).isNotBlank();
        });
    }

    @Test
    void valuesAreUnique() {
        List<String> values = RailRuleTypes.values();
        assertThat(values).doesNotHaveDuplicates();
        assertThat(values.stream().collect(Collectors.toSet())).hasSameSizeAs(values);
    }
}
