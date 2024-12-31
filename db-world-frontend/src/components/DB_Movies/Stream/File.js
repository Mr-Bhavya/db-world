import React, { useEffect, useState } from "react";
import { Button, Modal, ToastContainer } from "react-bootstrap";
import CommonServices from "../../CommonServices";
import Constants from "../../Constants";
import { deleteStreamFile, renameStreamFile } from "../../ApiServices";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { v1 as uuidv1 } from 'uuid';
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import DownloadFileAndroid from "./DownloadFileAndroid";
import { Browser } from "@capacitor/browser";
import { useDispatch, useSelector } from "react-redux";
import { updateDownloadStatus } from "../../../redux/action/allActions";
import HtmlJsonTable from "react-json-to-html-table"
// import MediaInfoDisplay from "./JsonViewer";
import JsonViewer from "./JsonViewer";
// import MediaInfoDisplay from "./MediaInfoDisplay";
// import MediaInfoDisplay from "./MediaInfoDisplay";


function File(props) {
    let { file, userRole } = props;
    const [videoModel, setVideoModel] = useState(false);
    const [deleteModel, setDeleteModel] = useState(false);
    const [videoUrl, setVideoUrl] = useState("");
    const [downloadUrl, setDownloadUrl] = useState("");
    const [onUrlCopied, setOnUrlCopied] = useState(false);
    const [newName, setNewName] = useState(file.fileName);
    const [onRename, setOnRename] = useState(false);
    const navigate = useNavigate();
    const [isDeleted, setIsDeleted] = useState(false);
    const [deleteLoader, setDeleteLoader] = useState(false);
    const [renameLoader, setRenameLoader] = useState(false);
    var currentFileStatus = useSelector(state => state.downloadProgressReducer);
    const [currentProgress, setCurrentProgress] = useState(currentFileStatus);
    const dispatch = useDispatch();
    let info = {
        ref: "D:\\Bhavya\\Videos\\Torrent Download\\5 Centimeters Per Second (2007).mkv",
        track: [
            {
                type: "General",
                UniqueID: "47550724048165393642482239825782508598",
                VideoCount: "1",
                AudioCount: "3",
                TextCount: "23",
                MenuCount: "1",
                FileExtension: "mkv",
                Format: "Matroska",
                Format_Version: "4",
                FileSize: "3424989147",
                Duration: "3765.765",
                OverallBitRate_Mode: "VBR",
                OverallBitRate: "7276055",
                FrameRate: "23.976",
                FrameCount: "90288",
                IsStreamable: "Yes",
                Title: "5 Centimeters Per Second (2007)",
                Movie: "5 Centimeters Per Second (2007)",
                Encoded_Date: "2022-05-10 19:40:46 UTC",
                File_Created_Date: "2024-06-15 14:55:22.958 UTC",
                File_Created_Date_Local: "2024-06-15 20:25:22.958",
                File_Modified_Date: "2024-06-15 23:05:57.414 UTC",
                File_Modified_Date_Local: "2024-06-16 04:35:57.414",
                Encoded_Application: "mkvmerge v67.0.0 ('Under Stars') 64-bit",
                Encoded_Library: "libebml v1.4.2 + libmatroska v1.6.4"
            },
            {
                type: "Video",
                StreamOrder: "0",
                ID: "1",
                UniqueID: "14449370651389640591",
                Format: "HEVC",
                Format_Profile: "Main 10",
                Format_Level: "4",
                Format_Tier: "Main",
                CodecID: "V_MPEGH/ISO/HEVC",
                Duration: "3765.762000000",
                BitRate: "2622005",
                Width: "1920",
                Height: "1080",
                Sampled_Width: "1920",
                Sampled_Height: "1080",
                PixelAspectRatio: "1.000",
                DisplayAspectRatio: "1.778",
                FrameRate_Mode: "VFR",
                FrameRate: "23.976",
                FrameRate_Num: "24000",
                FrameRate_Den: "1001",
                FrameCount: "90288",
                ColorSpace: "YUV",
                ChromaSubsampling: "4:2:0",
                BitDepth: "10",
                Delay: "0.000",
                Delay_Source: "Container",
                StreamSize: "1234230922",
                Encoded_Library: "x265 - 3.5+37+12-4e46995bc:[Windows][MSVC 1931][64 bit] 10bit",
                Encoded_Library_Name: "x265",
                Encoded_Library_Version: "3.5+37+12-4e46995bc:[Windows][MSVC 1931][64 bit] 10bit",
                // Encoded_Library_Settings: "cpuid=1111039 / frame-threads=4 / numa-pools=24 / wpp / no-pmode / no-pme / no-psnr / no-ssim / log-level=2 / input-csp=1 / input-res=1920x1080 / interlace=0 / total-frames=90288 / level-idc=0 / high-tier=1 / uhd-bd=0 / ref=5 / no-allow-non-conformance / no-repeat-headers / annexb / no-aud / no-eob / no-eos / no-hrd / info / hash=0 / no-temporal-layers / open-gop / min-keyint=23 / keyint=250 / gop-lookahead=0 / bframes=8 / b-adapt=2 / b-pyramid / bframe-bias=0 / rc-lookahead=80 / lookahead-slices=0 / scenecut=40 / no-hist-scenecut / radl=0 / no-splice / no-intra-refresh / ctu=64 / min-cu-size=8 / rect / amp / max-tu-size=32 / tu-inter-depth=4 / tu-intra-depth=4 / limit-tu=0 / rdoq-level=2 / dynamic-rd=0.00 / no-ssim-rd / signhide / tskip / nr-intra=0 / nr-inter=0 / no-constrained-intra / strong-intra-smoothing / max-merge=5 / limit-refs=0 / no-limit-modes / me=3 / subme=5 / merange=92 / temporal-mvp / no-frame-dup / no-hme / weightp / weightb / no-analyze-src-pics / deblock=0:0 / sao / no-sao-non-deblock / rd=6 / selective-sao=4 / no-early-skip / no-rskip / no-fast-intra / no-tskip-fast / no-cu-lossless / b-intra / no-splitrd-skip / rdpenalty=0 / psy-rd=2.00 / psy-rdoq=1.00 / no-rd-refine / no-lossless / cbqpoffs=0 / crqpoffs=0 / rc=crf / crf=18.0 / qcomp=0.60 / qpstep=4 / stats-write=0 / stats-read=0 / ipratio=1.40 / pbratio=1.30 / aq-mode=3 / aq-strength=1.00 / aq-bias-strength=1.00 / cutree / zone-count=0 / no-strict-cbr / qg-size=32 / no-rc-grain / qpmax=69 / qpmin=0 / no-const-vbv / sar=0 / overscan=0 / videoformat=5 / range=0 / colorprim=2 / transfer=2 / colormatrix=2 / chromaloc=0 / display-window=0 / cll=0,0 / min-luma=0 / max-luma=1023 / log2-max-poc-lsb=8 / vui-timing-info / vui-hrd-info / slices=1 / no-opt-qp-pps / no-opt-ref-list-length-pps / no-multi-pass-opt-rps / scenecut-bias=0.05 / hist-threshold=0.03 / no-opt-cu-delta-qp / no-aq-motion / no-hdr10 / no-hdr10-opt / no-dhdr10-opt / no-idr-recovery-sei / analysis-reuse-level=0 / analysis-save-reuse-level=0 / analysis-load-reuse-level=0 / scale-factor=0 / refine-intra=0 / refine-inter=0 / refine-mv=1 / refine-ctu-distortion=0 / no-limit-sao / ctu-info=0 / no-lowpass-dct / refine-analysis-type=0 / copy-pic=1 / max-ausize-factor=1.0 / no-dynamic-refine / no-single-sei / no-hevc-aq / no-svt / no-field / qp-adaptation-range=1.00 / scenecut-aware-qp=0conformance-window-offsets / right=0 / bottom=0 / decoder-max-rate=0 / no-vbv-live-multi-pass",
                Default: "Yes",
                Forced: "No"
            },
            {
                type: "Audio",
                typeorder: "1",
                StreamOrder: "1",
                ID: "2",
                UniqueID: "2",
                Format: "DTS",
                Format_Commercial_IfAny: "DTS-HD Master Audio",
                Format_Settings_Mode: "16",
                Format_Settings_Endianness: "Big",
                Format_AdditionalFeatures: "XLL",
                CodecID: "A_DTS",
                Duration: "3765.760000000",
                BitRate_Mode: "VBR",
                BitRate: "1651187",
                Channels: "6",
                ChannelPositions: "Front: L C R, Side: L R, LFE",
                ChannelLayout: "C L R Ls Rs LFE",
                SamplesPerFrame: "512",
                SamplingRate: "48000",
                SamplingCount: "180756480",
                FrameRate: "93.750",
                FrameCount: "353040",
                BitDepth: "16",
                Compression_Mode: "Lossless",
                Delay: "0.005",
                Delay_Source: "Container",
                Video_Delay: "0.005",
                StreamSize: "777247020",
                Title: "ADV English Dub DTS-HD MA 5.1",
                Language: "en",
                Default: "Yes",
                Forced: "No"
            },
            {
                StreamOrder: "2",
                ID: "3",
                UniqueID: "2952358756379460610",
                Format: "DTS",
                Format_Commercial_IfAny: "DTS-HD Master Audio",
                Format_Settings_Mode: "16",
                Format_Settings_Endianness: "Big",
                Format_AdditionalFeatures: "XLL",
                CodecID: "A_DTS",
                Duration: "3765.685000000",
                BitRate_Mode: "VBR",
                BitRate: "1877101",
                Channels: "6",
                ChannelPositions: "Front: L C R, Side: L R, LFE",
                ChannelLayout: "C L R Ls Rs LFE",
                SamplesPerFrame: "512",
                SamplingRate: "48000",
                SamplingCount: "180752880",
                FrameRate: "93.750",
                FrameCount: "353033",
                BitDepth: "16",
                Compression_Mode: "Lossless",
                Delay: "0.000",
                Delay_Source: "Container",
                Video_Delay: "0.000",
                StreamSize: "883571628",
                Title: "DTS-HD MA 5.1",
                Language: "ja",
                Default: "No",
                Forced: "No"
            },
            {
                StreamOrder: "3",
                ID: "4",
                UniqueID: "17764069725324958685",
                Format: "AC-3",
                Format_Commercial_IfAny: "Dolby Digital",
                Format_Settings_Endianness: "Big",
                CodecID: "A_AC3",
                Duration: "3765.696000000",
                BitRate_Mode: "CBR",
                BitRate: "224000",
                Channels: "2",
                ChannelPositions: "Front: L R",
                ChannelLayout: "L R",
                SamplesPerFrame: "1536",
                SamplingRate: "48000",
                SamplingCount: "180753408",
                FrameRate: "31.250",
                FrameCount: "117678",
                Compression_Mode: "Lossy",
                Delay: "0.023",
                Delay_Source: "Container",
                Video_Delay: "0.023",
                StreamSize: "105439488",
                Title: "Bang Zoom! English Dub AC3 2.0",
                Language: "en",
                ServiceKind: "CM",
                Default: "No",
                Forced: "No",
                extra: {
                    bsid: "8",
                    dialnorm: "-31",
                    dsurmod: "0",
                    acmod: "2",
                    lfeon: "0",
                    dialnorm_Average: "-31",
                    dialnorm_Minimum: "-31"
                }
            },
            {
                StreamOrder: "4",
                ID: "5",
                UniqueID: "8957628108703461052",
                Format: "ASS",
                CodecID: "S_TEXT/ASS",
                Duration: "3759.920000000",
                BitRate: "33",
                FrameRate: "0.036",
                FrameCount: "136",
                ElementCount: "136",
                Compression_Mode: "Lossless",
                StreamSize: "15648",
                Title: "BANDAI English Signs",
                Language: "en",
                Default: "Yes",
                Forced: "No"
            },
            {
                StreamOrder: "5",
                ID: "6",
                UniqueID: "10336122943115461531",
                Format: "ASS",
                CodecID: "S_TEXT/ASS",
                Duration: "3759.920000000",
                BitRate: "139",
                FrameRate: "0.228",
                FrameCount: "859",
                ElementCount: "859",
                Compression_Mode: "Lossless",
                StreamSize: "65580",
                Title: "BANDAI English Subtitles",
                Language: "en",
                Default: "No",
                Forced: "No"
            },
            {
                StreamOrder: "6",
                ID: "7",
                UniqueID: "1744650915283674498",
                Format: "ASS",
                CodecID: "S_TEXT/ASS",
                Duration: "3759.920000000",
                BitRate: "36",
                FrameRate: "0.040",
                FrameCount: "149",
                ElementCount: "149",
                Compression_Mode: "Lossless",
                StreamSize: "17052",
                Title: "ADV English Signs",
                Language: "en",
                Default: "No",
                Forced: "No"
            },
            {
                StreamOrder: "7",
                ID: "8",
                UniqueID: "13617133758321132032",
                Format: "ASS",
                CodecID: "S_TEXT/ASS",
                Duration: "3759.920000000",
                BitRate: "133",
                FrameRate: "0.203",
                FrameCount: "762",
                ElementCount: "762",
                Compression_Mode: "Lossless",
                StreamSize: "62691",
                Title: "ADV English Subtitles",
                Language: "en",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "5",
                StreamOrder: "8",
                ID: "9",
                UniqueID: "17594759124655465015",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "256832",
                FrameRate: "1.214",
                FrameCount: "4566",
                ElementCount: "4566",
                StreamSize: "120709018",
                Title: "English",
                Language: "en",
                Default: "No",
                Forced: "No"
            },
            {
                StreamOrder: "9",
                ID: "10",
                UniqueID: "14207591355522879986",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.881000000",
                BitRate: "4825",
                FrameRate: "0.040",
                FrameCount: "150",
                ElementCount: "150",
                StreamSize: "2268041",
                Title: "English (Foreign)",
                Language: "en",
                Default: "No",
                Forced: "No"
            },
            {
                StreamOrder: "10",
                ID: "11",
                UniqueID: "2195210458739161305",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "164463",
                FrameRate: "1.214",
                FrameCount: "4564",
                ElementCount: "4564",
                StreamSize: "77296268",
                Title: "Arabic",
                Language: "ar",
                Default: "No",
                Forced: "No"
            },
            {
                StreamOrder: "11",
                ID: "12",
                UniqueID: "16789770212120524205",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "231551",
                FrameRate: "1.206",
                FrameCount: "4533",
                ElementCount: "4533",
                StreamSize: "108827058",
                Title: "Chinese (Simplified)",
                Language: "zh",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "9",
                StreamOrder: "12",
                ID: "13",
                UniqueID: "1236035762680872532",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "31474",
                FrameRate: "0.326",
                FrameCount: "1227",
                ElementCount: "1227",
                StreamSize: "14792803",
                Title: "Chinese (Traditional)",
                Language: "zh",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "10",
                StreamOrder: "13",
                ID: "14",
                UniqueID: "1054345079273937065",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.840000000",
                BitRate: "22433",
                FrameRate: "0.335",
                FrameCount: "1259",
                ElementCount: "1259",
                StreamSize: "10543288",
                Title: "Dutch",
                Language: "nl",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "11",
                StreamOrder: "14",
                ID: "15",
                UniqueID: "17926434358528779937",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.840000000",
                BitRate: "21493",
                FrameRate: "0.335",
                FrameCount: "1259",
                ElementCount: "1259",
                StreamSize: "10101713",
                Title: "French",
                Language: "fr",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "12",
                StreamOrder: "15",
                ID: "16",
                UniqueID: "14991927064155079023",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "315438",
                FrameRate: "1.210",
                FrameCount: "4551",
                ElementCount: "4551",
                StreamSize: "148253039",
                Title: "German",
                Language: "de",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "13",
                StreamOrder: "16",
                ID: "17",
                UniqueID: "2291791302003161426",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "282445",
                FrameRate: "1.210",
                FrameCount: "4550",
                ElementCount: "4550",
                StreamSize: "132746466",
                Title: "Indonesian",
                Language: "id",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "14",
                StreamOrder: "17",
                ID: "18",
                UniqueID: "3820910364827198291",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "274090",
                FrameRate: "1.214",
                FrameCount: "4564",
                ElementCount: "4564",
                StreamSize: "128819991",
                Title: "Italian",
                Language: "it",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "15",
                StreamOrder: "18",
                ID: "19",
                UniqueID: "12471805024108337548",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3549.504000000",
                BitRate: "246226",
                FrameRate: "1.332",
                FrameCount: "4728",
                ElementCount: "4728",
                StreamSize: "109247900",
                Title: "Japanese",
                Language: "ja",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "16",
                StreamOrder: "19",
                ID: "20",
                UniqueID: "7433056198804827713",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "176140",
                FrameRate: "1.214",
                FrameCount: "4565",
                ElementCount: "4565",
                StreamSize: "82784108",
                Title: "Korean",
                Language: "ko",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "17",
                StreamOrder: "20",
                ID: "21",
                UniqueID: "3763132921898541482",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3745.992000000",
                BitRate: "23109",
                FrameRate: "0.295",
                FrameCount: "1104",
                ElementCount: "1104",
                StreamSize: "10820991",
                Title: "Polish",
                Language: "pl",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "18",
                StreamOrder: "21",
                ID: "22",
                UniqueID: "4255254568173135754",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "269180",
                FrameRate: "1.214",
                FrameCount: "4565",
                ElementCount: "4565",
                StreamSize: "126512168",
                Title: "Portuguese (Brazilian)",
                Language: "pt",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "19",
                StreamOrder: "22",
                ID: "23",
                UniqueID: "854014045116977259",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3553.217000000",
                BitRate: "25017",
                FrameRate: "0.336",
                FrameCount: "1194",
                ElementCount: "1194",
                StreamSize: "11111398",
                Title: "Spanish (Castilian)",
                Language: "es",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "20",
                StreamOrder: "23",
                ID: "24",
                UniqueID: "16034609773125384562",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "282699",
                FrameRate: "1.214",
                FrameCount: "4565",
                ElementCount: "4565",
                StreamSize: "132866097",
                Title: "Spanish (Latin American)",
                Language: "es",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "21",
                StreamOrder: "24",
                ID: "25",
                UniqueID: "3959728755375996138",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.923000000",
                BitRate: "275440",
                FrameRate: "1.214",
                FrameCount: "4566",
                ElementCount: "4566",
                StreamSize: "129454512",
                Title: "Thai",
                Language: "th",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "22",
                StreamOrder: "25",
                ID: "26",
                UniqueID: "4",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.882000000",
                BitRate: "4825",
                FrameRate: "0.040",
                FrameCount: "150",
                ElementCount: "150",
                StreamSize: "2268041",
                Title: "Signs & Songs (Discotek Blu-ray)",
                Language: "en",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Text",
                typeOrder: "23",
                StreamOrder: "26",
                ID: "27",
                UniqueID: "5",
                Format: "PGS",
                MuxingMode: "zlib",
                CodecID: "S_HDMV/PGS",
                Duration: "3759.882000000",
                BitRate: "33367",
                FrameRate: "0.272",
                FrameCount: "1022",
                ElementCount: "1022",
                StreamSize: "15682211",
                Title: "Full Subs (Discotek Blu-ray)",
                Language: "en",
                Default: "No",
                Forced: "No"
            },
            {
                type: "Menu",
                extra: {
                    _00_00_00_000: "en:After School In The Spring - Act 1: Cherry Blossom",
                    _00_05_40_340: "en:Akari's Letter - Act 1: Cherry Blossom",
                    _00_12_56_442: "en:The Day Of The Promise - Act 1: Cherry Blossom",
                    _00_19_08_439: "en:The Long Road - Act 1: Cherry Blossom",
                    _00_25_55_053: "en:The Reunion - Act 1: Cherry Blossom",
                    _00_32_49_593: "en:One Day Part 1 - Act 2: Cosmonaut",
                    _00_38_55_583: "en:One Day Part 2 - Act 2: Cosmonaut",
                    _00_41_13_262: "en:Surfing For Love - Act 2: Cosmonaut",
                    _00_48_31_784: "en:The Last Walk Home - Act 2: Cosmonaut",
                    _00_52_20_679: "en:Days Of 26 - Act 3: 5 Centimeters Per Second",
                    _00_55_42_714: "en:5 Centimeters Per Second - Act 3: 5 Centimeters Per Second",
                    _00_59_55_008: "en:End Credits - Act 3: 5 Centimeters Per Second"
                }
            }
        ]
    }

    const createUrls = () => {
        let tempUrl = window.location.origin + "/api/stream/watch/" + file.fileId + "?t=" + localStorage.getItem("token");
        if (window.location.port === "3000") {
            tempUrl = tempUrl.replace("3000", "9000")
        }
        file["videoUrl"] = tempUrl;
        tempUrl = tempUrl.replace("/watch", "/download")
        setDownloadUrl(tempUrl)
        file["downloadUrl"] = tempUrl;
    }

    const playVideo = (file) => {
        setVideoUrl(file.videoUrl);
        document.title = "DB World | DB Cinema - " + file.fileName;
        setVideoModel(true);
    }

    const handleStop = () => {
        setVideoModel(false);
        document.title = "DB World | DB Cinema"
    };

    const handelFileDownload = () => {
        if (Capacitor.isNativePlatform()) {
            Browser.open({ url: file.downloadUrl })
        } else {
            window.open(downloadUrl);
        }
    }

    const renameFile = async () => {
        setRenameLoader(true);
        let renameRes = await renameStreamFile(file.fileId, newName);
        if (renameRes.httpStatusCode === 200) {
            file.fileName = newName
            setOnRename(false);
        } else if (renameRes.httpStatusCode === 401 || renameRes.httpStatusCode === 403) {
            navigate(await Constants.REDIRECT(Constants.DB_MOVIES_ROUTE), { replace: true });
        } else {
            toast.error(renameRes.message);
        }
        setRenameLoader(false);
    }

    const deleteFile = async () => {
        setDeleteLoader(true)
        let deleteFileRes = await deleteStreamFile(file.fileId);
        if (deleteFileRes.httpStatusCode === 200) {
            setDeleteModel(false);
            setIsDeleted(true);
            toast.success(deleteFileRes.message);
        } else if (deleteFileRes.httpStatusCode === 401 || deleteFileRes.httpStatusCode === 403) {
            navigate(await Constants.REDIRECT(Constants.DB_MOVIES_ROUTE), { replace: true });
        } else {
            toast.error(deleteFileRes.message);
        }
        setDeleteLoader(false)
    }

    useEffect(() => {
        createUrls();
        if (currentFileStatus != null) {
            setCurrentProgress(currentFileStatus[file.fileId]);
        }
    }, [])

    useEffect(() => {
        if (currentFileStatus != null) {
            setCurrentProgress(currentFileStatus[file.fileId]);
        }
    }, [currentFileStatus])

    const resetProgress = () => {
        let progress = {
            "download": false,
            "loaded": 0,
            "pending": 0,
            "total": file.fileSize,
            "failed": false,
            "message": null
        };
        if (currentFileStatus != null) {
            currentFileStatus[file.fileId] = { file, progress }
            setCurrentProgress(currentFileStatus[file.fileId]);
            dispatch(updateDownloadStatus(currentFileStatus));
        }
    }

    return (
        isDeleted ||
        <div className="m-1"
            style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px" }}
        >
            <span style={{ overflowX: "auto" }}>📃
                {
                    onRename ? <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} /> : file.fileName
                }
                || {CommonServices.bytesToReadbleFormat(file.fileSize).value} {CommonServices.bytesToReadbleFormat(file.fileSize).suffix} ||
                &nbsp;<span className="btn btn-outline-success btn-sm" onClick={() => playVideo(file)}>▶️ Play</span>
                {
                    Constants.ADMIN_USER_ROLE.toLocaleLowerCase() === userRole?.toLocaleLowerCase() || Constants.OWNER_USER_ROLE.toLocaleLowerCase() === userRole?.toLocaleLowerCase() ?
                        <>&nbsp;
                            {
                                onRename ?
                                    renameLoader ? Constants.BUTTON_LOADER("dark", "Renaming") : <span className="btn btn-outline-success btn-sm" onClick={renameFile}>Done</span>
                                    :
                                    <span className="btn btn-outline-dark btn-sm" onClick={() => setOnRename(true)}>🖋️ Rename</span>
                            }
                            &nbsp;<span className="btn btn-outline-danger btn-sm" onClick={() => setDeleteModel(true)}>🚮 Delete</span>
                        </>
                        : ""
                }

            </span>

            {

                <Modal show={videoModel} animation onHide={handleStop} fullscreen={true}>
                    <Modal.Header closeButton>
                        <Modal.Title className="overflow-auto w-100">{document.title}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div>
                            <video id="player" class="player" controls style={{ width: "100%" }}
                                enabled autoPlay src={videoUrl}
                            ></video>
                        </div>
                        <div  style={{ width: "100%", overflowX: "auto" }} >
                            <HtmlJsonTable data={info} className="table table-sm table-striped table-bordered table-responsive"/>
                        </div>

                        <hr />

                        {/* <div className="container mt-5">
                            <h1 className="text-center mb-4">Media Info</h1>
                            <div className="card shadow-sm">
                                <div className="card-body">
                                    <JsonViewer data={info} />
                                </div>
                            </div>
                        </div> */}
                        {
                            currentProgress && currentProgress != null && typeof (currentProgress) != "undefined" && currentProgress.progress?.download ?
                                <div>
                                    <h3><u><b>Download status</b> </u></h3>
                                    {/* {console.log("currentProgress:", currentProgress)} */}
                                    <div><b>Total Size: </b>{CommonServices.bytesToReadbleFormat(file.fileSize)?.value} {CommonServices.bytesToReadbleFormat(file.fileSize)?.suffix}</div>
                                    <div className="row">
                                        <div className="col-4 col-md-2">
                                            <b>Process : </b>
                                        </div>
                                        <div className="col-8 col-md-4">
                                            <div className="progress" style={{ width: "70%" }}>
                                                <div className="progress-bar progress-bar-striped progress-bar-animated bg-success text-dark" role="progressbar"
                                                    aria-valuemin="0"
                                                    aria-valuenow={CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}
                                                    aria-valuemax="100"
                                                    style={{ width: `${CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}%` }}
                                                >
                                                    <b>{CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)} % </b>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="row">
                                        <div className="col-6 col-md-2">
                                            <b>Percentage : </b>
                                        </div>
                                        <div className="col-6 col-md-4">
                                            {CommonServices.getPercentage(currentProgress?.progress?.loaded, currentProgress?.progress?.total)}%
                                        </div>
                                    </div>
                                    <hr />
                                    <div className="row">
                                        <div class="col"><Button className="btn btn-sm btn-warning" onClick={resetProgress} >Clear Download</Button></div>
                                    </div>
                                    <div >

                                    </div>
                                </div> : ""
                        }
                    </Modal.Body>
                    <Modal.Footer>

                        {
                            onUrlCopied ?
                                <Button variant="success">
                                    Copied !
                                </Button>
                                :
                                <Button variant="primary" onClick={() => {
                                    CommonServices.handleCopy(downloadUrl)
                                    setOnUrlCopied(true)
                                    setInterval(() => {
                                        setOnUrlCopied(false)
                                    }, 5000)

                                }}>
                                    Copy Url
                                </Button>
                        }

                        {
                            Capacitor.isNativePlatform() ? <DownloadFileAndroid file={file} />
                                :
                                <button className="btn btn-danger" onClick={handelFileDownload}>
                                    Download
                                </button>
                        }
                        <Button variant="secondary" onClick={handleStop}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            }

            {
                deleteModel ?
                    <Modal show={deleteModel} animation onHide={() => setDeleteModel(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title className="overflow-auto w-100">{file.fileName}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <p>Are you Sure that you want to delete this file ?</p>
                        </Modal.Body>
                        <Modal.Footer>
                            {
                                deleteLoader ?
                                    Constants.BUTTON_LOADER("danger", "Deleteing")
                                    :
                                    <Button variant="danger" onClick={deleteFile}>
                                        Yes !!
                                    </Button>
                            }
                            <Button variant="secondary" onClick={() => setDeleteModel(false)}>
                                Close
                            </Button>
                        </Modal.Footer>
                    </Modal> : ""
            }




            <ToastContainer
                containerId={`toast_` + uuidv1()}
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={true}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            {/* {Constants.TOAST_CONTAINER} */}

        </div >
    )
}

export default File;