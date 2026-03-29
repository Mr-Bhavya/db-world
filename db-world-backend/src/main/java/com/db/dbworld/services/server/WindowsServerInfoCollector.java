package com.db.dbworld.services.server;

import com.db.dbworld.helpers.ProcessExecutor;
import com.db.dbworld.payloads.server.*;
import com.db.dbworld.payloads.server.os.windows.*;
import com.db.dbworld.services.server.ServerInfoCollector;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.file.FileStore;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.SimpleDateFormat;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * @deprecated Migrated to com.db.dbworld.app.system.info.collector.windows.WindowsServerInfoCollector.
 */
@Deprecated(forRemoval = true)
@Log4j2
// @Service("windowsServerInfoCollector")
public class WindowsServerInfoCollector extends ServerInfoCollector {

    public WindowsServerInfoCollector(ProcessExecutor processExecutor) {
        super(processExecutor);
        log.info("WindowsServerInfoCollector initialized");
    }

    @Override
    public BaseServerInfo collect() {
        try {
            log.info("Starting Windows system information collection");

            // Create base Windows server info
            WindowsServerInfo serverInfo = WindowsServerInfo.builder()
                    .windows(true)
                    .serverInfo(getServerInfo())
                    .biosInfo(getBiosInfo())
                    .cpu(getCpuInfo())
                    .memory(getMemoryInfo())
                    .disk(getDiskInfo())
                    .network(getNetworkInfo())
                    .processes(getRunningProcesses())
                    .services(getRunningServices())
                    .performance(getPerformanceMetrics())
                    .temperature(getTemperatureInfo())
                    .windowsInfo((WindowsInfo) getOsSpecificInfo())
                    .gpu(getGpuInfo())
                    .battery(getBatteryInfo())
                    .windowsFeatures(getWindowsFeatures())
                    .eventLog(getEventLogEntries())
                    .security(getSecurityInfo())
                    .hardwareDetails((WindowsHardwareDetails) getHardwareDetails())
                    .build();

            // Calculate health status
            serverInfo.setHealthStatus(calculateHealthStatus(serverInfo));

            log.info("Windows system information collection completed successfully");
            return serverInfo;

        } catch (Exception e) {
            log.error("Error collecting Windows system information", e);
            return WindowsServerInfo.builder()
                    .windows(true)
                    .error("Error collecting system information: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public CpuInfo getCpuInfo() {
        try {
            // PowerShell command to get CPU info
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_Processor | " +
                    "Select-Object Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, " +
                    "MaxClockSpeed, CurrentClockSpeed, Architecture, L2CacheSize, L3CacheSize, " +
                    "LoadPercentage | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> cpuDataList = parsePowerShellJson(output);

            if (cpuDataList.isEmpty()) {
                // Fallback to WMI query
                command = "wmic cpu get name,manufacturer,numberofcores,numberoflogicalprocessors," +
                        "maxclockspeed,currentclockspeed,l2cachesize,l3cachesize /format:csv";
                output = exec(command);
                return parseWmicCpuInfo(output);
            }

            Map<String, Object> cpuData = cpuDataList.get(0);

            // Get CPU load from PerformanceCounter
            String loadCommand = "powershell.exe -Command " +
                    "\"(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue\"";
            String loadOutput = exec(loadCommand);
            Integer loadPercentage = getIntegerValue(loadOutput);
            if (loadPercentage == null) {
                loadPercentage = getIntegerValue(cpuData.get("LoadPercentage"));
            }

            // Get CPU core loads
            List<CpuCore> cores = getCpuCores();

            return CpuInfo.builder()
                    .name(getStringValue(cpuData.get("Name"), "Unknown"))
                    .vendor(getStringValue(cpuData.get("Manufacturer"), "Unknown"))
                    .noOfCores(getIntegerValue(cpuData.get("NumberOfCores")))
                    .threads(getIntegerValue(cpuData.get("NumberOfLogicalProcessors")))
                    .maxFrequency(getLongValue(cpuData.get("MaxClockSpeed")) * 1000000L) // Convert MHz to Hz
                    .currentFrequency(getLongValue(cpuData.get("CurrentClockSpeed")) * 1000000L)
                    .architecture(getArchitecture(getIntegerValue(cpuData.get("Architecture"))))
                    .loadPercentage(loadPercentage)
                    .availableProcessors(Runtime.getRuntime().availableProcessors())
                    .l2Cache(getLongValue(cpuData.get("L2CacheSize")))
                    .l3Cache(getLongValue(cpuData.get("L3CacheSize")))
                    .cores(cores)
                    .build();

        } catch (Exception e) {
            log.error("Error collecting CPU info", e);
            return CpuInfo.builder()
                    .availableProcessors(Runtime.getRuntime().availableProcessors())
                    .architecture(System.getProperty("os.arch"))
                    .error("Error: " + e.getMessage())
                    .build();
        }
    }

    private List<CpuCore> getCpuCores() {
        List<CpuCore> cores = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-Counter '\\Processor(*)\\% Processor Time' | " +
                    "Select-Object -ExpandProperty CounterSamples | " +
                    "Where-Object {$_.InstanceName -notlike '*_Total*'} | " +
                    "Select-Object InstanceName, CookedValue | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> coreDataList = parsePowerShellJson(output);

            for (int i = 0; i < coreDataList.size(); i++) {
                Map<String, Object> coreData = coreDataList.get(i);
                CpuCore core = CpuCore.builder()
                        .coreId(i)
                        .load(getIntegerValue(coreData.get("CookedValue")))
                        .build();
                cores.add(core);
            }
        } catch (Exception e) {
            log.debug("Error getting CPU core details", e);
        }
        return cores;
    }

    private String getArchitecture(Integer archCode) {
        if (archCode == null) return "Unknown";

        switch (archCode) {
            case 0: return "x86";
            case 1: return "MIPS";
            case 2: return "Alpha";
            case 3: return "PowerPC";
            case 5: return "ARM";
            case 6: return "Itanium";
            case 9: return "x64";
            case 12: return "ARM64";
            default: return "Unknown (" + archCode + ")";
        }
    }

    @Override
    public MemoryInfo getMemoryInfo() {
        try {
            // PowerShell command to get memory info
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_OperatingSystem | " +
                    "Select-Object TotalVisibleMemorySize, FreePhysicalMemory | " +
                    "ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> memoryDataList = parsePowerShellJson(output);

            if (memoryDataList.isEmpty()) {
                // Fallback to wmic
                command = "wmic OS get TotalVisibleMemorySize,FreePhysicalMemory,TotalVirtualMemorySize," +
                        "FreeVirtualMemorySize /format:csv";
                output = exec(command);
                return parseWmicMemoryInfo(output);
            }

            Map<String, Object> memoryData = memoryDataList.get(0);

            long totalBytes = getLongValue(memoryData.get("TotalVisibleMemorySize")) * 1024; // KB to bytes
            long freeBytes = getLongValue(memoryData.get("FreePhysicalMemory")) * 1024;
            long usedBytes = totalBytes - freeBytes;
            double usedPercent = calculatePercentage(usedBytes, totalBytes);

            // Get swap/page file info
            Map<String, Object> pageFileData = getPageFileInfo();
            long swapTotal = getLongValue(pageFileData.get("TotalSize"));
            long swapUsed = getLongValue(pageFileData.get("CurrentUsage"));
            long swapFree = swapTotal - swapUsed;

            MemoryInfo memoryInfo = MemoryInfo.builder()
                    .totalBytes(totalBytes)
                    .freeBytes(freeBytes)
                    .usedBytes(usedBytes)
                    .swapTotal(swapTotal)
                    .swapFree(swapFree)
                    .swapUsed(swapUsed)
                    .totalFormatted(formatBytes(totalBytes))
                    .freeFormatted(formatBytes(freeBytes))
                    .usedFormatted(formatBytes(usedBytes))
                    .usedPercent(String.format("%.1f", usedPercent))
                    .build();

            // Add Java memory info
            addJavaMemoryInfo(memoryInfo);

            return memoryInfo;

        } catch (Exception e) {
            log.error("Error collecting memory info", e);
            MemoryInfo memoryInfo = getBasicMemoryInfo();
            memoryInfo.setError("Error: " + e.getMessage());
            return memoryInfo;
        }
    }

    private Map<String, Object> getPageFileInfo() {
        Map<String, Object> pageFile = new HashMap<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_PageFileUsage | " +
                    "Select-Object CurrentUsage, AllocatedBaseSize | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> pageFileList = parsePowerShellJson(output);

            if (!pageFileList.isEmpty()) {
                Map<String, Object> data = pageFileList.get(0);
                pageFile.put("CurrentUsage", getLongValue(data.get("CurrentUsage")) * 1024 * 1024); // MB to bytes
                pageFile.put("TotalSize", getLongValue(data.get("AllocatedBaseSize")) * 1024 * 1024);
            }
        } catch (Exception e) {
            log.debug("Error getting page file info", e);
        }
        return pageFile;
    }

