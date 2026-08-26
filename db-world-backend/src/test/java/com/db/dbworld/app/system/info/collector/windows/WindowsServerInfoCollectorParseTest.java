package com.db.dbworld.app.system.info.collector.windows;

import com.db.dbworld.app.system.info.dto.*;
import com.db.dbworld.app.system.info.dto.os.windows.*;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.mock;

/**
 * Covers the Windows collector's CIM/PowerShell and WMIC parsers.
 *
 * <p>Unlike the Linux collectors, this one needed no new seam: it performs no file I/O and
 * reaches the OS entirely through {@code exec(...)}, which was already overridable. It sat at
 * 0% coverage regardless — 1003 uncovered lines.
 *
 * <p>Commands arrive as a single string (e.g. {@code "powershell.exe -Command \"...\""}), so
 * canned responses are keyed on a distinctive fragment of the command, which is also what
 * documents which WMI class each test is standing in for.
 */
class WindowsServerInfoCollectorParseTest {

    /** command fragment -> canned stdout, matched in insertion order. */
    private final Map<String, String> canned = new LinkedHashMap<>();
    private final List<String> executed = new ArrayList<>();

    private WindowsServerInfoCollector collector;

    @BeforeEach
    void setUp() {
        canned.clear();
        executed.clear();
        collector = new WindowsServerInfoCollector(mock(ProcessExecutor.class)) {
            @Override
            protected String exec(int timeoutSeconds, String... command) {
                String joined = String.join(" ", command);
                executed.add(joined);
                return canned.entrySet().stream()
                        .filter(e -> joined.contains(e.getKey()))
                        .map(Map.Entry::getValue)
                        .findFirst()
                        .orElse("");
            }
        };
    }

