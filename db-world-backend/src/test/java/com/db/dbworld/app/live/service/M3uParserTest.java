package com.db.dbworld.app.live.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class M3uParserTest {

    private final M3uParser parser = new M3uParser();

    @Test
    void parses_a_minimal_playlist() {
        var text = """
                #EXTM3U
                #EXTINF:-1 tvg-id="AlJazeera.qa" tvg-logo="https://cdn/aj.png" group-title="News",Al Jazeera English
                https://live.aljazeera.com/index.m3u8
                """;

        var channels = parser.parse(text);

        assertThat(channels).hasSize(1);
        var channel = channels.getFirst();
        assertThat(channel.name()).isEqualTo("Al Jazeera English");
        assertThat(channel.tvgId()).isEqualTo("AlJazeera.qa");
        assertThat(channel.logoUrl()).isEqualTo("https://cdn/aj.png");
        assertThat(channel.groupTitle()).isEqualTo("News");
        assertThat(channel.categories()).containsExactly("News");
        assertThat(channel.url()).isEqualTo("https://live.aljazeera.com/index.m3u8");
        assertThat(channel.channelKey()).isEqualTo("aljazeera.qa");
    }

    @Test
    void name_survives_a_comma_inside_a_quoted_attribute() {
        // Splitting on the first comma outright would truncate the name to "Sport".
        var text = """
                #EXTM3U
                #EXTINF:-1 group-title="News, Sport",Star Sports 1
                https://cdn/star.m3u8
                """;

        assertThat(parser.parse(text).getFirst().name()).isEqualTo("Star Sports 1");
        assertThat(parser.parse(text).getFirst().groupTitle()).isEqualTo("News, Sport");
    }

    @Test
    void name_keeps_its_own_comma() {
        var text = """
                #EXTM3U
                #EXTINF:-1 tvg-id="x",BBC News, HD
                https://cdn/bbc.m3u8
                """;

        assertThat(parser.parse(text).getFirst().name()).isEqualTo("BBC News, HD");
    }

    @Test
    void channels_without_tvg_id_key_on_a_name_slug() {
        // These two spellings are the same channel and must merge downstream.
        var a = parser.parse("#EXTM3U\n#EXTINF:-1,Star Sports 1\nhttps://a/1.m3u8\n").getFirst();
        var b = parser.parse("#EXTM3U\n#EXTINF:-1,STAR  Sports-1 \nhttps://b/1.m3u8\n").getFirst();

        assertThat(a.channelKey()).isEqualTo("star-sports-1");
        assertThat(b.channelKey()).isEqualTo(a.channelKey());
    }

    @Test
    void the_same_channel_at_two_urls_yields_two_entries() {
        // This is the input multi-source failover is built on: one channel, two sources.
        var text = """
                #EXTM3U
                #EXTINF:-1 tvg-id="ch1",Channel One
                https://a.example/1.m3u8
                #EXTINF:-1 tvg-id="ch1",Channel One
                https://b.example/1.m3u8
                """;

        var channels = parser.parse(text);

        assertThat(channels).hasSize(2);
        assertThat(channels).extracting(M3uParser.ParsedChannel::channelKey).containsOnly("ch1");
        assertThat(channels).extracting(M3uParser.ParsedChannel::url)
                .containsExactly("https://a.example/1.m3u8", "https://b.example/1.m3u8");
    }

    @Test
    void an_exact_duplicate_line_is_collapsed() {
        var text = """
                #EXTM3U
                #EXTINF:-1 tvg-id="ch1",Channel One
                https://a.example/1.m3u8
                #EXTINF:-1 tvg-id="ch1",Channel One
                https://a.example/1.m3u8
                """;

        assertThat(parser.parse(text)).hasSize(1);
    }

    @Test
    void reads_playback_headers_from_vlc_and_kodi_directives() {
        var text = """
                #EXTM3U
                #EXTINF:-1,Guarded Channel
                #EXTVLCOPT:http-user-agent=SmartTV/1.0
                #EXTVLCOPT:http-referrer=https://portal.example/
                https://cdn/guarded.m3u8
                """;

        var channel = parser.parse(text).getFirst();

        assertThat(channel.userAgent()).isEqualTo("SmartTV/1.0");
        assertThat(channel.referer()).isEqualTo("https://portal.example/");
    }

    @Test
    void headers_do_not_leak_into_the_next_channel() {
        var text = """
                #EXTM3U
                #EXTINF:-1,First
                #EXTVLCOPT:http-user-agent=SmartTV/1.0
                https://cdn/first.m3u8
                #EXTINF:-1,Second
                https://cdn/second.m3u8
                """;

        var channels = parser.parse(text);

        assertThat(channels.get(0).userAgent()).isEqualTo("SmartTV/1.0");
        assertThat(channels.get(1).userAgent()).isNull();
    }

    @Test
    void extgrp_supplies_the_group_when_the_attribute_is_missing() {
        var text = """
                #EXTM3U
                #EXTINF:-1,Local Channel
                #EXTGRP:Regional
                https://cdn/local.m3u8
                """;

        assertThat(parser.parse(text).getFirst().groupTitle()).isEqualTo("Regional");
    }

    @Test
    void entries_with_a_finite_duration_are_vod_and_are_skipped() {
        var text = """
                #EXTM3U
                #EXTINF:7200 tvg-id="movie",Some Movie
                https://cdn/movie.mp4
                #EXTINF:-1 tvg-id="live",Live Channel
                https://cdn/live.m3u8
                """;

        assertThat(parser.parse(text))
                .extracting(M3uParser.ParsedChannel::name)
                .containsExactly("Live Channel");
    }

    @Test
    void unplayable_schemes_are_dropped() {
        // rtmp/rtsp parse fine but neither a browser nor the web adapter can open them,
        // so importing them would create channels that always fail.
        var text = """
                #EXTM3U
                #EXTINF:-1,Rtmp Channel
                rtmp://legacy.example/live
                #EXTINF:-1,Http Channel
                https://cdn/ok.m3u8
                """;

        assertThat(parser.parse(text))
                .extracting(M3uParser.ParsedChannel::name)
                .containsExactly("Http Channel");
    }

    @Test
    void falls_back_to_tvg_name_then_tvg_id_when_the_display_name_is_empty() {
        var text = """
                #EXTM3U
                #EXTINF:-1 tvg-id="only.id" tvg-name="Named Channel",
                https://cdn/a.m3u8
                #EXTINF:-1 tvg-id="bare.id",
                https://cdn/b.m3u8
                """;

        assertThat(parser.parse(text))
                .extracting(M3uParser.ParsedChannel::name)
                .containsExactly("Named Channel", "bare.id");
    }

    @Test
    void a_url_with_no_header_is_ignored() {
        var text = """
                #EXTM3U
                https://cdn/orphan.m3u8
                #EXTINF:-1,Real Channel
                https://cdn/real.m3u8
                """;

        assertThat(parser.parse(text))
                .extracting(M3uParser.ParsedChannel::name)
                .containsExactly("Real Channel");
    }

    @Test
    void blank_lines_comments_and_crlf_are_tolerated() {
        var text = "#EXTM3U\r\n\r\n# a comment\r\n#EXTINF:-1,Windows Channel\r\nhttps://cdn/win.m3u8\r\n";

        assertThat(parser.parse(text))
                .extracting(M3uParser.ParsedChannel::name)
                .containsExactly("Windows Channel");
    }

    @Test
    void empty_and_null_input_parse_to_nothing() {
        assertThat(parser.parse(null)).isEmpty();
        assertThat(parser.parse("")).isEmpty();
        assertThat(parser.parse("   \n\n")).isEmpty();
    }

    @Test
    void a_malformed_duration_is_still_treated_as_a_channel() {
        var text = """
                #EXTM3U
                #EXTINF:junk tvg-id="x",Odd Channel
                https://cdn/odd.m3u8
                """;

        assertThat(parser.parse(text))
                .extracting(M3uParser.ParsedChannel::name)
                .containsExactly("Odd Channel");
    }

    // ── Categories ───────────────────────────────────────────────────────────────
    // group-title is a LIST, not a label. iptv-org's 184 distinct values are only 30
    // real categories once split; treating them as opaque produced a page of chips
    // reading "Culture;Family", "Entertainment;General;News" and so on.

    @Test
    void a_semicolon_list_becomes_several_categories() {
        var text = """
                #EXTM3U
                #EXTINF:-1 group-title="Culture;Family",Some Channel
                https://cdn/a.m3u8
                """;

        var channel = parser.parse(text).getFirst();

        assertThat(channel.groupTitle()).isEqualTo("Culture;Family");   // raw record kept
        assertThat(channel.categories()).containsExactly("Culture", "Family");
    }

    @Test
    void the_literal_Undefined_is_not_a_category() {
        // iptv-org marks ~1,500 uncategorised channels this way; shown verbatim it became
        // the second-largest "category" on the page.
        assertThat(parser.splitCategories("Undefined")).isEmpty();
        assertThat(parser.splitCategories("undefined")).isEmpty();
        assertThat(parser.splitCategories("General;Undefined")).containsExactly("General");
    }

    @Test
    void category_splitting_handles_spacing_pipes_blanks_and_case_duplicates() {
        assertThat(parser.splitCategories("Movies ; Series")).containsExactly("Movies", "Series");
        assertThat(parser.splitCategories("News|Sports")).containsExactly("News", "Sports");
        assertThat(parser.splitCategories("News;;Sports;")).containsExactly("News", "Sports");
        // Same category twice in different spellings is one category, first spelling wins.
        assertThat(parser.splitCategories("News;news;NEWS")).containsExactly("News");
    }

    @Test
    void a_missing_group_title_yields_no_categories() {
        assertThat(parser.splitCategories(null)).isEmpty();
        assertThat(parser.splitCategories("")).isEmpty();
        assertThat(parser.splitCategories("  ;  ")).isEmpty();
        var bare = """
                #EXTM3U
                #EXTINF:-1,Bare
                https://cdn/a.m3u8
                """;
        assertThat(parser.parse(bare).getFirst().categories()).isEmpty();
    }

    @Test
    void the_real_iptv_org_shape_collapses_to_single_categories() {
        // The three most common real values, verified against the live playlist.
        assertThat(parser.splitCategories("General")).containsExactly("General");
        assertThat(parser.splitCategories("Animation;Comedy")).containsExactly("Animation", "Comedy");
        assertThat(parser.splitCategories("Entertainment;General;News"))
                .containsExactly("Entertainment", "General", "News");
    }

    // -- Quality, country and brand ----------------------------------------------

    @Test
    void the_resolution_is_lifted_out_of_the_name_onto_the_stream() {
        // iptv-org lists one channel at several qualities as separate entries sharing a
        // tvg-id. Left in the name, the merged channel would be titled after whichever
        // entry won, and the player would caption "(1080p)" while playing the 576p one.
        var text = """
                #EXTM3U
                #EXTINF:-1 tvg-id="SonyMax.in",Sony Max HD (1080p)
                https://cdn/sonymax-1080.m3u8
                #EXTINF:-1 tvg-id="SonyMax.in",Sony Max HD (576p)
                https://cdn/sonymax-576.m3u8
                """;

        var rows = parser.parse(text);

        assertThat(rows).extracting(M3uParser.ParsedChannel::name)
                .containsExactly("Sony Max HD", "Sony Max HD");
        assertThat(rows).extracting(M3uParser.ParsedChannel::quality)
                .containsExactly("1080p", "576p");
        // One channel, two sources: the merge key is unchanged by the quality.
        assertThat(rows).extracting(M3uParser.ParsedChannel::channelKey)
                .containsOnly("sonymax.in");
    }

    @Test
    void quality_parsing_handles_interlaced_and_absent_values() {
        assertThat(parser.qualityOf("Channel (720p)")).isEqualTo("720p");
        assertThat(parser.qualityOf("Channel (1080i)")).isEqualTo("1080i");
        assertThat(parser.qualityOf("Channel (240P)")).isEqualTo("240p");
        assertThat(parser.qualityOf("Channel")).isNull();
        // Only a trailing parenthesis counts — this is part of the channel's real name.
        assertThat(parser.qualityOf("Studio (1080p) Extra")).isNull();
        assertThat(parser.stripQuality("Studio (1080p) Extra")).isEqualTo("Studio (1080p) Extra");
    }

    @Test
    void country_comes_from_the_tvg_id_suffix() {
        assertThat(parser.countryOf("SonyMax.in")).isEqualTo("IN");
        assertThat(parser.countryOf("AlJazeera.qa")).isEqualTo("QA");
        assertThat(parser.countryOf("NoCountry")).isNull();
        assertThat(parser.countryOf(null)).isNull();
    }

    @Test
    void brand_is_the_first_meaningful_word() {
        // Chosen over iptv-org's `network`, which covers ~13% of channels and splits the
        // brands people search for (Zee lands under both "Z" and "Zee Media").
        assertThat(parser.brandOf("Sony Max HD")).isEqualTo("Sony");
        assertThat(parser.brandOf("Zee Cinema")).isEqualTo("Zee");
        assertThat(parser.brandOf("Star Sports 1")).isEqualTo("Star");
        // Case-folded so SONY / sony / Sony are one brand, not three.
        assertThat(parser.brandOf("SONY SAB")).isEqualTo("Sony");
    }

    @Test
    void brand_skips_words_that_identify_nothing() {
        assertThat(parser.brandOf("The Movie Channel")).isEqualTo("Movie");
        assertThat(parser.brandOf("TV Nova")).isEqualTo("Nova");
        assertThat(parser.brandOf("HD Sports")).isEqualTo("Sports");
        assertThat(parser.brandOf("   ")).isNull();
    }

    @Test
    void brand_matches_a_whole_word_not_a_prefix() {
        // The reason this takes the first WORD: a substring match would file an unrelated
        // "Starlight TV" under Star alongside Star Sports and Star Plus.
        assertThat(parser.brandOf("Starlight TV")).isEqualTo("Starlight");
        assertThat(parser.brandOf("Star Plus")).isEqualTo("Star");
    }

    @Test
    void channelKey_is_stable_for_awkward_names() {
        assertThat(parser.channelKey(null, "  ")).isEqualTo("channel");
        assertThat(parser.channelKey(null, "!!!")).isEqualTo("channel");
        assertThat(parser.channelKey(" TVG.ID ", "ignored")).isEqualTo("tvg.id");
        assertThat(parser.channelKey(null, "Zee TV (HD)")).isEqualTo("zee-tv-hd");
    }
}
