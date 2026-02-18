//package com.db.dbworld.payloads.server;
//
//import com.db.dbworld.payloads.server.os.linux.LinuxServerInfo;
//import com.db.dbworld.payloads.server.os.mac.MacServerInfo;
//import com.db.dbworld.payloads.server.os.raspberrypi.RaspberryPiServerInfo;
//import com.db.dbworld.payloads.server.os.windows.WindowsServerInfo;
//import lombok.experimental.UtilityClass;
//
//@UtilityClass
//public class ServerInfoFactory {
//
//    public static BaseServerInfo create(String osType, boolean isRaspberryPi) {
//        if (isRaspberryPi) {
//            return RaspberryPiServerInfo.builder()
//                    .raspberryPi(true)
//                    .linux(true)
//                    .build();
//        }
//
//        return switch (osType.toLowerCase()) {
//            case "windows" -> WindowsServerInfo.builder().windows(true).build();
//            case "linux" -> LinuxServerInfo.builder().linux(true).build();
//            case "mac" -> MacServerInfo.builder().mac(true).build();
//            default -> BaseServerInfo.builder().build();
//        };
//    }
//}
//
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class BaseServerInfo {
//    private boolean windows;
//    private boolean linux;
//    private boolean raspberryPi;
//    private boolean mac;
//    private ServerInfo serverInfo;
//    private BiosInfo biosInfo;
//    private CpuInfo cpu;
//    private MemoryInfo memory;
//    private DiskInfo disk;
//    private NetworkInfo network;
//    private List<ProcessInfo> processes;
//    private List<ServiceInfo> services;
//    private PerformanceMetrics performance;
//    private HealthStatus healthStatus;
//    private TemperatureInfo temperature;
//    private String error;
//}
//
//
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class BiosInfo {
//    private String vendor;
//    private String version;
//    private String releaseDate;
//    private String firmwareRevision;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class CpuCore {
//    private Integer coreId;
//    private Long frequency;
//    private Integer load;
//    private String vendor;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class CpuInfo {
//    private String name;
//    private String vendor;
//    private Integer noOfCores;
//    private Integer threads;
//    private Long maxFrequency;
//    private Long currentFrequency;
//    private String architecture;
//    private Integer loadPercentage;
//    private Integer availableProcessors;
//    private Long l1Cache;
//    private Long l2Cache;
//    private Long l3Cache;
//    private List<CpuCore> cores;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class DiskInfo {
//    private List<DriveInfo> drives;
//    private Integer driveCount;
//    private Long totalSpace;
//    private Long freeSpace;
//    private Long usedSpace;
//    private String totalSpaceFormatted;
//    private String freeSpaceFormatted;
//    private String usedSpaceFormatted;
//
//    private String error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class DriveInfo {
//    private String device;
//    private String volumeName;
//    private String mountPoint;
//    private String fileSystem;
//    private Long totalBytes;
//    private Long freeBytes;
//    private Long usedBytes;
//    private String totalFormatted;
//    private String freeFormatted;
//    private String usedFormatted;
//    private String usedPercent;
//    private Boolean readOnly;
//    private String model;
//    private String serial;
//    private String type;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class HealthStatus {
//    private Integer score;
//    private HealthLevel level;
//    private List<String> warnings;
//    private List<String> issues;
//    private List<String> recommendations;
//    private Long timestamp;
//
//    public enum HealthLevel {
//        EXCELLENT,
//        GOOD,
//        FAIR,
//        POOR,
//        CRITICAL
//    }
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class MemoryInfo {
//    private Long totalBytes;
//    private Long freeBytes;
//    private Long usedBytes;
//    private Long swapTotal;
//    private Long swapFree;
//    private Long swapUsed;
//    private String totalFormatted;
//    private String freeFormatted;
//    private String usedFormatted;
//    private String usedPercent;
//    private Long buffers;
//    private Long cached;
//    private Long shared;
//    private Long available;
//    private Long javaTotalMemory;
//    private Long javaFreeMemory;
//    private Long javaMaxMemory;
//    private String javaTotalFormatted;
//    private String javaFreeFormatted;
//    private String javaMaxFormatted;
//
//    private String error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class NetworkAdapter {
//    private String name;
//    private String description;
//    private String macAddress;
//    private String ipAddress;
//    private String subnetMask;
//    private String status;
//    private Long speed;
//    private List<String> ipAddresses;
//    private Long bytesReceived;
//    private Long bytesSent;
//    private String duplex;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class NetworkInfo {
//    private String hostname;
//    private String domain;
//    private List<NetworkAdapter> adapters;
//    private List<String> dnsServers;
//    private List<String> ipAddresses;
//    private String defaultGateway;
//    private Long bytesReceived;
//    private Long bytesSent;
//    private Integer adapterCount;
//
//    private String Error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class PerformanceMetrics {
//    private Double cpuLoad1Min;
//    private Double cpuLoad5Min;
//    private Double cpuLoad15Min;
//    private Double memoryLoadPercent;
//    private Double diskIOLoad;
//    private Integer processCount;
//    private Integer threadCount;
//    private String uptime;
//    private Long contextSwitches;
//    private Long interrupts;
//    private Long pageFaults;
//    private Long diskReads;
//    private Long diskWrites;
//    private Long networkBytesIn;
//    private Long networkBytesOut;
//    private Long uptimeSeconds;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class ProcessInfo {
//    private String name;
//    private Integer pid;
//    private Integer ppid;
//    private String user;
//    private Double cpuUsage;
//    private Long memoryBytes;
//    private String memoryFormatted;
//    private String state;
//    private String commandLine;
//    private Long startTime;
//    private String session;
//    private Integer priority;
//    private Integer threads;
//    private Long residentMemory;
//    private Long virtualMemory;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class ServerInfo {
//    private String osName;
//    private String osVersion;
//    private String osArchitecture;
//    private String hostname;
//    private String manufacturer;
//    private String model;
//    private String serialNumber;
//    private String uptime;
//    private String bootTime;
//    private String kernelVersion;
//    private String distribution;
//    private String distributionVersion;
//    private String desktopEnvironment;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class ServiceInfo {
//    private String name;
//    private String displayName;
//    private String description;
//    private String status;
//    private String startType;
//    private String executablePath;
//    private String pid;
//    private String user;
//    private String group;
//    private Long memoryUsage;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class TemperatureInfo {
//    private List<TemperatureSensor> sensors;
//    private Boolean hasTemperatureSensors;
//    private String monitoringSoftware;
//    private Double averageTemperatureC;
//    private Double averageTemperatureF;
//    private String highestSensor;
//    private Double highestTemperatureC;
//
//    private String status;
//    private String error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class TemperatureSensor {
//    private String name;
//    private String type;
//    private Double temperatureC;
//    private Double temperatureF;
//    private String status;
//    private String location;
//    private Double highThreshold;
//    private Double criticalThreshold;
//}
//
//package com.db.dbworld.payloads.server;
//
//import com.db.dbworld.payloads.server.os.linux.LinuxServerInfo;
//import com.db.dbworld.payloads.server.os.mac.MacServerInfo;
//import com.db.dbworld.payloads.server.os.raspberrypi.RaspberryPiServerInfo;
//import com.db.dbworld.payloads.server.os.windows.WindowsServerInfo;
//import lombok.experimental.UtilityClass;
//
//@UtilityClass
//public class ServerInfoFactory {
//
//    public static BaseServerInfo create(String osType, boolean isRaspberryPi) {
//        if (isRaspberryPi) {
//            return RaspberryPiServerInfo.builder()
//                    .raspberryPi(true)
//                    .linux(true)
//                    .build();
//        }
//
//        return switch (osType.toLowerCase()) {
//            case "windows" -> WindowsServerInfo.builder().windows(true).build();
//            case "linux" -> LinuxServerInfo.builder().linux(true).build();
//            case "mac" -> MacServerInfo.builder().mac(true).build();
//            default -> BaseServerInfo.builder().build();
//        };
//    }
//}
//
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class BaseServerInfo {
//    private boolean windows;
//    private boolean linux;
//    private boolean raspberryPi;
//    private boolean mac;
//    private ServerInfo serverInfo;
//    private BiosInfo biosInfo;
//    private CpuInfo cpu;
//    private MemoryInfo memory;
//    private DiskInfo disk;
//    private NetworkInfo network;
//    private List<ProcessInfo> processes;
//    private List<ServiceInfo> services;
//    private PerformanceMetrics performance;
//    private HealthStatus healthStatus;
//    private TemperatureInfo temperature;
//    private String error;
//}
//
//
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class BiosInfo {
//    private String vendor;
//    private String version;
//    private String releaseDate;
//    private String firmwareRevision;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class CpuCore {
//    private Integer coreId;
//    private Long frequency;
//    private Integer load;
//    private String vendor;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class CpuInfo {
//    private String name;
//    private String vendor;
//    private Integer noOfCores;
//    private Integer threads;
//    private Long maxFrequency;
//    private Long currentFrequency;
//    private String architecture;
//    private Integer loadPercentage;
//    private Integer availableProcessors;
//    private Long l1Cache;
//    private Long l2Cache;
//    private Long l3Cache;
//    private List<CpuCore> cores;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class DiskInfo {
//    private List<DriveInfo> drives;
//    private Integer driveCount;
//    private Long totalSpace;
//    private Long freeSpace;
//    private Long usedSpace;
//    private String totalSpaceFormatted;
//    private String freeSpaceFormatted;
//    private String usedSpaceFormatted;
//
//    private String error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class DriveInfo {
//    private String device;
//    private String volumeName;
//    private String mountPoint;
//    private String fileSystem;
//    private Long totalBytes;
//    private Long freeBytes;
//    private Long usedBytes;
//    private String totalFormatted;
//    private String freeFormatted;
//    private String usedFormatted;
//    private String usedPercent;
//    private Boolean readOnly;
//    private String model;
//    private String serial;
//    private String type;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class HealthStatus {
//    private Integer score;
//    private HealthLevel level;
//    private List<String> warnings;
//    private List<String> issues;
//    private List<String> recommendations;
//    private Long timestamp;
//
//    public enum HealthLevel {
//        EXCELLENT,
//        GOOD,
//        FAIR,
//        POOR,
//        CRITICAL
//    }
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class MemoryInfo {
//    private Long totalBytes;
//    private Long freeBytes;
//    private Long usedBytes;
//    private Long swapTotal;
//    private Long swapFree;
//    private Long swapUsed;
//    private String totalFormatted;
//    private String freeFormatted;
//    private String usedFormatted;
//    private String usedPercent;
//    private Long buffers;
//    private Long cached;
//    private Long shared;
//    private Long available;
//    private Long javaTotalMemory;
//    private Long javaFreeMemory;
//    private Long javaMaxMemory;
//    private String javaTotalFormatted;
//    private String javaFreeFormatted;
//    private String javaMaxFormatted;
//
//    private String error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class NetworkAdapter {
//    private String name;
//    private String description;
//    private String macAddress;
//    private String ipAddress;
//    private String subnetMask;
//    private String status;
//    private Long speed;
//    private List<String> ipAddresses;
//    private Long bytesReceived;
//    private Long bytesSent;
//    private String duplex;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class NetworkInfo {
//    private String hostname;
//    private String domain;
//    private List<NetworkAdapter> adapters;
//    private List<String> dnsServers;
//    private List<String> ipAddresses;
//    private String defaultGateway;
//    private Long bytesReceived;
//    private Long bytesSent;
//    private Integer adapterCount;
//
//    private String Error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class PerformanceMetrics {
//    private Double cpuLoad1Min;
//    private Double cpuLoad5Min;
//    private Double cpuLoad15Min;
//    private Double memoryLoadPercent;
//    private Double diskIOLoad;
//    private Integer processCount;
//    private Integer threadCount;
//    private String uptime;
//    private Long contextSwitches;
//    private Long interrupts;
//    private Long pageFaults;
//    private Long diskReads;
//    private Long diskWrites;
//    private Long networkBytesIn;
//    private Long networkBytesOut;
//    private Long uptimeSeconds;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class ProcessInfo {
//    private String name;
//    private Integer pid;
//    private Integer ppid;
//    private String user;
//    private Double cpuUsage;
//    private Long memoryBytes;
//    private String memoryFormatted;
//    private String state;
//    private String commandLine;
//    private Long startTime;
//    private String session;
//    private Integer priority;
//    private Integer threads;
//    private Long residentMemory;
//    private Long virtualMemory;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class ServerInfo {
//    private String osName;
//    private String osVersion;
//    private String osArchitecture;
//    private String hostname;
//    private String manufacturer;
//    private String model;
//    private String serialNumber;
//    private String uptime;
//    private String bootTime;
//    private String kernelVersion;
//    private String distribution;
//    private String distributionVersion;
//    private String desktopEnvironment;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class ServiceInfo {
//    private String name;
//    private String displayName;
//    private String description;
//    private String status;
//    private String startType;
//    private String executablePath;
//    private String pid;
//    private String user;
//    private String group;
//    private Long memoryUsage;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//import java.util.List;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class TemperatureInfo {
//    private List<TemperatureSensor> sensors;
//    private Boolean hasTemperatureSensors;
//    private String monitoringSoftware;
//    private Double averageTemperatureC;
//    private Double averageTemperatureF;
//    private String highestSensor;
//    private Double highestTemperatureC;
//
//    private String status;
//    private String error;
//}
//package com.db.dbworld.payloads.server;
//
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//public class TemperatureSensor {
//    private String name;
//    private String type;
//    private Double temperatureC;
//    private Double temperatureF;
//    private String status;
//    private String location;
//    private Double highThreshold;
//    private Double criticalThreshold;
//}
//
//package com.db.dbworld.payloads.server.os.raspberrypi;
//
//import com.db.dbworld.payloads.server.BaseServerInfo;
//import lombok.AllArgsConstructor;
//import lombok.Data;
//import lombok.EqualsAndHashCode;
//import lombok.NoArgsConstructor;
//import lombok.experimental.SuperBuilder;
//import java.util.List;
//
//@Data
//@SuperBuilder
//@EqualsAndHashCode(callSuper = true)
//public class RaspberryPiServerInfo extends BaseServerInfo {
//    private RaspberryPiInfo raspberryPiInfo;
//    private GpioInfo gpioInfo;
//    private CameraInfo cameraInfo;
//    private HatInfo hatInfo;
//    private List<PackageInfo> installedPackages;
//    private OverclockInfo overclockInfo;
//    private DisplayInfo displayInfo;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class RaspberryPiInfo {
//    private Boolean isRaspberryPi;
//    private String model;
//    private String revision;
//    private String serial;
//    private Integer boardVersion;
//    private String hardware;
//    private String processor;
//    private String firmwareVersion;
//    private Integer memoryMB;
//    private String manufactureDate;
//    private String soc;
//    private String maker;
//    private String warrantyVoid;
//    private String revisionCode;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class GpioInfo {
//    private List<GpioPin> pins;
//    private String gpioLibrary;
//    private Boolean gpioAccessible;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class GpioPin {
//    private Integer pin;
//    private String name;
//    private String mode;
//    private String value;
//    private String function;
//    private String physicalPin;
//    private String bcmPin;
//    private String wpiPin;
//    private Boolean pullUp;
//    private Boolean pullDown;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class CameraInfo {
//    private Boolean cameraEnabled;
//    private Boolean cameraDetected;
//    private String cameraModel;
//    private String cameraDriver;
//    private String cameraResolution;
//    private Boolean cameraSupported;
//    private String cameraFirmware;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class HatInfo {
//    private Boolean hatPresent;
//    private String hatVendor;
//    private String hatProduct;
//    private String hatVersion;
//    private String hatUuid;
//    private List<HatGpioMapping> gpioMappings;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class HatGpioMapping {
//    private String function;
//    private Integer pin;
//    private String description;
//    private Boolean activeLow;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class OverclockInfo {
//    private Boolean overVoltage;
//    private Integer armFrequency;
//    private Integer coreFrequency;
//    private Integer sdramFrequency;
//    private Integer gpuFrequency;
//    private Boolean turboEnabled;
//    private Integer overVoltageMin;
//    private Integer overVoltageMax;
//    private String overclockPreset;
//    private Boolean forceTurbo;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class DisplayInfo {
//    private Boolean displayConnected;
//    private String displayType;
//    private String displayResolution;
//    private String displayOverscan;
//    private String displayHdmiMode;
//    private Boolean displayHdmiSafe;
//    private Boolean displayCompositeEnabled;
//}
//
//@Data
//@SuperBuilder
//@NoArgsConstructor
//@AllArgsConstructor
//class PackageInfo {
//    private String name;
//    private String version;
//    private String architecture;
//    private String repository;
//    private Long size;
//    private String description;
//    private String maintainer;
//    private Long installDate;
//    private String section;
//}
//
//
