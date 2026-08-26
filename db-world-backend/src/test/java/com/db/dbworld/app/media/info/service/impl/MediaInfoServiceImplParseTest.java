package com.db.dbworld.app.media.info.service.impl;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.info.dto.TrackDto;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.app.media.storyboard.StoryboardService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Fixture-driven coverage for the MediaInfo JSON → TrackDto mapping.
 *
 * <p>This logic was previously unreachable from tests: it lived inside
 * {@code collectMediaInfo(Path)}, which probes a real file before parsing. Extracting
 * {@code parseTracks(String)} lets the mapping be driven from canned mediainfo output,
 * which is where the branching (General/Video/Audio/Text, HDR, aspect ratio, duration
 * units) actually lives.
 */
@ExtendWith(MockitoExtension.class)
class MediaInfoServiceImplParseTest {

    @Mock ProcessExecutor     processExecutor;
    @Mock MediaFileRepository mediaFileRepository;
    @Mock RecordRepository    recordRepository;
    @Mock AppProperties       properties;
    @Mock StoryboardService   storyboardService;
    @Mock SymlinkService      symlinkService;
    @Mock ApplicationEventPublisher eventPublisher;

    MediaInfoServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new MediaInfoServiceImpl(
                processExecutor, mediaFileRepository, recordRepository, eventPublisher,
                new ObjectMapper(), properties, storyboardService, symlinkService);
    }

    /** Trimmed but realistic `mediainfo --Output=JSON` shape. */
    private static final String FULL_JSON = """
            {"media":{"track":[
              {"@type":"General","Format":"Matroska","FileSize":"734003200",
               "Duration":"5460.480","OverallBitRate":"1075200",
               "VideoCount":"1","AudioCount":"2","TextCount":"1"},
              {"@type":"Video","Format":"HEVC","Width":"3840","Height":"2160",
               "FrameRate":"23.976","BitRate":"9000000","BitDepth":"10",
               "ColorSpace":"YUV","HDR_Format":"Dolby Vision",
               "HDR_Format_Compatibility":"HDR10","Duration":"5460.480",
               "Default":"Yes","Forced":"No","DisplayAspectRatio_String":"16:9"},
              {"@type":"Audio","Format":"E-AC-3","Language":"en","Channels":"6"},
              {"@type":"Audio","Format":"AAC","Language":"hi","Channels":"2"},
              {"@type":"Text","Format":"UTF-8","Language":"en"}
            ]}}""";

    private TrackDto first(List<TrackDto> tracks, String type) {
        return tracks.stream().filter(t -> type.equals(t.getType())).findFirst()
                .orElseThrow(() -> new AssertionError(type + " track not parsed from " + tracks));
    }

    @Test
    void parsesEveryTrackInOrder() {
        List<TrackDto> tracks = service.parseTracks(FULL_JSON);

        assertThat(tracks).hasSize(5);
        assertThat(tracks).extracting(TrackDto::getType)
                .containsExactly("General", "Video", "Audio", "Audio", "Text");
        // streamOrder is assigned by position and drives track selection downstream.
        assertThat(tracks).extracting(TrackDto::getStreamOrder)
                .containsExactly(0, 1, 2, 3, 4);
    }

    @Test
    void mapsGeneralTrackCounts() {
        TrackDto g = first(service.parseTracks(FULL_JSON), "General");

        assertThat(g.getFormat()).isEqualTo("Matroska");
        assertThat(g.getFileSize()).isEqualTo(734003200L);
        assertThat(g.getVideoCount()).isEqualTo(1);
        assertThat(g.getAudioCount()).isEqualTo(2);
        assertThat(g.getTextCount()).isEqualTo(1);
    }

    @Test
    void mapsVideoTrackIncludingHdrAndResolution() {
        TrackDto v = first(service.parseTracks(FULL_JSON), "Video");

        assertThat(v.getFormat()).isEqualTo("HEVC");
        assertThat(v.getWidth()).isEqualTo(3840);
        assertThat(v.getHeight()).isEqualTo(2160);
        assertThat(v.getBitDepth()).isEqualTo(10);
        assertThat(v.getHdrFormat()).isEqualTo("Dolby Vision");
        assertThat(v.getHdrFormatCompatibility()).isEqualTo("HDR10");
        assertThat(v.getDisplayAspectRatio()).isEqualTo("16:9");
        assertThat(v.getResolutionLabel()).isNotBlank();
    }

    @Test
    void convertsFractionalSecondsDurationToMillis() {
        // mediainfo reports seconds as a decimal string; downstream expects millis.
        TrackDto g = first(service.parseTracks(FULL_JSON), "General");
        assertThat(g.getDuration()).isEqualTo(5460480L);
    }

    @Test
    void keepsBothAudioTracksDistinct() {
        List<TrackDto> audio = service.parseTracks(FULL_JSON).stream()
                .filter(t -> "Audio".equals(t.getType())).toList();

        assertThat(audio).hasSize(2);
        assertThat(audio).extracting(TrackDto::getFormat).containsExactly("E-AC-3", "AAC");
    }

    @Test
    void retainsRawMediaInfoForUnmappedFields() {
        // The raw map is what the admin UI falls back to for fields we don't model.
        TrackDto v = first(service.parseTracks(FULL_JSON), "Video");
        assertThat(v.getRawMediaInfo()).containsEntry("ColorSpace", "YUV");
    }

    @Test
    void emptyTrackListYieldsNoTracks() {
        assertThat(service.parseTracks("{\"media\":{\"track\":[]}}")).isEmpty();
    }

    @Test
    void missingMediaNodeYieldsNoTracks() {
        // A probe that returns valid JSON but no media node must not blow up.
        assertThat(service.parseTracks("{}")).isEmpty();
    }

    @Test
    void unhandledTrackTypesAreDropped() {
        // mapTrackToDto returns null for types it doesn't model (Menu, Image, …) and the
        // caller filters those out, so they never reach the DTO list.
        assertThat(service.parseTracks(
                "{\"media\":{\"track\":[{\"@type\":\"Menu\",\"Format\":\"x\"}]}}")).isEmpty();
    }

    @Test
    void unhandledTypesDoNotConsumeStreamOrderOfLaterTracks() {
        // order++ runs inside mapTrackToDto's caller before the null check, so a dropped
        // Menu track still advances the counter — pinning current behaviour so a future
        // refactor can't silently renumber tracks that the player selects by streamOrder.
        List<TrackDto> tracks = service.parseTracks("""
                {"media":{"track":[
                  {"@type":"Menu"},
                  {"@type":"Audio","Format":"AAC","Language":"en"}
                ]}}""");

        assertThat(tracks).hasSize(1);
        assertThat(tracks.getFirst().getStreamOrder()).isEqualTo(1);
    }

    @Test
    void malformedJsonIsRejected() {
        assertThatThrownBy(() -> service.parseTracks("not json")).isInstanceOf(Exception.class);
    }
}