    @Override
    public DiskInfo getDiskInfo() {
        try {
            // PowerShell command to get ALL logical disks (not just fixed)
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_LogicalDisk | " +
                    "Select-Object DeviceID, VolumeName, Size, FreeSpace, FileSystem, " +
                    "Description, DriveType | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> diskDataList = parsePowerShellJson(output);

            if (diskDataList.isEmpty()) {
                // Fallback to wmic
                command = "wmic logicaldisk get deviceid,volumename,size,freespace," +
                        "filesystem,description,drivetype /format:csv";
                output = exec(command);
                return parseWmicDiskInfo(output);
            }

            List<DriveInfo> drives = new ArrayList<>();
            long totalSpace = 0;
            long freeSpace = 0;
            long usedSpace = 0;

            for (Map<String, Object> diskData : diskDataList) {
                long diskSize = getLongValue(diskData.get("Size"));
                long diskFree = getLongValue(diskData.get("FreeSpace"));
                long diskUsed = diskSize - diskFree;

                totalSpace += diskSize;
                freeSpace += diskFree;
                usedSpace += diskUsed;

                double usedPercent = calculatePercentage(diskUsed, diskSize);

                // Determine drive type
                Integer driveType = getIntegerValue(diskData.get("DriveType"));
                String type = getDriveType(driveType);

                // Skip CD-ROM (5) and RAM disks (6) if you want
                if (driveType != null && (driveType == 5 || driveType == 6)) {
                    continue;
                }

                DriveInfo drive = DriveInfo.builder()
                        .device(getStringValue(diskData.get("DeviceID"), "Unknown"))
                        .volumeName(getStringValue(diskData.get("VolumeName"), ""))
                        .mountPoint(getStringValue(diskData.get("DeviceID"), ""))
                        .fileSystem(getStringValue(diskData.get("FileSystem"), "Unknown"))
                        .totalBytes(diskSize)
                        .freeBytes(diskFree)
                        .usedBytes(diskUsed)
                        .totalFormatted(formatBytes(diskSize))
                        .freeFormatted(formatBytes(diskFree))
                        .usedFormatted(formatBytes(diskUsed))
                        .usedPercent(String.format("%.1f", usedPercent))
                        .type(type)
                        .build();

                // Get additional disk info using wmic for local drives only
                if (driveType != null && (driveType == 2 || driveType == 3)) {
                    getAdditionalDiskInfo(drive);
                }

                drives.add(drive);
            }

            return DiskInfo.builder()
                    .drives(drives)
                    .driveCount(drives.size())
                    .totalSpace(totalSpace)
                    .freeSpace(freeSpace)
                    .usedSpace(usedSpace)
                    .totalSpaceFormatted(formatBytes(totalSpace))
                    .freeSpaceFormatted(formatBytes(freeSpace))
                    .usedSpaceFormatted(formatBytes(usedSpace))
                    .build();

        } catch (Exception e) {
            log.error("Error collecting disk info", e);
            return DiskInfo.builder()
                    .drives(getFileSystemRoots())
                    .error("Error: " + e.getMessage())
                    .build();
        }
    }

    private String getDriveType(Integer driveType) {
        if (driveType == null) return "Unknown";

        switch (driveType) {
            case 0: return "Unknown";
            case 1: return "No Root Directory";
            case 2: return "Removable Disk";
            case 3: return "Local Disk";
            case 4: return "Network Drive";
            case 5: return "Compact Disc";
            case 6: return "RAM Disk";
            default: return "Unknown (" + driveType + ")";
        }
    }