    private long countExecMatching(String fragment) {
        return executed.stream().filter(c -> c.contains(fragment)).count();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Win32_Processor
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Cpu {

        @Test
        void cimProcessorJsonIsMappedWithMhzConvertedToHz() {
            canned.put("Win32_Processor", """
                    {
                      "Name": "AMD Ryzen 7 5800X 8-Core Processor",
                      "Manufacturer": "AuthenticAMD",
                      "NumberOfCores": 8,
                      "NumberOfLogicalProcessors": 16,
                      "MaxClockSpeed": 3800,
                      "CurrentClockSpeed": 4200,
                      "Architecture": 9,
                      "L2CacheSize": 4096,
                      "L3CacheSize": 32768,
                      "LoadPercentage": 12
                    }
                    """);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getName()).isEqualTo("AMD Ryzen 7 5800X 8-Core Processor");
            assertThat(cpu.getVendor()).isEqualTo("AuthenticAMD");
            assertThat(cpu.getCores()).isEqualTo(8);
            assertThat(cpu.getThreads()).isEqualTo(16);
            assertThat(cpu.getMaxFrequency()).isEqualTo(3_800_000_000L);
            assertThat(cpu.getCurrentFrequency()).isEqualTo(4_200_000_000L);
            assertThat(cpu.getArchitecture()).isEqualTo("x64");
        }

        @Test
        void architectureCodesMapToNames() {
            // Architecture 12 is ARM64 -- the code that would matter if this ever ran on a
            // Windows-on-ARM box.
            canned.put("Win32_Processor", "{\"Name\":\"Snapdragon\",\"Architecture\":12}");

            assertThat(collector.getCpuInfo().getArchitecture()).isEqualTo("ARM64");
        }

        @Test
        void anUnknownArchitectureCodeIsReportedWithItsNumber() {
            canned.put("Win32_Processor", "{\"Name\":\"Odd\",\"Architecture\":77}");

            assertThat(collector.getCpuInfo().getArchitecture()).isEqualTo("Unknown (77)");
        }

        @Test
        void perfCounterLoadWinsOverTheWmiLoadPercentage() {
            canned.put("Processor(_Total)", "37");
            canned.put("Win32_Processor", "{\"Name\":\"CPU\",\"LoadPercentage\":12}");

            // The live perf counter is the more current reading, so it must take precedence.
            assertThat(collector.getCpuInfo().getLoadPercentage()).isEqualTo(37);
        }

        @Test
        void wmiLoadPercentageIsTheFallbackWhenThePerfCounterIsUnavailable() {
            canned.put("Win32_Processor", "{\"Name\":\"CPU\",\"LoadPercentage\":12}");

            assertThat(collector.getCpuInfo().getLoadPercentage()).isEqualTo(12);
        }

        @Test
        void anEmptyCimResultFallsBackToTheWmicCsvParser() {
            // Columns are in the order wmic actually emits them -- Node first, then alphabetical
            // -- not the order the query listed. Reading by position put CurrentClockSpeed in
            // `name` and then threw on parseInt("AuthenticAMD"), collapsing the whole fallback.
            canned.put("wmic cpu get", """
                    Node,CurrentClockSpeed,L2CacheSize,L3CacheSize,Manufacturer,MaxClockSpeed,Name,NumberOfCores,NumberOfLogicalProcessors
                    DESKTOP,4200,4096,32768,AuthenticAMD,3800,AMD Ryzen 7 5800X,8,16
                    """);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(countExecMatching("wmic cpu get")).isEqualTo(1);
            assertThat(cpu.getName()).isEqualTo("AMD Ryzen 7 5800X");
            assertThat(cpu.getVendor()).isEqualTo("AuthenticAMD");
            assertThat(cpu.getCores()).isEqualTo(8);
            assertThat(cpu.getThreads()).isEqualTo(16);
            assertThat(cpu.getMaxFrequency()).isEqualTo(3_800_000_000L);
            assertThat(cpu.getCurrentFrequency()).isEqualTo(4_200_000_000L);
            assertThat(cpu.getL3Cache()).isEqualTo(32768L);
        }

        @Test
        void wmicColumnOrderAndCasingDoNotMatter() {
            // Header-driven mapping, so a different column order (or casing) still lands right.
            canned.put("wmic cpu get", """
                    NAME,MANUFACTURER,NUMBEROFCORES,MAXCLOCKSPEED,Node
                    Intel Core i7-9750H,GenuineIntel,6,2600,LAPTOP
                    """);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getName()).isEqualTo("Intel Core i7-9750H");
            assertThat(cpu.getVendor()).isEqualTo("GenuineIntel");
            assertThat(cpu.getCores()).isEqualTo(6);
            assertThat(cpu.getMaxFrequency()).isEqualTo(2_600_000_000L);
        }

        @Test
        void aWmicRowWithNoNameIsSkippedRatherThanReturnedBlank() {
            canned.put("wmic cpu get", """
                    Node,Manufacturer,Name
                    DESKTOP,AuthenticAMD,
                    """);

            assertThat(collector.getCpuInfo().getName()).isNull();
        }

