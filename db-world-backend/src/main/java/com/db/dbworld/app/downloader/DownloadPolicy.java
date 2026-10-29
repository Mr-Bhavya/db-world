package com.db.dbworld.app.downloader;

import java.net.InetAddress;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class DownloadPolicy {
    private DownloadPolicy() {}

    static URI validateUrl(String value) {
        try {
            URI uri = URI.create(value == null ? "" : value.trim());
            if (!List.of("https", "http").contains(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443 && uri.getPort() != 80)) {
                throw new IllegalArgumentException();
            }
            requirePublicHost(uri.getHost());
            return uri;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a public HTTP or HTTPS video URL.");
        }
    }

    static InetAddress requirePublicHost(String host) throws java.net.UnknownHostException {
        InetAddress[] addresses = InetAddress.getAllByName(host);
        for (InetAddress address : addresses) {
            if (!isPublic(address)) throw new IllegalArgumentException("Private network destinations are blocked.");
        }
        return addresses[0];
    }

    static boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
        byte[] bytes = address.getAddress();
        if (bytes.length == 16) return (bytes[0] & 0xe0) == 0x20;
        int first = Byte.toUnsignedInt(bytes[0]);
        int second = Byte.toUnsignedInt(bytes[1]);
        return first != 0 && first != 127 && first < 224
                && !(first == 100 && second >= 64 && second <= 127)
                && !(first == 169 && second == 254)
                && !(first == 192 && (second == 0 || second == 168))
                && !(first == 198 && (second == 18 || second == 19 || second == 51))
                && !(first == 203 && second == 0);
    }

    static List<String> formatArguments(String preset, String quality) {
        return formatArguments(preset, quality, null, null, null);
    }

    static List<String> ffmpegLocationArguments(String configured) {
        if (configured == null || configured.isBlank()) return List.of();
        String location = configured.trim();
        if (location.equalsIgnoreCase("ffmpeg") || location.equalsIgnoreCase("ffmpeg.exe")) return List.of();
        return List.of("--ffmpeg-location", location);
    }

    static List<String> formatArguments(String preset, String quality, String videoFormat, String audioFormat, String container) {
        for (String format : new String[]{videoFormat, audioFormat}) {
            if (format != null && !format.isBlank() && !format.matches("[A-Za-z0-9._-]{1,100}")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid media track.");
            }
        }
        if (container != null && !container.isBlank() && !List.of("auto", "mp4", "mkv", "webm").contains(container)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown video container.");
        }
        boolean audioOnly = List.of("audio", "mp3", "m4a").contains(preset);
        if (audioOnly && videoFormat != null && !videoFormat.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Audio-only output cannot include a video track.");
        }
        String selection = switch (preset) {
            case "recommended" -> "bv*[height<=1080][ext=mp4][vcodec^=avc]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b[height<=1080]";
            case "small" -> "bv*[height<=720]+ba/b[height<=720]";
            case "best" -> "bv*+ba/b";
            case "custom" -> {
                if (quality == null || !quality.matches("[1-9][0-9]{1,4}")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an available resolution.");
                }
                yield "bv*[height<=" + quality + "]+ba/b[height<=" + quality + "]";
            }
            case "audio", "mp3", "m4a" -> "ba/b";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown output preset.");
        };
        boolean selectedVideo = videoFormat != null && !videoFormat.isBlank();
        boolean selectedAudio = audioFormat != null && !audioFormat.isBlank();
        if (audioOnly && selectedAudio) selection = audioFormat;
        else if (selectedVideo) selection = videoFormat + "+" + (selectedAudio ? audioFormat : "ba");
        else if (selectedAudio) selection = switch (preset) {
            case "recommended" -> "bv[height<=1080][ext=mp4][vcodec^=avc]+" + audioFormat;
            case "small" -> "bv[height<=720]+" + audioFormat;
            case "custom" -> "bv[height<=" + quality + "]+" + audioFormat;
            default -> "bv+" + audioFormat;
        };
        if (preset.equals("mp3") || preset.equals("m4a")) {
            return List.of("-f", selection, "-x", "--audio-format", preset, "--audio-quality", "0");
        }
        if (preset.equals("audio")) return List.of("-f", selection, "-x");
        String output = container == null || container.isBlank() || "auto".equals(container)
            ? (preset.equals("recommended") && !selectedVideo && !selectedAudio ? "mp4" : "mkv") : container;
        if (container != null && !container.isBlank() && !"auto".equals(container)) {
            return List.of("-f", selection, "--merge-output-format", output, "--remux-video", output);
        }
        return List.of("-f", selection, "--merge-output-format", output);
    }
}