    private DiskInfo parseWmicDiskInfo(String output) {
        List<DriveInfo> drives = new ArrayList<>();
        long totalSpace = 0;
        long freeSpace = 0;
        long usedSpace = 0;

        String[] lines = output.split("\n");
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].trim();
            if (!line.isEmpty()) {
                String[] parts = line.split(",");
                if (parts.length >= 7) {
                    try {
                        long diskSize = Long.parseLong(parts[3].trim());
                        long diskFree = Long.parseLong(parts[4].trim());
                        long diskUsed = diskSize - diskFree;

                        totalSpace += diskSize;
                        freeSpace += diskFree;
                        usedSpace += diskUsed;

                        double usedPercent = calculatePercentage(diskUsed, diskSize);

                        Integer driveType = Integer.parseInt(parts[6].trim());
                        String type = getDriveType(driveType);

                        // Skip CD-ROM and RAM disks
                        if (driveType == 5 || driveType == 6) {
                            continue;
                        }

                        DriveInfo drive = DriveInfo.builder()
                                .device(parts[1].trim())
                                .volumeName(parts[2].trim())
                                .mountPoint(parts[1].trim())
                                .fileSystem(parts[5].trim())
                                .totalBytes(diskSize)
                                .freeBytes(diskFree)
                                .usedBytes(diskUsed)
                                .totalFormatted(formatBytes(diskSize))
                                .freeFormatted(formatBytes(diskFree))
                                .usedFormatted(formatBytes(diskUsed))
                                .usedPercent(String.format("%.1f", usedPercent))
                                .type(type)
                                .build();
                        drives.add(drive);
                    } catch (NumberFormatException e) {
                        log.debug("Error parsing disk size", e);
                    }
                }
            }
        }

        return DiskInfo.builder()
                .drives(drives)
                .driveCount(drives.size())
                .totalSpace(totalSpace)
                .freeSpace(freeSpace)
                .usedSpace(usedSpace)
                .totalSpaceFormatted(formatBytes(totalSpace))
                .freeSpaceFormatted(formatBytes(freeSpace))
                .usedSpaceFormatted(formatBytes(usedSpace))
                .build();
    }

    private void getAdditionalDiskInfo(DriveInfo drive) {
        try {
            String deviceId = drive.getDevice().replace(":", "");
            String command = "wmic diskdrive where \"DeviceID like '%" + deviceId + "%'\" " +
                    "get model,serialnumber /format:csv";

            String output = exec(command);
            if (output.contains(",")) {
                String[] lines = output.split("\n");
                if (lines.length > 1) {
                    String[] parts = lines[1].split(",");
                    if (parts.length >= 3) {
                        drive.setModel(parts[1].trim());
                        drive.setSerial(parts[2].trim());
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Error getting additional disk info", e);
        }
    }

    @Override
    public NetworkInfo getNetworkInfo() {
        try {
            // PowerShell command to get network info
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration | " +
                    "Where-Object {$_.IPEnabled -eq $true} | " +
                    "Select-Object Description, MACAddress, IPAddress, IPSubnet, DefaultIPGateway, " +
                    "DNSServerSearchOrder, DHCPEnabled | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> networkDataList = parsePowerShellJson(output);

            List<NetworkAdapter> adapters = new ArrayList<>();
            List<String> dnsServers = new ArrayList<>();
            List<String> ipAddresses = new ArrayList<>();
            String defaultGateway = "";
            long bytesReceived = 0;
            long bytesSent = 0;

            for (Map<String, Object> adapterData : networkDataList) {
                NetworkAdapter adapter = NetworkAdapter.builder()
                        .name(getStringValue(adapterData.get("Description"), "Unknown"))
                        .macAddress(getStringValue(adapterData.get("MACAddress"), ""))
                        .status("Up") // Assume enabled adapters are up
                        .build();

                // Get IP addresses
                Object ipObj = adapterData.get("IPAddress");
                if (ipObj instanceof List) {
                    List<?> ipList = (List<?>) ipObj;
                    List<String> adapterIps = ipList.stream()
                            .map(Object::toString)
                            .collect(Collectors.toList());
                    adapter.setIpAddresses(adapterIps);
                    ipAddresses.addAll(adapterIps);

                    if (!adapterIps.isEmpty()) {
                        adapter.setIpAddress(adapterIps.get(0));
                    }
                }

                // Get subnet mask
                Object subnetObj = adapterData.get("IPSubnet");
                if (subnetObj instanceof List && ((List<?>) subnetObj).size() > 0) {
                    adapter.setSubnetMask(((List<?>) subnetObj).get(0).toString());
                }

                // Get default gateway
//                Object gatewayObj = adapterData.get("DefaultIPGateway");
//                if (gatewayObj instanceof List && ((List<?>) gatewayObj).size() > 0) {
//                    adapter.setDefaultGateway(((List<?>) gatewayObj).get(0).toString());
//                    if (defaultGateway.isEmpty()) {
//                        defaultGateway = adapter.getDefaultGateway();
//                    }
//                }

                // Get DNS servers
                Object dnsObj = adapterData.get("DNSServerSearchOrder");
                if (dnsObj instanceof List) {
                    List<?> dnsList = (List<?>) dnsObj;
                    dnsList.forEach(dns -> dnsServers.add(dns.toString()));
                }

                // Get network statistics
                getNetworkStatistics(adapter);

                adapters.add(adapter);
            }

            // Get hostname
            String hostname = getHostname();

            // Get domain
            String domainCommand = "powershell.exe -Command " +
                    "\"(Get-CimInstance -ClassName Win32_ComputerSystem).Domain\"";
            String domain = exec(domainCommand).trim();

            return NetworkInfo.builder()
                    .hostname(hostname)
                    .domain(domain)
                    .adapters(adapters)
                    .dnsServers(dnsServers)
                    .ipAddresses(ipAddresses)
                    .defaultGateway(defaultGateway)
                    .bytesReceived(bytesReceived)
                    .bytesSent(bytesSent)
                    .adapterCount(adapters.size())
                    .build();

        } catch (Exception e) {
            log.error("Error collecting network info", e);
            NetworkInfo networkInfo = NetworkInfo.builder()
                    .hostname(getHostname())
                    .ipAddresses(getIpAddresses())
                    .build();
            networkInfo.setError("Error: " + e.getMessage());
            return networkInfo;
        }
    }

    private void getNetworkStatistics(NetworkAdapter adapter) {
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_PerfRawData_Tcpip_NetworkInterface | " +
                    "Where-Object {$_.Name -like '*" + adapter.getName() + "*'} | " +
                    "Select-Object BytesReceivedPersec, BytesSentPersec | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> statsList = parsePowerShellJson(output);

            if (!statsList.isEmpty()) {
                Map<String, Object> stats = statsList.get(0);
                adapter.setBytesReceived(getLongValue(stats.get("BytesReceivedPersec")));
                adapter.setBytesSent(getLongValue(stats.get("BytesSentPersec")));
            }
        } catch (Exception e) {
            log.debug("Error getting network statistics", e);
        }
    }

    @Override
    public List<ProcessInfo> getRunningProcesses() {
        List<ProcessInfo> processes = new ArrayList<>();
        try {
            // PowerShell command to get process info
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_Process | " +
                    "Select-Object Name, ProcessId, ParentProcessId, WorkingSetSize, " +
                    "CommandLine, CreationDate, UserModeTime, KernelModeTime, ThreadCount, " +
                    "Priority, SessionId, ExecutablePath | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> processDataList = parsePowerShellJson(output);

            // Get CPU usage for each process
            Map<Integer, Double> cpuUsageMap = getProcessCpuUsage();

            for (Map<String, Object> processData : processDataList.subList(0,4)) {
                Integer pid = getIntegerValue(processData.get("ProcessId"));
                if (pid == null || pid <= 0) continue;

                ProcessInfo process = ProcessInfo.builder()
                        .name(getStringValue(processData.get("Name"), "Unknown"))
                        .pid(pid)
                        .ppid(getIntegerValue(processData.get("ParentProcessId")))
                        .cpuUsage(cpuUsageMap.getOrDefault(pid, 0.0))
                        .memoryBytes(getLongValue(processData.get("WorkingSetSize")))
                        .memoryFormatted(formatBytes(getLongValue(processData.get("WorkingSetSize"))))
                        .commandLine(getStringValue(processData.get("CommandLine"), ""))
                        .state("Running")
                        .threads(getIntegerValue(processData.get("ThreadCount")))
                        .priority(getIntegerValue(processData.get("Priority")))
                        .build();

                // Get user information
                String user = getProcessUser(pid);
                if (!user.isEmpty()) {
                    process.setUser(user);
                }

                // Parse creation date
                Date creationDate = (Date) processData.get("CreationDate");
                if (creationDate != null) {
                    try {
                        Instant instant = creationDate.toInstant();
                        process.setStartTime(instant.toEpochMilli());
                    } catch (Exception e) {
                        log.debug("Error parsing creation date", e);
                    }
                }

                processes.add(process);
            }

            // Sort by CPU usage descending
            processes.sort((p1, p2) -> Double.compare(p2.getCpuUsage(), p1.getCpuUsage()));

        } catch (Exception e) {
            log.error("Error collecting process info {}", e.getMessage());
        }
        return processes;
    }

    private Map<Integer, Double> getProcessCpuUsage() {
        Map<Integer, Double> cpuUsageMap = new HashMap<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-Counter '\\Process(*)\\% Processor Time' | " +
                    "Select-Object -ExpandProperty CounterSamples | " +
                    "Select-Object InstanceName, CookedValue | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> cpuDataList = parsePowerShellJson(output);

            for (Map<String, Object> cpuData : cpuDataList) {
                String instanceName = getStringValue(cpuData.get("InstanceName"), "");
                Double cookedValue = getDoubleValue(cpuData.get("CookedValue"));

                // Extract PID from instance name (format: "processname#pid")
                Pattern pattern = Pattern.compile("#(\\d+)$");
                Matcher matcher = pattern.matcher(instanceName);
                if (matcher.find()) {
                    try {
                        int pid = Integer.parseInt(matcher.group(1));
                        cpuUsageMap.put(pid, cookedValue);
                    } catch (NumberFormatException e) {
                        // Ignore invalid PID
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Error getting process CPU usage", e);
        }
        return cpuUsageMap;
    }

    private String getProcessUser(int pid) {
        try {
            String command = "powershell.exe -Command " +
                    "\"(Get-Process -Id " + pid + " -IncludeUserName).UserName\"";
            String output = exec(command).trim();

            // Check if we got an error about elevated rights
            if (output.contains("IncludeUserNameRequiresElevation") ||
                    output.contains("requires elevated user rights") ||
                    output.isEmpty()) {
                // Fall back to using wmic which might work without admin rights
                String wmicCommand = "wmic process where processid=" + pid + " get caption,executablepath /format:csv";
                String wmicOutput = exec(wmicCommand);
                if (!wmicOutput.isEmpty()) {
                    // Try to extract user from path or return a default
                    return "SYSTEM"; // Default for system processes
                }
                return ""; // Return empty if we can't get it
            }
            return output;
        } catch (Exception e) {
            log.debug("Error getting process user for PID {}: {}", pid, e.getMessage());
            return "";
        }
    }

    @Override
    public List<ServiceInfo> getRunningServices() {
        List<ServiceInfo> services = new ArrayList<>();
        try {
            // PowerShell command to get service info
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_Service | " +
                    "Select-Object Name, DisplayName, Description, State, StartMode, " +
                    "PathName, ProcessId, StartName | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> serviceDataList = parsePowerShellJson(output);

            for (Map<String, Object> serviceData : serviceDataList.subList(0,5)) {
                ServiceInfo service = ServiceInfo.builder()
                        .name(getStringValue(serviceData.get("Name"), "Unknown"))
                        .displayName(getStringValue(serviceData.get("DisplayName"), ""))
                        .description(getStringValue(serviceData.get("Description"), ""))
                        .status(getStringValue(serviceData.get("State"), "Unknown"))
                        .startType(getStringValue(serviceData.get("StartMode"), "Unknown"))
                        .executablePath(getStringValue(serviceData.get("PathName"), ""))
                        .pid(getStringValue(serviceData.get("ProcessId"), ""))
                        .user(getStringValue(serviceData.get("StartName"), ""))
                        .build();

                // Get service memory usage
                String pidStr = service.getPid();
                if (!pidStr.isEmpty() && !pidStr.equals("0")) {
                    try {
                        int pid = Integer.parseInt(pidStr);
                        service.setMemoryUsage(getProcessMemoryUsage(pid));
                    } catch (NumberFormatException e) {
                        // Ignore invalid PID
                    }
                }

                services.add(service);
            }

            // Sort by service name
            services.sort(Comparator.comparing(ServiceInfo::getName));

        } catch (Exception e) {
            log.error("Error collecting service info", e);
        }
        return services;
    }

    private Long getProcessMemoryUsage(int pid) {
        try {
            String command = "powershell.exe -Command " +
                    "\"(Get-Process -Id " + pid + ").WorkingSet64\"";
            String output = exec(command).trim();
            return Long.parseLong(output);
        } catch (Exception e) {
            return 0L;
        }
    }

    @Override
    public PerformanceMetrics getPerformanceMetrics() {
        try {
            // PowerShell command to get performance metrics
            String command = "powershell.exe -Command " +
                    "\"Get-Counter '\\Memory\\Available MBytes', " +
                    "'\\Network Interface(*)\\Bytes Received/sec', " +
                    "'\\Network Interface(*)\\Bytes Sent/sec', " +
                    "'\\PhysicalDisk(*)\\Disk Reads/sec', " +
                    "'\\PhysicalDisk(*)\\Disk Writes/sec' | " +
                    "Select-Object -ExpandProperty CounterSamples | " +
                    "Select-Object Path, CookedValue | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> perfDataList = parsePowerShellJson(output);

            double availableMB = 0;
            long bytesIn = 0;
            long bytesOut = 0;
            long diskReads = 0;
            long diskWrites = 0;

            for (Map<String, Object> perfData : perfDataList) {
                String path = getStringValue(perfData.get("Path"), "");
                Double cookedValue = getDoubleValue(perfData.get("CookedValue"));

                if (path.contains("Available MBytes")) {
                    availableMB = cookedValue;
                } else if (path.contains("Bytes Received/sec")) {
                    bytesIn += cookedValue.longValue();
                } else if (path.contains("Bytes Sent/sec")) {
                    bytesOut += cookedValue.longValue();
                } else if (path.contains("Disk Reads/sec")) {
                    diskReads += cookedValue.longValue();
                } else if (path.contains("Disk Writes/sec")) {
                    diskWrites += cookedValue.longValue();
                }
            }

            // Get CPU load averages (Windows doesn't have load averages like Unix)
            // Using PerformanceCounter for CPU load
            String cpuCommand = "powershell.exe -Command " +
                    "\"(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue\"";
            String cpuOutput = exec(cpuCommand);
            Double cpuLoad = getDoubleValue(cpuOutput);

            // Get uptime
            long uptimeSeconds = getUptime();

            // Get process count
            int processCount = getProcessCount();

            return PerformanceMetrics.builder()
                    .cpuLoad1Min(cpuLoad)
                    .cpuLoad5Min(cpuLoad) // Windows doesn't differentiate
                    .cpuLoad15Min(cpuLoad) // Windows doesn't differentiate
                    .memoryLoadPercent(calculateMemoryLoadPercent(availableMB))
                    .diskIOLoad(calculateDiskIOLoad(diskReads, diskWrites))
                    .processCount(processCount)
                    .threadCount(getThreadCount())
                    .uptime(formatUptime(uptimeSeconds))
                    .uptimeSeconds(uptimeSeconds)
                    .diskReads(diskReads)
                    .diskWrites(diskWrites)
                    .networkBytesIn(bytesIn)
                    .networkBytesOut(bytesOut)
                    .build();

        } catch (Exception e) {
            log.error("Error collecting performance metrics", e);
            return PerformanceMetrics.builder()
                    .uptimeSeconds(getUptime())
                    .processCount(getProcessCount())
                    .build();
        }
    }

    private double calculateMemoryLoadPercent(double availableMB) {
        try {
            String command = "powershell.exe -Command " +
                    "\"(Get-CimInstance -ClassName Win32_OperatingSystem).TotalVisibleMemorySize\"";
            String output = exec(command);
            double totalMB = getDoubleValue(output) / 1024; // Convert KB to MB
            return ((totalMB - availableMB) / totalMB) * 100.0;
        } catch (Exception e) {
            return 0.0;
        }
    }

    private double calculateDiskIOLoad(long reads, long writes) {
        // Simple heuristic: sum of reads and writes per second
        return reads + writes;
    }

    private long getUptime() {
        try {
            String command = "powershell.exe -Command " +
                    "\"(Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime\"";
            String output = exec(command);

            if (!output.isEmpty()) {
                Instant bootTime = Instant.parse(output);
                Instant now = Instant.now();
                return Duration.between(bootTime, now).getSeconds();
            }
        } catch (Exception e) {
            log.debug("Error getting uptime", e);
        }

        // Fallback to ManagementFactory
        return ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
    }

    private int getProcessCount() {
        try {
            return ProcessHandle.allProcesses()
                    .mapToInt(p -> 1)
                    .sum();
        } catch (Exception e) {
            return 0;
        }
    }

    private int getThreadCount() {
        try {
            String command = "powershell.exe -Command " +
                    "\"(Get-Process | Measure-Object -Property Threads -Sum).Sum\"";
            String output = exec(command);
            return getIntegerValue(output);
        } catch (Exception e) {
            return 0;
        }
    }

    private String formatUptime(long seconds) {
        long days = seconds / (24 * 3600);
        seconds %= (24 * 3600);
        long hours = seconds / 3600;
        seconds %= 3600;
        long minutes = seconds / 60;
        seconds %= 60;

        if (days > 0) {
            return String.format("%dd %dh %dm %ds", days, hours, minutes, seconds);
        } else if (hours > 0) {
            return String.format("%dh %dm %ds", hours, minutes, seconds);
        } else {
            return String.format("%dm %ds", minutes, seconds);
        }
    }

    @Override
    public TemperatureInfo getTemperatureInfo() {
        // Windows doesn't have built-in temperature sensors accessible via standard APIs
        // This would require third-party software or hardware-specific drivers
        return TemperatureInfo.builder()
                .hasTemperatureSensors(false)
                .status("Temperature monitoring not available via standard Windows APIs")
                .build();
    }

    @Override
    public Object getHardwareDetails() {
        return WindowsHardwareDetails.builder()
                .motherboard(getMotherboardInfo())
                .audioDevices(getAudioDevices())
                .usbDevices(getUsbDevices())
                .monitors(getMonitorInfo())
                .printers(getPrinterInfo())
                .storageControllers(getStorageControllers())
                .build();
    }

    private MotherboardInfo getMotherboardInfo() {
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_BaseBoard | " +
                    "Select-Object Manufacturer, Product, SerialNumber, Version | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> mbDataList = parsePowerShellJson(output);

            if (!mbDataList.isEmpty()) {
                Map<String, Object> mbData = mbDataList.get(0);
                return MotherboardInfo.builder()
                        .manufacturer(getStringValue(mbData.get("Manufacturer"), "Unknown"))
                        .product(getStringValue(mbData.get("Product"), "Unknown"))
                        .serial(getStringValue(mbData.get("SerialNumber"), "Unknown"))
                        .version(getStringValue(mbData.get("Version"), "Unknown"))
                        .biosVersion(getBiosVersion())
                        .biosDate(getBiosDate())
                        .build();
            }
        } catch (Exception e) {
            log.debug("Error getting motherboard info", e);
        }
        return null;
    }

    private List<AudioDevice> getAudioDevices() {
        List<AudioDevice> audioDevices = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_SoundDevice | " +
                    "Select-Object Name, Manufacturer, Status | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> audioDataList = parsePowerShellJson(output);

            for (Map<String, Object> audioData : audioDataList) {
                AudioDevice device = AudioDevice.builder()
                        .name(getStringValue(audioData.get("Name"), "Unknown"))
                        .manufacturer(getStringValue(audioData.get("Manufacturer"), "Unknown"))
                        .status(getStringValue(audioData.get("Status"), "Unknown"))
                        .build();
                audioDevices.add(device);
            }
        } catch (Exception e) {
            log.debug("Error getting audio devices", e);
        }
        return audioDevices;
    }

    private List<UsbDevice> getUsbDevices() {
        List<UsbDevice> usbDevices = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_USBControllerDevice | " +
                    "Get-CimAssociatedInstance -ResultClassName Win32_PnPEntity | " +
                    "Select-Object Name, Manufacturer, DeviceID, Description | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> usbDataList = parsePowerShellJson(output);

            for (Map<String, Object> usbData : usbDataList) {
                UsbDevice device = UsbDevice.builder()
                        .name(getStringValue(usbData.get("Name"), "Unknown"))
                        .manufacturer(getStringValue(usbData.get("Manufacturer"), "Unknown"))
                        .deviceId(getStringValue(usbData.get("DeviceID"), ""))
                        .description(getStringValue(usbData.get("Description"), ""))
                        .build();
                usbDevices.add(device);
            }
        } catch (Exception e) {
            log.debug("Error getting USB devices", e);
        }
        return usbDevices;
    }

    private List<MonitorInfo> getMonitorInfo() {
        List<MonitorInfo> monitors = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorBasicDisplayParams | " +
                    "Select-Object InstanceName, Active | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> monitorDataList = parsePowerShellJson(output);

            for (Map<String, Object> monitorData : monitorDataList) {
                MonitorInfo monitor = MonitorInfo.builder()
                        .name(getStringValue(monitorData.get("InstanceName"), "Unknown"))
//                        .status(getBooleanValue(monitorData.get("Active")) ? "Active" : "Inactive")
                        .build();
                monitors.add(monitor);
            }
        } catch (Exception e) {
            log.debug("Error getting monitor info", e);
        }
        return monitors;
    }

    private List<PrinterInfo> getPrinterInfo() {
        List<PrinterInfo> printers = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_Printer | " +
                    "Select-Object Name, DriverName, PortName, Default | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> printerDataList = parsePowerShellJson(output);

            for (Map<String, Object> printerData : printerDataList) {
                PrinterInfo printer = PrinterInfo.builder()
                        .name(getStringValue(printerData.get("Name"), "Unknown"))
                        .driver(getStringValue(printerData.get("DriverName"), "Unknown"))
                        .port(getStringValue(printerData.get("PortName"), "Unknown"))
                        .isDefault(getBooleanValue(printerData.get("Default")))
                        .status("Unknown")
                        .build();
                printers.add(printer);
            }
        } catch (Exception e) {
            log.debug("Error getting printer info", e);
        }
        return printers;
    }

    private List<StorageController> getStorageControllers() {
        List<StorageController> controllers = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_SCSIController | " +
                    "Select-Object Name, Manufacturer | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> controllerDataList = parsePowerShellJson(output);

            for (Map<String, Object> controllerData : controllerDataList) {
                StorageController controller = StorageController.builder()
                        .name(getStringValue(controllerData.get("Name"), "Unknown"))
                        .manufacturer(getStringValue(controllerData.get("Manufacturer"), "Unknown"))
                        .build();
                controllers.add(controller);
            }
        } catch (Exception e) {
            log.debug("Error getting storage controllers", e);
        }
        return controllers;
    }

    @Override
    public ServerInfo getServerInfo() {
        try {
            // PowerShell command to get OS info
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_OperatingSystem | " +
                    "Select-Object Caption, Version, BuildNumber, OSArchitecture, " +
                    "CSName, Manufacturer, SerialNumber, LastBootUpTime, InstallDate, " +
                    "TotalVisibleMemorySize, FreePhysicalMemory | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> osDataList = parsePowerShellJson(output);

            if (!osDataList.isEmpty()) {
                Map<String, Object> osData = osDataList.get(0);

                // Parse dates
                String bootTimeStr = getStringValue(osData.get("LastBootUpTime"), "");
                String installDateStr = getStringValue(osData.get("InstallDate"), "");

                return ServerInfo.builder()
                        .osName(getStringValue(osData.get("Caption"), "Unknown"))
                        .osVersion(getStringValue(osData.get("Version"), "Unknown"))
                        .osArchitecture(getStringValue(osData.get("OSArchitecture"), "Unknown"))
                        .hostname(getStringValue(osData.get("CSName"), getHostname()))
                        .manufacturer(getStringValue(osData.get("Manufacturer"), "Unknown"))
                        .model("") // Windows doesn't provide this in Win32_OperatingSystem
                        .serialNumber(getStringValue(osData.get("SerialNumber"), "Unknown"))
                        .uptime(calculateUptime(bootTimeStr))
                        .bootTime(formatDateTime(bootTimeStr))
                        .kernelVersion(getStringValue(osData.get("Version"), "Unknown"))
                        .distribution("Windows")
                        .distributionVersion(getStringValue(osData.get("Caption"), "Unknown"))
                        .desktopEnvironment("") // Windows doesn't have separate desktop environment
                        .build();
            }
        } catch (Exception e) {
            log.error("Error collecting server info", e);
        }

        // Fallback to basic info
        return ServerInfo.builder()
                .osName(System.getProperty("os.name"))
                .osVersion(System.getProperty("os.version"))
                .osArchitecture(System.getProperty("os.arch"))
                .hostname(getHostname())
                .distribution("Windows")
                .build();
    }

    @Override
    public BiosInfo getBiosInfo() {
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_BIOS | " +
                    "Select-Object Manufacturer, SMBIOSBIOSVersion, ReleaseDate, Version | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> biosDataList = parsePowerShellJson(output);

            if (!biosDataList.isEmpty()) {
                Map<String, Object> biosData = biosDataList.get(0);
                return BiosInfo.builder()
                        .vendor(getStringValue(biosData.get("Manufacturer"), "Unknown"))
                        .version(getStringValue(biosData.get("SMBIOSBIOSVersion"), "Unknown"))
                        .releaseDate(formatDateTime(getStringValue(biosData.get("ReleaseDate"), "")))
                        .firmwareRevision(getStringValue(biosData.get("Version"), "Unknown"))
                        .build();
            }
        } catch (Exception e) {
            log.error("Error collecting BIOS info", e);
        }
        return BiosInfo.builder().build();
    }

    @Override
    public Object getOsSpecificInfo() {
        try {
            // PowerShell command to get Windows-specific info
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_OperatingSystem | " +
                    "Select-Object Caption, Version, BuildNumber, SerialNumber, " +
                    "RegisteredUser, Organization, SystemDirectory, WindowsDirectory, " +
                    "CountryCode, Locale, TimeZone | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> osDataList = parsePowerShellJson(output);

            if (!osDataList.isEmpty()) {
                Map<String, Object> osData = osDataList.get(0);

                // Get time zone info
                String timeZoneCommand = "powershell.exe -Command " +
                        "\"Get-TimeZone | Select-Object Id, DisplayName | ConvertTo-Json\"";
                String timeZoneOutput = exec(timeZoneCommand);
                List<Map<String, Object>> tzDataList = parsePowerShellJson(timeZoneOutput);
                String timeZone = "";
                if (!tzDataList.isEmpty()) {
                    Map<String, Object> tzData = tzDataList.get(0);
                    timeZone = getStringValue(tzData.get("DisplayName"),
                            getStringValue(tzData.get("Id"), ""));
                }

                return WindowsInfo.builder()
                        .edition(extractEdition(getStringValue(osData.get("Caption"), "")))
                        .buildNumber(getStringValue(osData.get("BuildNumber"), ""))
                        .installDate("") // Would need additional parsing
                        .registeredOwner(getStringValue(osData.get("RegisteredUser"), ""))
                        .registeredOrganization(getStringValue(osData.get("Organization"), ""))
                        .productId(getStringValue(osData.get("SerialNumber"), ""))
                        .productKey("") // Requires elevated privileges
                        .timeZone(timeZone)
                        .locale(getStringValue(osData.get("Locale"), ""))
                        .countryCode(getStringValue(osData.get("CountryCode"), ""))
                        .systemDirectory(getStringValue(osData.get("SystemDirectory"), ""))
                        .windowsDirectory(getStringValue(osData.get("WindowsDirectory"), ""))
                        .deviceGuardStatus("") // Would need additional checks
                        .build();
            }
        } catch (Exception e) {
            log.error("Error collecting Windows-specific info", e);
        }
        return WindowsInfo.builder().build();
    }

    private String extractEdition(String caption) {
        if (caption.contains("Home")) return "Home";
        if (caption.contains("Pro")) return "Professional";
        if (caption.contains("Enterprise")) return "Enterprise";
        if (caption.contains("Education")) return "Education";
        if (caption.contains("Server")) return "Server";
        return caption;
    }

    private WindowsGpuInfo getGpuInfo() {
        List<GpuDetails> gpus = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_VideoController | " +
                    "Select-Object Name, AdapterCompatibility, AdapterRAM, DriverVersion, " +
                    "VideoProcessor, CurrentHorizontalResolution, CurrentVerticalResolution, " +
                    "CurrentRefreshRate, DriverDate, Status | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> gpuDataList = parsePowerShellJson(output);

            for (Map<String, Object> gpuData : gpuDataList) {
                GpuDetails gpu = GpuDetails.builder()
                        .name(getStringValue(gpuData.get("Name"), "Unknown"))
                        .vendor(getStringValue(gpuData.get("AdapterCompatibility"), "Unknown"))
                        .memoryBytes(getLongValue(gpuData.get("AdapterRAM")))
                        .memoryFormatted(formatBytes(getLongValue(gpuData.get("AdapterRAM"))))
                        .driverVersion(getStringValue(gpuData.get("DriverVersion"), "Unknown"))
                        .driverDate(formatDateTime(getStringValue(gpuData.get("DriverDate"), "")))
                        .videoProcessor(getStringValue(gpuData.get("VideoProcessor"), "Unknown"))
                        .resolution(getStringValue(gpuData.get("CurrentHorizontalResolution"), "0") +
                                "x" + getStringValue(gpuData.get("CurrentVerticalResolution"), "0"))
                        .driverProvider("Microsoft") // Default
                        .build();
                gpus.add(gpu);
            }
        } catch (Exception e) {
            log.debug("Error getting GPU info", e);
        }
        return WindowsGpuInfo.builder()
                .gpus(gpus)
                .count(gpus.size())
                .build();
    }

    private WindowsBatteryInfo getBatteryInfo() {
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -ClassName Win32_Battery | " +
                    "Select-Object BatteryStatus, EstimatedChargeRemaining, DesignCapacity, " +
                    "FullChargeCapacity, Chemistry, DeviceID | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> batteryDataList = parsePowerShellJson(output);

            if (!batteryDataList.isEmpty()) {
                Map<String, Object> batteryData = batteryDataList.get(0);
                return WindowsBatteryInfo.builder()
                        .hasBattery(true)
                        .chargeRemaining(getIntegerValue(batteryData.get("EstimatedChargeRemaining")))
                        .fullChargeCapacity(getIntegerValue(batteryData.get("FullChargeCapacity")))
                        .designedCapacity(getIntegerValue(batteryData.get("DesignCapacity")))
                        .status(getBatteryStatus(getIntegerValue(batteryData.get("BatteryStatus"))))
                        .chemistry(getStringValue(batteryData.get("Chemistry"), "Unknown"))
                        .batteryName(getStringValue(batteryData.get("DeviceID"), "Unknown"))
                        .build();
            }
        } catch (Exception e) {
            log.debug("Error getting battery info", e);
        }
        return WindowsBatteryInfo.builder()
                .hasBattery(false)
                .build();
    }

    private String getBatteryStatus(Integer statusCode) {
        if (statusCode == null) return "Unknown";

        switch (statusCode) {
            case 1: return "Discharging";
            case 2: return "On AC";
            case 3: return "Fully Charged";
            case 4: return "Low";
            case 5: return "Critical";
            case 6: return "Charging";
            case 7: return "Charging and High";
            case 8: return "Charging and Low";
            case 9: return "Charging and Critical";
            case 10: return "Undefined";
            case 11: return "Partially Charged";
            default: return "Unknown (" + statusCode + ")";
        }
    }

    private WindowsFeatures getWindowsFeatures() {
        List<String> enabledFeatures = new ArrayList<>();
        List<String> disabledFeatures = new ArrayList<>();

        try {
            // Check for Hyper-V
            String hyperVCommand = "powershell.exe -Command " +
                    "\"Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V | " +
                    "Select-Object State | ConvertTo-Json\"";
            String hyperVOutput = exec(hyperVCommand);
            List<Map<String, Object>> hyperVData = parsePowerShellJson(hyperVOutput);
            boolean hyperVEnabled = false;
            if (!hyperVData.isEmpty()) {
                String state = getStringValue(hyperVData.get(0).get("State"), "");
                hyperVEnabled = "Enabled".equalsIgnoreCase(state);
            }

            // Check for WSL
            String wslCommand = "powershell.exe -Command " +
                    "\"Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux | " +
                    "Select-Object State | ConvertTo-Json\"";
            String wslOutput = exec(wslCommand);
            List<Map<String, Object>> wslData = parsePowerShellJson(wslOutput);
            boolean wslEnabled = false;
            if (!wslData.isEmpty()) {
                String state = getStringValue(wslData.get(0).get("State"), "");
                wslEnabled = "Enabled".equalsIgnoreCase(state);
            }

            return WindowsFeatures.builder()
                    .hyperVEnabled(hyperVEnabled)
                    .wslEnabled(wslEnabled)
                    .iisEnabled(isIISEnabled())
                    .netFrameworkEnabled(true) // Windows always has .NET Framework
                    .enabledFeatures(enabledFeatures)
                    .disabledFeatures(disabledFeatures)
                    .build();

        } catch (Exception e) {
            log.debug("Error getting Windows features", e);
            return WindowsFeatures.builder().build();
        }
    }

    private boolean isIISEnabled() {
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-WindowsFeature -Name Web-Server | Select-Object Installed | ConvertTo-Json\"";
            String output = exec(command);
            List<Map<String, Object>> iisData = parsePowerShellJson(output);
            if (!iisData.isEmpty()) {
                return getBooleanValue(iisData.get(0).get("Installed"));
            }
        } catch (Exception e) {
            // Command might not work on non-Server editions
        }
        return false;
    }

    private List<EventLogEntry> getEventLogEntries() {
        List<EventLogEntry> eventLogs = new ArrayList<>();
        try {
            // Get recent application events
            String command = "powershell.exe -Command " +
                    "\"Get-EventLog -LogName Application -Newest 10 | " +
                    "Select-Object TimeGenerated, Source, InstanceId, EntryType, Message, " +
                    "UserName, MachineName, Category | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> eventDataList = parsePowerShellJson(output);

            for (Map<String, Object> eventData : eventDataList) {
                EventLogEntry entry = EventLogEntry.builder()
                        .time(formatDateTime(getStringValue(eventData.get("TimeGenerated"), "")))
                        .source(getStringValue(eventData.get("Source"), "Unknown"))
                        .eventId(getStringValue(eventData.get("InstanceId"), ""))
                        .level(getStringValue(eventData.get("EntryType"), "Information"))
                        .message(getStringValue(eventData.get("Message"), ""))
                        .user(getStringValue(eventData.get("UserName"), ""))
                        .computer(getStringValue(eventData.get("MachineName"), ""))
                        .category(getStringValue(eventData.get("Category"), ""))
                        .build();
                eventLogs.add(entry);
            }
        } catch (Exception e) {
            log.debug("Error getting event log entries", e);
        }
        return eventLogs;
    }

    private WindowsSecurityInfo getSecurityInfo() {
        try {
            // Get firewall status
            String firewallCommand = "powershell.exe -Command " +
                    "\"Get-NetFirewallProfile | " +
                    "Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction | " +
                    "ConvertTo-Json\"";

            String firewallOutput = exec(firewallCommand);
            List<Map<String, Object>> firewallDataList = parsePowerShellJson(firewallOutput);
            List<FirewallProfile> firewallProfiles = new ArrayList<>();
            boolean firewallEnabled = false;

            for (Map<String, Object> firewallData : firewallDataList) {
                boolean enabled = getBooleanValue(firewallData.get("Enabled"));
                if (enabled) firewallEnabled = true;

                FirewallProfile profile = FirewallProfile.builder()
                        .name(getStringValue(firewallData.get("Name"), "Unknown"))
                        .enabled(enabled)
                        .defaultInboundAction(getStringValue(firewallData.get("DefaultInboundAction"), "Block"))
                        .defaultOutboundAction(getStringValue(firewallData.get("DefaultOutboundAction"), "Allow"))
                        .build();
                firewallProfiles.add(profile);
            }

            // Get Windows Defender status
            String defenderCommand = "powershell.exe -Command " +
                    "\"Get-MpComputerStatus | " +
                    "Select-Object AntivirusEnabled, AntispywareEnabled, RealTimeProtectionEnabled | " +
                    "ConvertTo-Json\"";

            String defenderOutput = exec(defenderCommand);
            List<Map<String, Object>> defenderDataList = parsePowerShellJson(defenderOutput);
            boolean windowsDefenderEnabled = false;

            if (!defenderDataList.isEmpty()) {
                Map<String, Object> defenderData = defenderDataList.get(0);
                windowsDefenderEnabled = getBooleanValue(defenderData.get("AntivirusEnabled")) &&
                        getBooleanValue(defenderData.get("AntispywareEnabled")) &&
                        getBooleanValue(defenderData.get("RealTimeProtectionEnabled"));
            }

            // Get antivirus products
            List<AntivirusInfo> antivirusProducts = getAntivirusProducts();

            return WindowsSecurityInfo.builder()
                    .windowsDefenderEnabled(windowsDefenderEnabled)
                    .firewallEnabled(firewallEnabled)
                    .uacEnabled(isUacEnabled())
                    .bitLockerEnabled(isBitLockerEnabled())
                    .smartScreenEnabled(true) // Windows 10/11 have SmartScreen enabled by default
                    .secureBootEnabled(isSecureBootEnabled())
                    .firewallProfiles(firewallProfiles)
                    .antivirusProducts(antivirusProducts)
                    .build();

        } catch (Exception e) {
            log.debug("Error getting security info", e);
            return WindowsSecurityInfo.builder().build();
        }
    }

    private List<AntivirusInfo> getAntivirusProducts() {
        List<AntivirusInfo> antivirusList = new ArrayList<>();
        try {
            String command = "powershell.exe -Command " +
                    "\"Get-CimInstance -Namespace root\\SecurityCenter2 -ClassName AntiVirusProduct | " +
                    "Select-Object displayName, productState, pathToSignedProductExe | ConvertTo-Json\"";

            String output = exec(command);
            List<Map<String, Object>> avDataList = parsePowerShellJson(output);

            for (Map<String, Object> avData : avDataList) {
                AntivirusInfo av = AntivirusInfo.builder()
                        .name(getStringValue(avData.get("displayName"), "Unknown"))
                        .productState(getStringValue(avData.get("productState"), ""))
                        .enabled(true) // If it's in SecurityCenter, it's likely enabled
                        .build();
                antivirusList.add(av);
            }
        } catch (Exception e) {
            log.debug("Error getting antivirus products", e);
        }
        return antivirusList;
    }

    private boolean isUacEnabled() {
        try {
            String command = "powershell.exe -Command " +
                    "\"(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System').EnableLUA\"";
            String output = exec(command);
            return "1".equals(output.trim());
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isBitLockerEnabled() {
        try {
            String command = "powershell.exe -Command " +
                    "\"Manage-Bde -Status | Select-String 'Protection Status'\"";
            String output = exec(command);
            return output.contains("On");
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isSecureBootEnabled() {
        try {
            String command = "powershell.exe -Command " +
                    "\"Confirm-SecureBootUEFI\"";
            String output = exec(command);
            return output.contains("True");
        } catch (Exception e) {
            return false;
        }
    }

    private String formatDateTime(String dateTimeStr) {
        if (dateTimeStr == null || dateTimeStr.isEmpty()) {
            return "";
        }
        try {
            Instant instant = Instant.parse(dateTimeStr);
            LocalDateTime dateTime = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
            return dateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        } catch (Exception e) {
            return dateTimeStr;
        }
    }

    private String calculateUptime(String bootTimeStr) {
        if (bootTimeStr == null || bootTimeStr.isEmpty()) {
            return "Unknown";
        }
        try {
            Instant bootTime = Instant.parse(bootTimeStr);
            Duration duration = Duration.between(bootTime, Instant.now());
            return formatDuration(duration);
        } catch (Exception e) {
            return "Unknown";
        }
    }

    private String formatDuration(Duration duration) {
        long days = duration.toDays();
        long hours = duration.toHours() % 24;
        long minutes = duration.toMinutes() % 60;
        long seconds = duration.getSeconds() % 60;

        if (days > 0) {
            return String.format("%d days, %d hours, %d minutes", days, hours, minutes);
        } else if (hours > 0) {
            return String.format("%d hours, %d minutes, %d seconds", hours, minutes, seconds);
        } else {
            return String.format("%d minutes, %d seconds", minutes, seconds);
        }
    }

    private String getBiosVersion() {
        try {
            String command = "wmic bios get smbiosbiosversion /format:csv";
            String output = exec(command);
            if (output.contains(",")) {
                String[] lines = output.split("\n");
                if (lines.length > 1) {
                    String[] parts = lines[1].split(",");
                    if (parts.length >= 2) {
                        return parts[1].trim();
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Error getting BIOS version", e);
        }
        return "Unknown";
    }

    private String getBiosDate() {
        try {
            String command = "wmic bios get releasedate /format:csv";
            String output = exec(command);
            if (output.contains(",")) {
                String[] lines = output.split("\n");
                if (lines.length > 1) {
                    String[] parts = lines[1].split(",");
                    if (parts.length >= 2) {
                        return parts[1].trim();
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Error getting BIOS date", e);
        }
        return "Unknown";
    }

    // Helper methods for fallback parsing
    private CpuInfo parseWmicCpuInfo(String output) {
        try {
            String[] lines = output.split("\n");
            if (lines.length > 1) {
                String[] parts = lines[1].split(",");
                if (parts.length >= 9) {
                    return CpuInfo.builder()
                            .name(parts[1].trim())
                            .vendor(parts[2].trim())
                            .noOfCores(Integer.parseInt(parts[3].trim()))
                            .threads(Integer.parseInt(parts[4].trim()))
                            .maxFrequency(Long.parseLong(parts[5].trim()) * 1000000L)
                            .currentFrequency(Long.parseLong(parts[6].trim()) * 1000000L)
                            .l2Cache(Long.parseLong(parts[7].trim()))
                            .l3Cache(Long.parseLong(parts[8].trim()))
                            .availableProcessors(Runtime.getRuntime().availableProcessors())
                            .architecture(System.getProperty("os.arch"))
                            .build();
                }
            }
        } catch (Exception e) {
            log.debug("Error parsing WMIC CPU info", e);
        }
        return CpuInfo.builder()
                .availableProcessors(Runtime.getRuntime().availableProcessors())
                .architecture(System.getProperty("os.arch"))
                .build();
    }

    private MemoryInfo parseWmicMemoryInfo(String output) {
        try {
            String[] lines = output.split("\n");
            if (lines.length > 1) {
                String[] parts = lines[1].split(",");
                if (parts.length >= 5) {
                    long totalBytes = Long.parseLong(parts[1].trim()) * 1024;
                    long freeBytes = Long.parseLong(parts[2].trim()) * 1024;
                    long usedBytes = totalBytes - freeBytes;
                    double usedPercent = calculatePercentage(usedBytes, totalBytes);

                    MemoryInfo memoryInfo = MemoryInfo.builder()
                            .totalBytes(totalBytes)
                            .freeBytes(freeBytes)
                            .usedBytes(usedBytes)
                            .totalFormatted(formatBytes(totalBytes))
                            .freeFormatted(formatBytes(freeBytes))
                            .usedFormatted(formatBytes(usedBytes))
                            .usedPercent(String.format("%.1f", usedPercent))
                            .build();

                    addJavaMemoryInfo(memoryInfo);
                    return memoryInfo;
                }
            }
        } catch (Exception e) {
            log.debug("Error parsing WMIC memory info", e);
        }
        return getBasicMemoryInfo();
    }
}