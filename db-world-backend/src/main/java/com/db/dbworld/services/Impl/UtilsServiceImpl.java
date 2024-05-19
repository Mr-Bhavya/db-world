package com.db.dbworld.services.Impl;

import bt.Bt;
import bt.BtException;
import bt.data.file.FileSystemStorage;
import bt.runtime.BtClient;
import bt.runtime.Config;
import bt.torrent.TorrentSessionState;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.YtProcessStatus;
import com.db.dbworld.services.StatusService;
import com.db.dbworld.services.UtilsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import net.sf.sevenzipjbinding.ExtractOperationResult;
import net.sf.sevenzipjbinding.IInArchive;
import net.sf.sevenzipjbinding.SevenZip;
import net.sf.sevenzipjbinding.SevenZipException;
import net.sf.sevenzipjbinding.impl.RandomAccessFileInStream;
import net.sf.sevenzipjbinding.simple.ISimpleInArchive;
import net.sf.sevenzipjbinding.simple.ISimpleInArchiveItem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
@Log4j2
public class UtilsServiceImpl implements UtilsService {

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private StatusService statusService;

    private static final String PROCESS_DOWNLOAD = "PROCESS_DOWNLOAD";
    private static final String PROCESS_AUDIO = "PROCESS_AUDIO";
    private static final String PROCESS_INFO = "PROCESS_INFO";
    private static final String PROCESS_FILENAME = "PROCESS_FILENAME";