        @Test
        void aTotalFailureStillReportsJvmVisibleFacts() {
            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getAvailableProcessors()).isEqualTo(Runtime.getRuntime().availableProcessors());
        }

        @Test
        void perCoreCountersBecomeCoreDetails() {
            canned.put("Win32_Processor", "{\"Name\":\"CPU\"}");
            canned.put("Processor(*)", """
                    [{"InstanceName":"0","CookedValue":11},
                     {"InstanceName":"1","CookedValue":22},
                     {"InstanceName":"2","CookedValue":33}]
                    """);

            List<CpuCore> cores = collector.getCpuInfo().getCoreDetails();

            assertThat(cores).hasSize(3);
            assertThat(cores).extracting(CpuCore::getCoreId).containsExactly(0, 1, 2);
            assertThat(cores.get(1).getLoadPercent()).isEqualTo(22.0);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Win32_OperatingSystem / Win32_PageFileUsage
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Memory {

        @Test
        void visibleMemoryIsConvertedFromKilobytesAndUsedIsDerived() {
            canned.put("TotalVisibleMemorySize, FreePhysicalMemory", """
                    {"TotalVisibleMemorySize": 33554432, "FreePhysicalMemory": 8388608}
                    """);

            MemoryInfo mem = collector.getMemoryInfo();

            assertThat(mem.getTotalBytes()).isEqualTo(33554432L * 1024);
            assertThat(mem.getFreeBytes()).isEqualTo(8388608L * 1024);
            assertThat(mem.getUsedBytes()).isEqualTo((33554432L - 8388608L) * 1024);
            assertThat(mem.getUsedPercent()).isEqualTo("75.0");
            assertThat(mem.getTotalFormatted()).isEqualTo("32.00 GB");
        }

        @Test
        void pageFileUsageIsConvertedFromMegabytes() {
            canned.put("TotalVisibleMemorySize, FreePhysicalMemory",
                    "{\"TotalVisibleMemorySize\": 1048576, \"FreePhysicalMemory\": 524288}");
            canned.put("Win32_PageFileUsage", "{\"CurrentUsage\": 512, \"AllocatedBaseSize\": 4096}");

            MemoryInfo mem = collector.getMemoryInfo();

            assertThat(mem.getSwapTotalBytes()).isEqualTo(4096L * 1024 * 1024);
            assertThat(mem.getSwapUsedBytes()).isEqualTo(512L * 1024 * 1024);
            assertThat(mem.getSwapFreeBytes()).isEqualTo((4096L - 512L) * 1024 * 1024);
        }

        @Test
        void javaHeapFiguresAreAlwaysAttached() {
            canned.put("TotalVisibleMemorySize, FreePhysicalMemory",
                    "{\"TotalVisibleMemorySize\": 1048576, \"FreePhysicalMemory\": 524288}");

            MemoryInfo mem = collector.getMemoryInfo();

            assertThat(mem.getJavaMaxMemory()).isPositive();
            assertThat(mem.getJavaTotalFormatted()).isNotBlank();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Win32_LogicalDisk
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Disks {

        private static final String TWO_FIXED_AND_A_DVD = """
                [{"DeviceID":"C:","VolumeName":"System","Size":511000000000,"FreeSpace":211000000000,
                  "FileSystem":"NTFS","Description":"Local Fixed Disk","DriveType":3},
                 {"DeviceID":"D:","VolumeName":"Data","Size":2000000000000,"FreeSpace":1500000000000,
                  "FileSystem":"NTFS","Description":"Local Fixed Disk","DriveType":3},
                 {"DeviceID":"E:","VolumeName":"UDF_DVD","Size":8500000000,"FreeSpace":0,
                  "FileSystem":"UDF","Description":"CD-ROM Disc","DriveType":5}]
                """;

        @Test
        void logicalDisksAreMappedWithUsageDerived() {
            canned.put("Win32_LogicalDisk", TWO_FIXED_AND_A_DVD);

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDrives()).extracting(DriveInfo::getDevice).containsExactly("C:", "D:");
            assertThat(disk.getDrives().get(0).getUsedBytes()).isEqualTo(511000000000L - 211000000000L);
            assertThat(disk.getDrives().get(0).getFileSystem()).isEqualTo("NTFS");
            assertThat(disk.getDrives().get(0).getType()).isEqualTo("Local Disk");
        }

        @Test
        void aMountedDiscIsExcludedFromTheTotalsAsWellAsTheDriveList() {
            canned.put("Win32_LogicalDisk", TWO_FIXED_AND_A_DVD);

            DiskInfo disk = collector.getDiskInfo();

            // The DVD used to be skipped only after its 8.5 GB had already been added to the
            // running totals, so the summary disagreed with the rows it was summarising.
            assertThat(disk.getDriveCount()).isEqualTo(2);
            assertThat(disk.getTotalSpace()).isEqualTo(511000000000L + 2000000000000L);
            assertThat(disk.getFreeSpace()).isEqualTo(211000000000L + 1500000000000L);
            assertThat(disk.getTotalSpace())
                    .isEqualTo(disk.getDrives().stream().mapToLong(DriveInfo::getTotalBytes).sum());
        }

        @Test
        void ramDisksAreExcludedToo() {
            canned.put("Win32_LogicalDisk", """
                    [{"DeviceID":"C:","Size":1000,"FreeSpace":400,"DriveType":3},
                     {"DeviceID":"R:","Size":9999,"FreeSpace":9999,"DriveType":6}]
                    """);

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDriveCount()).isEqualTo(1);
            assertThat(disk.getTotalSpace()).isEqualTo(1000L);
        }

        @Test
        void networkDrivesAreKeptAndLabelled() {
            canned.put("Win32_LogicalDisk", """
                    [{"DeviceID":"Z:","VolumeName":"share","Size":5000,"FreeSpace":2500,"DriveType":4}]
                    """);

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDrives()).singleElement()
                    .satisfies(d -> assertThat(d.getType()).isEqualTo("Network Drive"));
        }

        @Test
        void modelAndSerialAreOnlyLookedUpForLocalAndRemovableDrives() {
            canned.put("Win32_LogicalDisk", """
                    [{"DeviceID":"C:","Size":1000,"FreeSpace":400,"DriveType":3},
                     {"DeviceID":"Z:","Size":5000,"FreeSpace":2500,"DriveType":4}]
                    """);
            canned.put("wmic diskdrive", """
                    Node,Model,SerialNumber
                    DESKTOP,Samsung SSD 980 PRO,S5GXNF0R123456
                    """);

            DiskInfo disk = collector.getDiskInfo();

            // One diskdrive lookup, for C: only -- the network drive has no physical disk.
            assertThat(countExecMatching("wmic diskdrive")).isEqualTo(1);
            assertThat(disk.getDrives().get(0).getModel()).isEqualTo("Samsung SSD 980 PRO");
            assertThat(disk.getDrives().get(0).getSerial()).isEqualTo("S5GXNF0R123456");
        }

        @Test
        void emptyCimResultFallsBackToWmicCsvAndSkipsDiscsThere() {
            // Again in wmic's own column order. Positional reads previously took DriveType as
            // the size and FileSystem as the free space, so every row threw and no drive
            // survived the fallback at all.
            canned.put("wmic logicaldisk get", """
                    Node,Description,DeviceID,DriveType,FileSystem,FreeSpace,Size,VolumeName
                    DESKTOP,Local Fixed Disk,C:,3,NTFS,211000000000,511000000000,System
                    DESKTOP,CD-ROM Disc,E:,5,UDF,0,8500000000,DVD
                    """);

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDriveCount()).isEqualTo(1);
            assertThat(disk.getDrives()).singleElement().satisfies(d -> {
                assertThat(d.getDevice()).isEqualTo("C:");
                assertThat(d.getFileSystem()).isEqualTo("NTFS");
                assertThat(d.getVolumeName()).isEqualTo("System");
                assertThat(d.getTotalBytes()).isEqualTo(511000000000L);
                assertThat(d.getFreeBytes()).isEqualTo(211000000000L);
                assertThat(d.getType()).isEqualTo("Local Disk");
            });
            assertThat(disk.getTotalSpace())
                    .isEqualTo(disk.getDrives().stream().mapToLong(DriveInfo::getTotalBytes).sum());
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Win32_Process — the subList(0,4) regression
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Processes {

        private String processJson(int count) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 1; i <= count; i++) {
                if (i > 1) sb.append(',');
                sb.append("""
                        {"Name":"proc%d.exe","ProcessId":%d,"ParentProcessId":4,
                         "WorkingSetSize":%d,"CommandLine":"C:\\\\proc%d.exe","ThreadCount":%d,"Priority":8}
                        """.formatted(i, 1000 + i, 1048576L * i, i, i));
            }
            return sb.append(']').toString();
        }

        @Test
        void allProcessesAreReturnedNotJustTheFirstFour() {
            // Regression: a hardcoded subList(0, 4) capped this at four rows regardless of input.
            canned.put("Win32_Process", processJson(12));

            List<ProcessInfo> processes = collector.getRunningProcesses();

            assertThat(processes).hasSize(12);
        }

        @Test
        void fewerThanFourProcessesNoLongerThrowsAndLosesEverything() {
            // subList(0, 4) on a 2-element list threw IndexOutOfBoundsException, which the
            // method-level catch turned into an empty list.
            canned.put("Win32_Process", processJson(2));

            assertThat(collector.getRunningProcesses()).hasSize(2);
        }

        @Test
        void anEmptyProcessQueryYieldsAnEmptyListRatherThanAnError() {
            canned.put("Win32_Process", "[]");

            assertThat(collector.getRunningProcesses()).isEmpty();
        }

        @Test
        void processesAreCappedAtFiftyBusiest() {
            canned.put("Win32_Process", processJson(80));

            assertThat(collector.getRunningProcesses()).hasSize(50);
        }

        @Test
        void processesAreSortedByCpuDescendingUsingTheBulkCounterMap() {
            canned.put("Win32_Process", processJson(3));
            // Instance names carry the pid after a '#'; 1002 is the busiest.
            canned.put("Process(*)", """
                    [{"InstanceName":"proc1#1001","CookedValue":5},
                     {"InstanceName":"proc2#1002","CookedValue":90},
                     {"InstanceName":"proc3#1003","CookedValue":40}]
                    """);

            List<ProcessInfo> processes = collector.getRunningProcesses();

            assertThat(processes).extracting(ProcessInfo::getPid).containsExactly(1002, 1003, 1001);
            assertThat(processes.get(0).getCpuUsage()).isEqualTo(90.0);
        }

        @Test
        void aCounterInstanceWithoutAPidSuffixIsIgnored() {
            canned.put("Win32_Process", processJson(1));
            canned.put("Process(*)", """
                    [{"InstanceName":"Idle","CookedValue":99},
                     {"InstanceName":"proc1#1001","CookedValue":7}]
                    """);

            assertThat(collector.getRunningProcesses()).singleElement()
                    .satisfies(p -> assertThat(p.getCpuUsage()).isEqualTo(7.0));
        }

        @Test
        void nonPositiveOrMissingPidsAreSkipped() {
            canned.put("Win32_Process", """
                    [{"Name":"Idle","ProcessId":0,"WorkingSetSize":8192},
                     {"Name":"ghost.exe","WorkingSetSize":8192},
                     {"Name":"real.exe","ProcessId":1234,"WorkingSetSize":8192}]
                    """);

            assertThat(collector.getRunningProcesses()).extracting(ProcessInfo::getName)
                    .containsExactly("real.exe");
        }

        @Test
        void ownerLookupIsBoundedToTheProcessesActuallyReturned() {
            canned.put("Win32_Process", processJson(80));
            canned.put("-IncludeUserName", "DESKTOP\\\\bhavya");

            collector.getRunningProcesses();

            // One command per retained process, not one per process on the box.
            assertThat(countExecMatching("-IncludeUserName")).isEqualTo(50);
        }

        @Test
        void anElevationErrorFromTheOwnerLookupFallsBackToSystem() {
            canned.put("Win32_Process", processJson(1));
            canned.put("-IncludeUserName", "Get-Process : IncludeUserNameRequiresElevation");
            canned.put("wmic process where", "Node,Caption,ExecutablePath\nDESKTOP,proc1.exe,C:\\proc1.exe");

            assertThat(collector.getRunningProcesses()).singleElement()
                    .satisfies(p -> assertThat(p.getUser()).isEqualTo("SYSTEM"));
        }

        @Test
        void workingSetIsCarriedThroughFormatted() {
            canned.put("Win32_Process", processJson(1));

            assertThat(collector.getRunningProcesses()).singleElement().satisfies(p -> {
                assertThat(p.getMemoryBytes()).isEqualTo(1048576L);
                assertThat(p.getMemoryFormatted()).isEqualTo("1.00 MB");
                assertThat(p.getThreads()).isEqualTo(1);
                assertThat(p.getState()).isEqualTo("Running");
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Win32_Service — the subList(0,5) regression
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Services {

        private String serviceJson(int count) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 1; i <= count; i++) {
                if (i > 1) sb.append(',');
                sb.append("""
                        {"Name":"svc%02d","DisplayName":"Service %02d","Description":"d%d",
                         "State":"Running","StartMode":"Auto","PathName":"C:\\\\svc%d.exe",
                         "ProcessId":%d,"StartName":"LocalSystem"}
                        """.formatted(i, i, i, i, 2000 + i));
            }
            return sb.append(']').toString();
        }

        @Test
        void allServicesAreReturnedNotJustTheFirstFive() {
            // Regression: a hardcoded subList(0, 5) capped this at five rows.
            canned.put("Win32_Service", serviceJson(20));

            assertThat(collector.getRunningServices()).hasSize(20);
        }

        @Test
        void fewerThanFiveServicesNoLongerThrowsAndLosesEverything() {
            canned.put("Win32_Service", serviceJson(2));

            assertThat(collector.getRunningServices()).hasSize(2);
        }

        @Test
        void servicesAreSortedByName() {
            canned.put("Win32_Service", """
                    [{"Name":"zeta","State":"Running","ProcessId":0},
                     {"Name":"alpha","State":"Stopped","ProcessId":0},
                     {"Name":"mid","State":"Running","ProcessId":0}]
                    """);

            assertThat(collector.getRunningServices()).extracting(ServiceInfo::getName)
                    .containsExactly("alpha", "mid", "zeta");
        }

        @Test
        void serviceFieldsAreMapped() {
            canned.put("Win32_Service", serviceJson(1));

            assertThat(collector.getRunningServices()).singleElement().satisfies(s -> {
                assertThat(s.getName()).isEqualTo("svc01");
                assertThat(s.getDisplayName()).isEqualTo("Service 01");
                assertThat(s.getStatus()).isEqualTo("Running");
                assertThat(s.getStartType()).isEqualTo("Auto");
                assertThat(s.getUser()).isEqualTo("LocalSystem");
            });
        }

        @Test
        void memoryComesFromASingleBulkLookupRatherThanOnePerService() {
            canned.put("Win32_Service", serviceJson(20));
            canned.put("Get-Process | Select-Object Id, WorkingSet64", """
                    [{"Id":2001,"WorkingSet64":10485760},
                     {"Id":2002,"WorkingSet64":20971520}]
                    """);

            List<ServiceInfo> services = collector.getRunningServices();

            assertThat(countExecMatching("WorkingSet64")).isEqualTo(1);
            assertThat(services.get(0).getMemoryUsage()).isEqualTo(10485760L);
            assertThat(services.get(1).getMemoryUsage()).isEqualTo(20971520L);
            // A service whose pid isn't in the map reports 0 rather than failing.
            assertThat(services.get(2).getMemoryUsage()).isZero();
        }

        @Test
        void servicesWithoutARunningProcessSkipTheMemoryLookup() {
            canned.put("Win32_Service", """
                    [{"Name":"stopped","State":"Stopped","ProcessId":0}]
                    """);

            assertThat(collector.getRunningServices()).singleElement()
                    .satisfies(s -> assertThat(s.getMemoryUsage()).isNull());
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Win32_OperatingSystem / Win32_BIOS / WindowsInfo
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class ServerBiosAndOsSpecific {

        @Test
        void operatingSystemFieldsAreMapped() {
            canned.put("Caption, Version, BuildNumber, OSArchitecture", """
                    {"Caption":"Microsoft Windows 11 Enterprise","Version":"10.0.26200",
                     "BuildNumber":"26200","OSArchitecture":"64-bit","CSName":"DESKTOP-DBW",
                     "Manufacturer":"Microsoft Corporation","SerialNumber":"00330-80000-00000-AA123"}
                    """);

            ServerInfo info = collector.getServerInfo();

            assertThat(info.getOsName()).isEqualTo("Microsoft Windows 11 Enterprise");
            assertThat(info.getOsVersion()).isEqualTo("10.0.26200");
            assertThat(info.getOsArchitecture()).isEqualTo("64-bit");
            assertThat(info.getHostname()).isEqualTo("DESKTOP-DBW");
            assertThat(info.getDistribution()).isEqualTo("Windows");
        }

        @Test
        void anEmptyOsQueryFallsBackToJvmSystemProperties() {
            ServerInfo info = collector.getServerInfo();

            assertThat(info.getOsName()).isEqualTo(System.getProperty("os.name"));
            assertThat(info.getDistribution()).isEqualTo("Windows");
        }

        @Test
        void biosFieldsAreMapped() {
            canned.put("Win32_BIOS", """
                    {"Manufacturer":"American Megatrends Inc.","SMBIOSBIOSVersion":"F31",
                     "Version":"ALASKA - 1072009","ReleaseDate":""}
                    """);

            BiosInfo bios = collector.getBiosInfo();

            assertThat(bios.getVendor()).isEqualTo("American Megatrends Inc.");
            assertThat(bios.getVersion()).isEqualTo("F31");
            assertThat(bios.getFirmwareRevision()).isEqualTo("ALASKA - 1072009");
        }

        @Test
        void anEmptyBiosQueryReturnsAnEmptyObjectRatherThanNull() {
            assertThat(collector.getBiosInfo()).isNotNull();
        }

        @Test
        void windowsEditionIsExtractedFromTheCaption() {
            canned.put("RegisteredUser, Organization", """
                    {"Caption":"Microsoft Windows 11 Enterprise","BuildNumber":"26200",
                     "RegisteredUser":"bhavya","Organization":"DBWorld","SerialNumber":"PID-123"}
                    """);
            canned.put("Get-TimeZone", "{\"Id\":\"India Standard Time\",\"DisplayName\":\"(UTC+05:30) Chennai\"}");

            WindowsInfo info = (WindowsInfo) collector.getOsSpecificInfo();

            assertThat(info.getBuildNumber()).isEqualTo("26200");
            assertThat(info.getRegisteredOwner()).isEqualTo("bhavya");
            assertThat(info.getRegisteredOrganization()).isEqualTo("DBWorld");
            assertThat(info.getEdition()).contains("Enterprise");
        }

        @Test
        void temperatureIsReportedAsUnavailableOnWindows() {
            TemperatureInfo temp = collector.getTemperatureInfo();

            assertThat(temp.getHasTemperatureSensors()).isFalse();
            assertThat(temp.getStatus()).contains("not available");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Hardware details
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Hardware {

        @Test
        void baseBoardBecomesMotherboardInfo() {
            canned.put("Win32_BaseBoard", """
                    {"Manufacturer":"Gigabyte Technology Co., Ltd.","Product":"X570 AORUS ELITE",
                     "SerialNumber":"Default string","Version":"x.x"}
                    """);

            WindowsHardwareDetails hw = (WindowsHardwareDetails) collector.getHardwareDetails();

            assertThat(hw.getMotherboard()).isNotNull();
            assertThat(hw.getMotherboard().getManufacturer()).isEqualTo("Gigabyte Technology Co., Ltd.");
            assertThat(hw.getMotherboard().getProduct()).isEqualTo("X570 AORUS ELITE");
        }

        @Test
        void soundDevicesBecomeAudioDevices() {
            canned.put("Win32_SoundDevice", """
                    [{"Name":"Realtek(R) Audio","Manufacturer":"Realtek","Status":"OK"},
                     {"Name":"NVIDIA High Definition Audio","Manufacturer":"NVIDIA","Status":"OK"}]
                    """);

            WindowsHardwareDetails hw = (WindowsHardwareDetails) collector.getHardwareDetails();

            assertThat(hw.getAudioDevices()).extracting(AudioDevice::getName)
                    .containsExactly("Realtek(R) Audio", "NVIDIA High Definition Audio");
        }

        @Test
        void aSingleJsonObjectIsAcceptedWhereAListIsAlsoValid() {
            // ConvertTo-Json emits a bare object when there is exactly one result, not a
            // one-element array -- parsePowerShellJson has to cope with both.
            canned.put("Win32_SoundDevice", "{\"Name\":\"Realtek(R) Audio\",\"Status\":\"OK\"}");

            WindowsHardwareDetails hw = (WindowsHardwareDetails) collector.getHardwareDetails();

            assertThat(hw.getAudioDevices()).singleElement()
                    .satisfies(d -> assertThat(d.getName()).isEqualTo("Realtek(R) Audio"));
        }

        @Test
        void absentHardwareQueriesDegradeToEmptyCollections() {
            WindowsHardwareDetails hw = (WindowsHardwareDetails) collector.getHardwareDetails();

            assertThat(hw.getAudioDevices()).isEmpty();
            assertThat(hw.getUsbDevices()).isEmpty();
            assertThat(hw.getMotherboard()).isNull();
        }

        @Test
        void malformedJsonIsSwallowedRatherThanPropagated() {
            canned.put("Win32_SoundDevice", "{ this is not json");

            WindowsHardwareDetails hw = (WindowsHardwareDetails) collector.getHardwareDetails();

            assertThat(hw.getAudioDevices()).isEmpty();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Performance counters
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Performance {

        @Test
        void mixedCaseCounterPathsAreAlsoRouted() {
            // Robust either way: the routing no longer depends on Get-Counter's casing.
            canned.put("Available MBytes", """
                    [{"Path":"\\\\\\\\HOST\\\\Network Interface(eth)\\\\Bytes Received/sec","CookedValue":42}]
                    """);

            assertThat(collector.getPerformanceMetrics().getNetworkBytesIn()).isEqualTo(42L);
        }

        @Test
        void counterSamplesAreRoutedByTheirPath() {
            canned.put("Available MBytes", """
                    [{"Path":"\\\\\\\\host\\\\memory\\\\available mbytes","CookedValue":8192},
                     {"Path":"\\\\\\\\host\\\\network interface(eth)\\\\bytes received/sec","CookedValue":1500},
                     {"Path":"\\\\\\\\host\\\\network interface(eth)\\\\bytes sent/sec","CookedValue":700},
                     {"Path":"\\\\\\\\host\\\\physicaldisk(0)\\\\disk reads/sec","CookedValue":12},
                     {"Path":"\\\\\\\\host\\\\physicaldisk(0)\\\\disk writes/sec","CookedValue":8}]
                    """);

            PerformanceMetrics perf = collector.getPerformanceMetrics();

            assertThat(perf.getNetworkBytesIn()).isEqualTo(1500L);
            assertThat(perf.getNetworkBytesOut()).isEqualTo(700L);
        }

        @Test
        void multipleInterfacesAreSummed() {
            canned.put("Available MBytes", """
                    [{"Path":"\\\\\\\\h\\\\network interface(a)\\\\bytes received/sec","CookedValue":100},
                     {"Path":"\\\\\\\\h\\\\network interface(b)\\\\bytes received/sec","CookedValue":250}]
                    """);

            assertThat(collector.getPerformanceMetrics().getNetworkBytesIn()).isEqualTo(350L);
        }

        @Test
        void cpuLoadComesFromTheProcessorTotalCounter() {
            canned.put("Processor(_Total)", "42.5");

            assertThat(collector.getPerformanceMetrics().getCpuLoad1Min()).isCloseTo(42.5, within(0.001));
        }

        @Test
        void anEntirelyUnavailableCounterSetStillReturnsMetrics() {
            PerformanceMetrics perf = collector.getPerformanceMetrics();

            assertThat(perf).isNotNull();
            assertThat(perf.getUptimeSeconds()).isNotNegative();
        }
    }
}
