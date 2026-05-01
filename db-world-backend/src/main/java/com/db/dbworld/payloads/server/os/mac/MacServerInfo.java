package com.db.dbworld.payloads.server.os.mac;

import com.db.dbworld.payloads.server.BaseServerInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import java.util.List;

@Data
@SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class MacServerInfo extends BaseServerInfo {
    private MacInfo macInfo;
    private MacBatteryInfo battery;
    private List<ApplicationInfo> applications;
    private List<LoginItem> loginItems;
    private MacSecurityInfo security;
    private BluetoothInfo bluetooth;
    private MacHardwareDetails hardwareDetails;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class MacInfo {
    private String darwinVersion;
    private String systemVersion;
    private String systemIntegrityProtection;
    private String bootVolume;
    private String secureBoot;
    private String activeDirectory;
    private String xprotectVersion;
    private String gatekeeperStatus;
    private String softwareUpdateStatus;
    private String timeMachineStatus;
    private String icloudStatus;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class MacBatteryInfo {
    private Boolean hasBattery;
    private Boolean isCharging;
    private Integer chargeLevel;
    private Integer cycleCount;
    private Integer designCycleCount;
    private Integer maxCapacity;
    private Integer designCapacity;
    private String condition;
    private Integer temperature;
    private Integer voltage;
    private Integer amperage;
    private String batteryType;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class ApplicationInfo {
    private String name;
    private String version;
    private String bundleId;
    private String path;
    private Long size;
    private String architecture;
    private Boolean is64Bit;
    private String lastModified;
    private String developer;
    private String category;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class LoginItem {
    private String name;
    private String path;
    private Boolean hidden;
    private Boolean keepAlive;
    private String type;
    private Boolean disabled;
    private String programArguments;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class MacSecurityInfo {
    private Boolean firewallEnabled;
    private Boolean stealthMode;
    private Boolean fileVaultEnabled;
    private String fileVaultStatus;
    private Boolean sipEnabled;
    private Boolean gatekeeperEnabled;
    private List<String> authorizedApplications;
    private Boolean automaticUpdatesEnabled;
    private String firewallLogging;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class BluetoothInfo {
    private Boolean enabled;
    private String controller;
    private List<BluetoothDevice> devices;
    private String firmwareVersion;
    private String powerState;
    private Boolean discoverable;
    private Boolean pairable;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class BluetoothDevice {
    private String name;
    private String address;
    private String type;
    private Boolean connected;
    private Boolean paired;
    private Integer batteryLevel;
    private String manufacturer;
    private Integer rssi;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class MacHardwareDetails {
    private String smcVersion;
    private String bootRomVersion;
    private String hardwareUUID;
    private String provisioningUDID;
    private List<ThunderboltPort> thunderboltPorts;
    private List<UsbPort> usbPorts;
    private List<PCIeDevice> pcieDevices;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class ThunderboltPort {
    private Integer port;
    private String deviceName;
    private String uuid;
    private String status;
    private Integer speed;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class UsbPort {
    private Integer port;
    private String deviceName;
    private String speed;
    private String manufacturer;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class PCIeDevice {
    private String name;
    private String vendor;
    private String deviceId;
    private String revision;
    private String driver;
}