    @Async
    @Override
    public void downloadHttpFile(MirrorStatus mirrorStatus) {

        this.statusService.addNewStatus(mirrorStatus);

        File file = new File(mirrorStatus.getTempFilePath());

        WebClient webClient = WebClient.builder()
                .baseUrl(mirrorStatus.getFileUrl())
                .build();
        Flux<DataBuffer> flux = webClient.get()
                .exchangeToFlux(response -> {
                    long contentLength = response.headers().contentLength().orElse(-1);
                    this.statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), new MirrorStatus.DownloadStatus(
                            0, contentLength, mirrorStatus.getFileSize()
                    ));
                    return response.bodyToFlux(DataBuffer.class);
                });

        try {
            FileOutputStream fileOutputStream = new FileOutputStream(file);
            DataBufferUtils.write(flux, getOutputStream(fileOutputStream, mirrorStatus))
                    .takeUntil(dataBuffer -> mirrorStatus.isCancelled())
                    .doOnComplete(() -> log.info("Download Completed for file: {}", mirrorStatus.getFileName()))
                    .doOnError(throwable -> this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), throwable.getMessage()))
                    .doFinally((signalType) -> {
                        try {
                            fileOutputStream.close();
                        } catch (IOException e) {
                            log.error(e.getMessage());
                        }
                        postDownloadTasks(mirrorStatus);
                    })
                    .subscribe(DataBufferUtils.releaseConsumer());
        } catch (Exception ex) {
            this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), ex.getMessage());
        }
    }

    @Async
    @Override
    public void downloadMagnetFile(MirrorStatus mirrorStatus) {
        try {
            this.statusService.addNewStatus(mirrorStatus);
            Config config = new Config() {
                @Override
                public int getNumOfHashingThreads() {
                    return Runtime.getRuntime().availableProcessors() * 2;
                }
            };

            // create client with a private runtime
            BtClient client = Bt.client()
                    .config(config)
                    .storage(new FileSystemStorage(Path.of(DbWorldConstants.TORRENT_DOWNLOAD_HOME_PATH)))
                    .magnet(mirrorStatus.getFileUrl())
                    .autoLoadModules()
                    .stopWhenDownloaded()
                    .afterTorrentFetched(torrent -> {
                        MirrorStatus temp = this.statusService.getStatusById(mirrorStatus.getId());
                        temp.setFileSize(torrent.getSize());
                        temp.setFileName(torrent.getName());
                        this.statusService.updateStatus(temp);
                        log.info("Fetched Torrent File: {}, size: {} and files: {}", torrent.getName(), torrent.getSize(),
                                torrent.getFiles().stream().map(torrentFile -> torrentFile.getPathElements() + ":" + torrentFile.getSize()).collect(Collectors.joining()));
                    })
                    .build();
            // launch
            client.startAsync(torrentSessionStateConsumer(client, mirrorStatus), 5000).join();
        } catch (BtException ex) {
            log.error(ex.getMessage());
        }
    }

    private Consumer<TorrentSessionState> torrentSessionStateConsumer(BtClient client, MirrorStatus mirrorStatus) {
        return torrentSessionState -> {
//            System.out.println("*********************************************************************************" );
//            System.out.println("getConnectedPeers: " + torrentSessionState.getConnectedPeers().size());
//            System.out.println("getDownloaded: " + torrentSessionState.getDownloaded());
//            System.out.println("getLeft: " + torrentSessionState.getLeft());
//            System.out.println("getPiecesComplete: " + torrentSessionState.getPiecesComplete());
//            System.out.println("getPiecesIncomplete: " + torrentSessionState.getPiecesIncomplete());
//            System.out.println("getPiecesRemaining: " + torrentSessionState.getPiecesRemaining());
//            System.out.println("getPiecesTotal: " + torrentSessionState.getPiecesTotal());
//            System.out.println("getUploaded: " + torrentSessionState.getUploaded());
//            System.out.println("*********************************************************************************\n" );

            if (this.statusService.getStatusById(mirrorStatus.getId()).isCancelled()) {
                client.stop();
                dbWorldUtils.deleteFile(mirrorStatus.getFilePath());
                this.statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
            } else if (torrentSessionState.getPiecesRemaining() == 0) {
                client.stop();
                this.statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            } else {
                this.statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), new MirrorStatus.DownloadStatus(
                        torrentSessionState.getDownloaded(),
                        torrentSessionState.getLeft(),
                        mirrorStatus.getFileSize()
                ));
            }
        };
    }

    private OutputStream getOutputStream(FileOutputStream fileOutputStream, MirrorStatus mirrorStatus) {
        return new FilterOutputStream(fileOutputStream) {
            @Override
            public void write(byte[] b, int off, int len) throws IOException {
                out.write(b, off, len);
                statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), new MirrorStatus.DownloadStatus(
                        mirrorStatus.getDownloadStatus().getFileDownloaded() + len,
                        mirrorStatus.getDownloadStatus().getFileRemaining() - len,
                        mirrorStatus.getFileSize()
                ));
            }

            @Override
            public void write(int b) throws IOException {
                out.write(b);
                statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), new MirrorStatus.DownloadStatus(
                        mirrorStatus.getDownloadStatus().getFileDownloaded() + 1,
                        mirrorStatus.getDownloadStatus().getFileRemaining() - 1,
                        mirrorStatus.getFileSize()
                ));
            }

            @Override
            public void close() throws IOException {
                super.close();
            }
        };
    }

    private void postDownloadTasks(MirrorStatus mirrorStatus) {

        try {
            if (mirrorStatus.isCancelled()) {
                Files.delete(Path.of(mirrorStatus.getTempFilePath()));
                this.statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
            } else if (mirrorStatus.isFailed()) {
                this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), null);
                Files.delete(Path.of(mirrorStatus.getTempFilePath()));
            } else {
                if (mirrorStatus.isExtract()) {
                    this.statusService.updateMirrorStatusWithExtracting(mirrorStatus.getId());
                    this.extract(mirrorStatus.getTempFilePath(), mirrorStatus.getExtractedFilePath(), null);
                    log.info("Extract Completed for file: {}", mirrorStatus.getFileName());

                }
                Files.move(Path.of(mirrorStatus.getTempFilePath()), Path.of(mirrorStatus.getFilePath()), StandardCopyOption.REPLACE_EXISTING);
                this.statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            }
        } catch (IOException ex) {
            this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), ex.getMessage());
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage());
        }
    }

    @Override
    public void extract(String sourcePath, String targetPath, String password) {
//        RandomAccessFile randomAccessFile = null;
        try {
            RandomAccessFile randomAccessFile = new RandomAccessFile(sourcePath, "r");
            RandomAccessFileInStream randomAccessFileStream = new RandomAccessFileInStream(randomAccessFile);
            IInArchive inArchive = SevenZip.openInArchive(null, randomAccessFileStream);
            ISimpleInArchive simpleInArchive = inArchive.getSimpleInterface();

            System.out.println("   Status   |    Size    | Filename");
            System.out.println("----------+------------+---------");

            for (ISimpleInArchiveItem item : simpleInArchive.getArchiveItems()) {
                if (!item.isFolder()) {
                    ExtractOperationResult result;
                    final Integer[] sizeArray = new Integer[1];
                    result = item.extractSlow(bytes -> {
                        InputStream is = new ByteArrayInputStream(bytes);
                        sizeArray[0] = bytes.length;
                        Path fullPath = Path.of(targetPath + "/" + item.getPath());
                        try {
                            Files.createDirectories(fullPath.getParent());
                            Files.write(fullPath, bytes, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
                            is.close();
                        } catch (IOException e) {
                            log.error("Error in writing file: {}. Error: {}", fullPath, e.getMessage());
                        }
                        return sizeArray[0];
                    }, password);

                    if (result == ExtractOperationResult.OK) {
                        System.out.printf("%10s | %10s | %s%n", "Success", sizeArray[0], item.getPath());
                    } else {
                        System.out.printf("%s | %10s | %s%n", "Fail", sizeArray[0], item.getPath());
//                        log.error("Error extracting archive. Extracting error: {}", result);
                    }
                }
            }
            randomAccessFile.close();
        } catch (FileNotFoundException | SevenZipException e) {
            throw new DbWorldException("Error in extracting. Error Message: " + e.getMessage());
        } catch (IOException e) {
            throw new DbWorldException("Error in closing file. Error Message: " + e.getMessage());
        }

    }

    @Override
    public JsonObject getInfoYtFile(String url) {
        String jsonInfo = null;
        JsonObject jsonInfoObj = new JsonObject();
        Process process;
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(getYtCommand(url, PROCESS_INFO, null));
            process = processBuilder.start();

            InputStream inputStream = process.getInputStream();
            String inputString = new String(inputStream.readAllBytes());
            if(inputString == null || inputString.isEmpty() || inputString.isBlank() || inputString.equals("null") || inputString.equals("null\n")){
                String errorString = new String(process.getErrorStream().readAllBytes());
                if(errorString != null && !errorString.isBlank() && !errorString.isEmpty()){
                    throw new DbWorldException(errorString);
                }
            }else{
                jsonInfoObj = new Gson().fromJson(inputString.replace("null\n", ""), JsonObject.class);
            }
            process.waitFor();
            if (jsonInfoObj == null || jsonInfoObj.isEmpty() || jsonInfoObj.isJsonNull()) {
                throw new DbWorldException("Not able to fetch details from given url: " + url);
            }
        } catch (IOException | InterruptedException  e) {
            throw new DbWorldException(e.getMessage());
        }
        log.info("Process is completed and info fetched with exit code: {}", process.exitValue());
        return jsonInfoObj;
    }

    @Async
    @Override
    public void downloadYtFile(MirrorStatus mirrorStatus) {
        statusService.addNewStatus(mirrorStatus);
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(getYtCommand(mirrorStatus.getFileUrl(), PROCESS_DOWNLOAD,mirrorStatus.getId()));
            Process process = processBuilder.start();
            new Thread(() -> {
                BufferedReader reader = null;
                try {
                    reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                    String line = null;
                    boolean isFileNameFetch = false;
                    while ((line = reader.readLine()) != null) {
                        if (statusService.getStatusById(mirrorStatus.getId()).isCancelled()) {
                            process.destroy();
                            Runtime.getRuntime().exec(new String[]{"kill", "-9", String.valueOf(process.pid())});
                            statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
                        }
                        if (line.startsWith("{\"")) {
                            YtProcessStatus ytProcessStatus = new Gson().fromJson(line, YtProcessStatus.class);
                            if (ytProcessStatus.getStatus() != null) {
                                if (ytProcessStatus.getStatus().equals("finished") && !isFileNameFetch) {
                                    MirrorStatus temp = statusService.getStatusById(mirrorStatus.getId());
                                    String[] tempArray = getYtOutputFileName(mirrorStatus).split("\\.");
                                    String fileExtension = "." + tempArray[tempArray.length - 1];

                                    temp.setFileName((mirrorStatus.getFileName() + fileExtension));
                                    temp.setFilePath(mirrorStatus.getFilePath() + fileExtension);
                                    temp.setTempFileName(mirrorStatus.getTempFileName() + fileExtension);
                                    temp.setTempFilePath(mirrorStatus.getTempFilePath() + fileExtension);
                                    statusService.updateStatus(mirrorStatus);
                                    isFileNameFetch = true;
                                }
                                MirrorStatus.DownloadStatus downloadStatus = new MirrorStatus.DownloadStatus(
                                        ytProcessStatus.getDownloaded_bytes(),
                                        ytProcessStatus.getTotal_bytes() - ytProcessStatus.getDownloaded_bytes(),
                                        ytProcessStatus.getTotal_bytes()
                                );
                                statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), downloadStatus);
                            }
                        }
                    }
                    if (process.exitValue() == 0 || process.exitValue() == 1) {
                        Files.move(Path.of(mirrorStatus.getTempFilePath()), Path.of(mirrorStatus.getFilePath()), StandardCopyOption.REPLACE_EXISTING);
                        statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
                    }
                } catch (Exception e) {
                    log.error(e.getMessage());
                    statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), e.getMessage());
                    throw new DbWorldException(e.getMessage());
                } finally {
                    if (reader != null) {
                        try {
                            reader.close();
                        } catch (IOException e) {
                            throw new DbWorldException(e.getMessage());
                        }
                    }
                }
            }).start();
            process.waitFor();
        } catch (IOException | InterruptedException ex) {
            statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), ex.getMessage());
            throw new DbWorldException(ex.getMessage());
        }
    }

    private String getYtOutputFileName(MirrorStatus mirrorStatus) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(getYtCommand(mirrorStatus.getFileUrl(), PROCESS_FILENAME, mirrorStatus.getId()));
        Process process = pb.start();

        String fileName = new String(process.getInputStream().readAllBytes()).replace("null\n","").replace("\n","");
        String error = new String(process.getErrorStream().readAllBytes());
        process.waitFor();
        int exitValue = process.exitValue();
        if(exitValue == 2){
            throw new DbWorldException(error);
        }
        log.info("Filename is fetched successfully. Fetched filename: {}", fileName);
        return fileName;
    }

    private List<String> getYtCommand(String url, String process, String statusId){
        String[] cmd = null;
        if(process.equals(PROCESS_AUDIO)){
            MirrorStatus mirrorStatus = statusService.getStatusById(statusId);
            cmd = new String[]{
                    DbWorldConstants.YTDLP_EXE_PATH,
                    "-i", "--extract-audio",
                    "--progress-template",
                    "\"%(progress)j\"",
                    url.contains(DbWorldConstants.HOTSTAR_COM) ? DbWorldConstants.YTDLP_COOKIES_CMD : "",
                    url.contains(DbWorldConstants.HOTSTAR_COM) ? DbWorldConstants.HS_COOKIES_PATH : "",
                    "-f",
                    String.format("%s", mirrorStatus.getYtdlp().getAudioITag().equals("") || mirrorStatus.getYtdlp().getAudioITag().equals("0")
                            ? "bestAudio" : mirrorStatus.getYtdlp().getAudioITag()),
                    mirrorStatus.getFileUrl(),
                    "--embed-metadata",
                    "--embed-thumbnail",
                    "-o",
                    String.format("%s.%%(ext)s", mirrorStatus.getTempFilePath())
            };
        } else if (process.equals(PROCESS_DOWNLOAD) || process.equals(PROCESS_FILENAME)) {
            MirrorStatus mirrorStatus = statusService.getStatusById(statusId);
            cmd = new String[]{
                    DbWorldConstants.YTDLP_EXE_PATH,
                    "--progress-template",
                    "\"%(progress)j\"",
                    url.contains(DbWorldConstants.HOTSTAR_COM) ? DbWorldConstants.YTDLP_COOKIES_CMD : "",
                    url.contains(DbWorldConstants.HOTSTAR_COM) ? DbWorldConstants.HS_COOKIES_PATH : "",
                    "-f",
                    String.format("%s+%s/best", mirrorStatus.getYtdlp().getVideoITag(),
                            mirrorStatus.getYtdlp().getAudioITag().equals("") || mirrorStatus.getYtdlp().getAudioITag().equals("0")
                                    ? "bestAudio" : mirrorStatus.getYtdlp().getAudioITag()),
                    mirrorStatus.getFileUrl(),
                    process.equals(PROCESS_FILENAME) ? "--get-filename" : "",
                    "-o",
                    String.format("%s.%%(ext)s", mirrorStatus.getTempFilePath())
            };
        } else if(process.equals(PROCESS_INFO)){
            cmd = new String[]{
                    DbWorldConstants.YTDLP_EXE_PATH,
                    url.contains(DbWorldConstants.HOTSTAR_COM) ? DbWorldConstants.YTDLP_COOKIES_CMD : "",
                    url.contains(DbWorldConstants.HOTSTAR_COM) ? DbWorldConstants.HS_COOKIES_PATH : "",
                    url,
                    "-J"
            };
        }
        List<String> cmdElementList = Arrays.stream(cmd).filter(cmdElement -> !cmdElement.equals("")).collect(Collectors.toList());

        log.info("Running [{}] from command: \"{}\"", process, cmdElementList.stream().collect(Collectors.joining(" ")));
        return cmdElementList;
    }

    @Override
    public HttpHeaders getHeaders(String url) {
        try {
            return WebClient.builder()
                    .baseUrl(url).build().head()
                    .acceptCharset(StandardCharsets.UTF_8).retrieve()
                    .toBodilessEntity().map(voidResponseEntity -> voidResponseEntity.getHeaders())
                    .cast(HttpHeaders.class).blockOptional().get();
        } catch (Exception ex) {
            log.error(ex);
            throw new DbWorldException(ex.getMessage());
        }
    }

}
