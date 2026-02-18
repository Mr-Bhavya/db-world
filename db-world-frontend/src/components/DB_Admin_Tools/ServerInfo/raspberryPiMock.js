// src/mocks/raspberryPiMock.js
export const raspberryPiMockData = {
  "windows": false,
  "linux": true,
  "raspberryPi": true,
  "mac": false,
  "serverInfo": {
    "osName": "Raspberry Pi OS (64-bit)",
    "osVersion": "11 (bullseye)",
    "osArchitecture": "aarch64",
    "hostname": "raspberrypi",
    "manufacturer": "Raspberry Pi Foundation",
    "model": "Raspberry Pi 4 Model B Rev 1.4",
    "serialNumber": "c03114xxxxxxxx",
    "uptime": "5 days 12 hours 34 minutes",
    "bootTime": "2024-01-15T08:30:00Z",
    "kernelVersion": "5.15.84-v8+",
    "distribution": "Raspberry Pi OS",
    "distributionVersion": "11",
    "desktopEnvironment": "X-Cinnamon"
  },
  "biosInfo": {
    "vendor": "Broadcom",
    "version": "firmware 20230217",
    "releaseDate": "2023-02-17T00:00:00Z",
    "firmwareRevision": "1.20230217"
  },
  "cpu": {
    "name": "ARMv8 Processor rev 4 (v8l)",
    "vendor": "ARM",
    "noOfCores": 4,
    "threads": 4,
    "maxFrequency": 1800000000,
    "currentFrequency": 1500000000,
    "architecture": "aarch64",
    "loadPercentage": 42,
    "availableProcessors": 4,
    "l1Cache": 32768,
    "l2Cache": 1048576,
    "l3Cache": null,
    "cores": [
      {
        "coreId": 0,
        "frequency": 1500000000,
        "load": 38,
        "vendor": "ARM"
      },
      {
        "coreId": 1,
        "frequency": 1500000000,
        "load": 45,
        "vendor": "ARM"
      },
      {
        "coreId": 2,
        "frequency": 1500000000,
        "load": 52,
        "vendor": "ARM"
      },
      {
        "coreId": 3,
        "frequency": 1500000000,
        "load": 33,
        "vendor": "ARM"
      }
    ],
    "error": null
  },
  "memory": {
    "totalBytes": 8589934592,
    "freeBytes": 2147483648,
    "usedBytes": 6442450944,
    "swapTotal": 1073741824,
    "swapFree": 536870912,
    "swapUsed": 536870912,
    "totalFormatted": "8.00 GB",
    "freeFormatted": "2.00 GB",
    "usedFormatted": "6.00 GB",
    "usedPercent": "75.0",
    "buffers": 268435456,
    "cached": 1073741824,
    "shared": 134217728,
    "available": 3221225472,
    "javaTotalMemory": 268435456,
    "javaFreeMemory": 134217728,
    "javaMaxMemory": 2147483648,
    "javaTotalFormatted": "256.00 MB",
    "javaFreeFormatted": "128.00 MB",
    "javaMaxFormatted": "2.00 GB",
    "error": null
  },
  "disk": {
    "drives": [
      {
        "device": "/dev/mmcblk0p1",
        "volumeName": "boot",
        "mountPoint": "/boot",
        "fileSystem": "vfat",
        "totalBytes": 535822336,
        "freeBytes": 107374182,
        "usedBytes": 428448154,
        "totalFormatted": "511.00 MB",
        "freeFormatted": "102.41 MB",
        "usedFormatted": "408.59 MB",
        "usedPercent": "80.0",
        "readOnly": false,
        "model": "SanDisk Ultra 64GB",
        "serial": "1234567890ABCDEF",
        "type": "SD Card"
      },
      {
        "device": "/dev/mmcblk0p2",
        "volumeName": "rootfs",
        "mountPoint": "/",
        "fileSystem": "ext4",
        "totalBytes": 60000000000,
        "freeBytes": 15000000000,
        "usedBytes": 45000000000,
        "totalFormatted": "55.88 GB",
        "freeFormatted": "13.97 GB",
        "usedFormatted": "41.91 GB",
        "usedPercent": "75.0",
        "readOnly": false,
        "model": "SanDisk Ultra 64GB",
        "serial": "1234567890ABCDEF",
        "type": "SD Card"
      },
      {
        "device": "/dev/sda1",
        "volumeName": "BACKUP",
        "mountPoint": "/media/pi/BACKUP",
        "fileSystem": "ntfs",
        "totalBytes": 1000204886016,
        "freeBytes": 500102443008,
        "usedBytes": 500102443008,
        "totalFormatted": "931.51 GB",
        "freeFormatted": "465.76 GB",
        "usedFormatted": "465.76 GB",
        "usedPercent": "50.0",
        "readOnly": false,
        "model": "WD Elements 1TB",
        "serial": "WD-WX32A1234567",
        "type": "USB Drive"
      },
      {
        "device": "/dev/sdb1",
        "volumeName": "EXTERNAL_SSD",
        "mountPoint": "/media/pi/EXTERNAL_SSD",
        "fileSystem": "ext4",
        "totalBytes": 500107862016,
        "freeBytes": 350075503411,
        "usedBytes": 150032358605,
        "totalFormatted": "465.76 GB",
        "freeFormatted": "326.04 GB",
        "usedFormatted": "139.72 GB",
        "usedPercent": "30.0",
        "readOnly": false,
        "model": "Samsung T7 SSD",
        "serial": "S2HCNX0MA12345",
        "type": "USB Drive"
      },
      {
        "device": "192.168.1.100:/nas",
        "volumeName": "NAS_SHARE",
        "mountPoint": "/mnt/nas",
        "fileSystem": "nfs",
        "totalBytes": 4000000000000,
        "freeBytes": 1000000000000,
        "usedBytes": 3000000000000,
        "totalFormatted": "3.64 TB",
        "freeFormatted": "931.32 GB",
        "usedFormatted": "2.73 TB",
        "usedPercent": "75.0",
        "readOnly": false,
        "model": null,
        "serial": null,
        "type": "Network Share (NFS/SMB)"
      }
    ],
    "driveCount": 5,
    "totalSpace": 4701152484352,
    "freeSpace": 1371223077609,
    "usedSpace": 3329929406743,
    "totalSpaceFormatted": "4.28 TB",
    "freeSpaceFormatted": "1.25 TB",
    "usedSpaceFormatted": "3.03 TB",
    "error": null
  },
  "network": {
    "hostname": "raspberrypi",
    "domain": "local",
    "adapters": [
      {
        "name": "wlan0",
        "description": "Wireless interface",
        "macAddress": "DC:A6:32:01:23:45",
        "ipAddress": "192.168.1.101",
        "subnetMask": "255.255.255.0",
        "status": "Up",
        "speed": 866700000,
        "ipAddresses": ["192.168.1.101", "fe80::dea6:32ff:fe01:2345"],
        "bytesReceived": 15234567890,
        "bytesSent": 8765432109,
        "duplex": "full"
      },
      {
        "name": "eth0",
        "description": "Ethernet interface",
        "macAddress": "DC:A6:32:01:23:46",
        "ipAddress": "192.168.1.102",
        "subnetMask": "255.255.255.0",
        "status": "Up",
        "speed": 1000000000,
        "ipAddresses": ["192.168.1.102", "fe80::dea6:32ff:fe01:2346"],
        "bytesReceived": 9876543210,
        "bytesSent": 1234567890,
        "duplex": "full"
      },
      {
        "name": "usb0",
        "description": "USB Ethernet",
        "macAddress": "02:00:00:00:00:01",
        "ipAddress": "10.55.0.1",
        "subnetMask": "255.255.255.0",
        "status": "Up",
        "speed": 480000000,
        "ipAddresses": ["10.55.0.1"],
        "bytesReceived": 1234567,
        "bytesSent": 987654,
        "duplex": "full"
      }
    ],
    "dnsServers": ["192.168.1.1", "8.8.8.8", "8.8.4.4"],
    "ipAddresses": ["192.168.1.101", "192.168.1.102", "10.55.0.1", "fe80::dea6:32ff:fe01:2345", "fe80::dea6:32ff:fe01:2346"],
    "defaultGateway": "192.168.1.1",
    "bytesReceived": 25113576567,
    "bytesSent": 10123456789,
    "adapterCount": 3,
    "Error": null
  },
  "processes": [
    {
      "name": "systemd",
      "pid": 1,
      "ppid": 0,
      "user": "root",
      "cpuUsage": 0.5,
      "memoryBytes": 8388608,
      "memoryFormatted": "8.00 MB",
      "state": "S",
      "commandLine": "/sbin/init",
      "startTime": 1705300200000,
      "session": null,
      "priority": 20,
      "threads": 1,
      "residentMemory": 4194304,
      "virtualMemory": 268435456
    },
    {
      "name": "kthreadd",
      "pid": 2,
      "ppid": 0,
      "user": "root",
      "cpuUsage": 0.0,
      "memoryBytes": 0,
      "memoryFormatted": "0 B",
      "state": "S",
      "commandLine": "",
      "startTime": 1705300200000,
      "session": null,
      "priority": 20,
      "threads": 1,
      "residentMemory": 0,
      "virtualMemory": 0
    },
    {
      "name": "xorg",
      "pid": 456,
      "ppid": 1,
      "user": "root",
      "cpuUsage": 5.2,
      "memoryBytes": 52428800,
      "memoryFormatted": "50.00 MB",
      "state": "S",
      "commandLine": "/usr/bin/Xorg :0 -seat seat0 -auth /var/run/lightdm/root/:0 -nolisten tcp vt7 -novtswitch",
      "startTime": 1705300250000,
      "session": null,
      "priority": 20,
      "threads": 4,
      "residentMemory": 41943040,
      "virtualMemory": 268435456
    },
    {
      "name": "chromium-browse",
      "pid": 1234,
      "ppid": 1000,
      "user": "pi",
      "cpuUsage": 12.5,
      "memoryBytes": 524288000,
      "memoryFormatted": "500.00 MB",
      "state": "S",
      "commandLine": "/usr/bin/chromium-browser --type=renderer --field-trial-handle=...",
      "startTime": 1705301000000,
      "session": null,
      "priority": 20,
      "threads": 12,
      "residentMemory": 419430400,
      "virtualMemory": 2147483648
    },
    {
      "name": "python3",
      "pid": 2345,
      "ppid": 1000,
      "user": "pi",
      "cpuUsage": 8.3,
      "memoryBytes": 67108864,
      "memoryFormatted": "64.00 MB",
      "state": "S",
      "commandLine": "python3 /home/pi/scripts/sensor_monitor.py",
      "startTime": 1705301500000,
      "session": null,
      "priority": 20,
      "threads": 2,
      "residentMemory": 33554432,
      "virtualMemory": 268435456
    },
    {
      "name": "node",
      "pid": 3456,
      "ppid": 1000,
      "user": "pi",
      "cpuUsage": 3.7,
      "memoryBytes": 134217728,
      "memoryFormatted": "128.00 MB",
      "state": "S",
      "commandLine": "node /home/pi/projects/dashboard/server.js",
      "startTime": 1705302000000,
      "session": null,
      "priority": 20,
      "threads": 4,
      "residentMemory": 100663296,
      "virtualMemory": 536870912
    },
    {
      "name": "docker",
      "pid": 789,
      "ppid": 1,
      "user": "root",
      "cpuUsage": 1.2,
      "memoryBytes": 104857600,
      "memoryFormatted": "100.00 MB",
      "state": "S",
      "commandLine": "/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock",
      "startTime": 1705300300000,
      "session": null,
      "priority": 20,
      "threads": 8,
      "residentMemory": 83886080,
      "virtualMemory": 536870912
    },
    {
      "name": "sshd",
      "pid": 567,
      "ppid": 1,
      "user": "root",
      "cpuUsage": 0.3,
      "memoryBytes": 8388608,
      "memoryFormatted": "8.00 MB",
      "state": "S",
      "commandLine": "/usr/sbin/sshd -D",
      "startTime": 1705300250000,
      "session": null,
      "priority": 20,
      "threads": 2,
      "residentMemory": 4194304,
      "virtualMemory": 134217728
    }
  ],
  "services": [
    {
      "name": "ssh",
      "displayName": "OpenSSH SSH Server",
      "description": "OpenBSD Secure Shell server",
      "status": "Running",
      "startType": "Enabled",
      "executablePath": "/usr/sbin/sshd -D",
      "pid": "567",
      "user": "root",
      "group": null,
      "memoryUsage": 8388608
    },
    {
      "name": "docker",
      "displayName": "Docker Application Container Engine",
      "description": "Docker Application Container Engine",
      "status": "Running",
      "startType": "Enabled",
      "executablePath": "/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock",
      "pid": "789",
      "user": "root",
      "group": null,
      "memoryUsage": 104857600
    },
    {
      "name": "nginx",
      "displayName": "nginx - high performance web server",
      "description": "nginx HTTP and reverse proxy server",
      "status": "Running",
      "startType": "Enabled",
      "executablePath": "/usr/sbin/nginx -g daemon on; master_process on;",
      "pid": "890",
      "user": "www-data",
      "group": null,
      "memoryUsage": 25165824
    },
    {
      "name": "mongodb",
      "displayName": "MongoDB Database Server",
      "description": "High-performance, schema-free document-oriented database",
      "status": "Running",
      "startType": "Enabled",
      "executablePath": "/usr/bin/mongod --config /etc/mongod.conf",
      "pid": "901",
      "user": "mongodb",
      "group": null,
      "memoryUsage": 268435456
    },
    {
      "name": "postgresql",
      "displayName": "PostgreSQL RDBMS",
      "description": "PostgreSQL database server",
      "status": "Running",
      "startType": "Enabled",
      "executablePath": "/usr/lib/postgresql/13/bin/postgres -D /var/lib/postgresql/13/main -c config_file=/etc/postgresql/13/main/postgresql.conf",
      "pid": "912",
      "user": "postgres",
      "group": null,
      "memoryUsage": 134217728
    },
    {
      "name": "bluetooth",
      "displayName": "Bluetooth service",
      "description": "Bluetooth service",
      "status": "Running",
      "startType": "Enabled",
      "executablePath": "/usr/lib/bluetooth/bluetoothd",
      "pid": "345",
      "user": "root",
      "group": null,
      "memoryUsage": 8388608
    }
  ],
  "performance": {
    "cpuLoad1Min": 3.85,
    "cpuLoad5Min": 2.45,
    "cpuLoad15Min": 1.95,
    "memoryLoadPercent": 75.0,
    "diskIOLoad": 12.5,
    "processCount": 345,
    "threadCount": 987,
    "uptime": "5 days 12 hours 34 minutes",
    "contextSwitches": 123456789,
    "interrupts": 98765432,
    "pageFaults": 45678901,
    "diskReads": 123456,
    "diskWrites": 98765,
    "networkBytesIn": 25113576567,
    "networkBytesOut": 10123456789,
    "uptimeSeconds": 478440
  },
  "healthStatus": {
    "score": 78,
    "level": "FAIR",
    "warnings": [
      "Memory usage getting high: 75.0%",
      "Boot partition is 80% full",
      "CPU temperature is 65°C - consider adding cooling"
    ],
    "issues": [],
    "recommendations": [
      "Consider adding a heat sink or fan",
      "Clean up boot partition",
      "Monitor memory usage"
    ],
    "timestamp": 1705746840000
  },
  "temperature": {
    "sensors": [
      {
        "name": "CPU Temperature",
        "type": "CPU",
        "temperatureC": 65.2,
        "temperatureF": 149.4,
        "status": "Warning",
        "location": "SoC",
        "highThreshold": 70.0,
        "criticalThreshold": 85.0
      },
      {
        "name": "GPU Temperature",
        "type": "GPU",
        "temperatureC": 58.7,
        "temperatureF": 137.7,
        "status": "Normal",
        "location": "GPU Core",
        "highThreshold": 75.0,
        "criticalThreshold": 85.0
      },
      {
        "name": "Throttling Status",
        "type": "System",
        "temperatureC": null,
        "temperatureF": null,
        "status": "Normal",
        "location": "SoC",
        "highThreshold": null,
        "criticalThreshold": null
      }
    ],
    "hasTemperatureSensors": true,
    "monitoringSoftware": "vcgencmd / sysfs",
    "averageTemperatureC": 61.95,
    "averageTemperatureF": 143.5,
    "highestSensor": "CPU",
    "highestTemperatureC": 65.2,
    "status": "Temperature monitoring active",
    "error": null
  },
  "raspberryPiInfo": {
    "isRaspberryPi": true,
    "model": "Raspberry Pi 4 Model B Rev 1.4",
    "revision": "c03114",
    "serial": "c03114xxxxxxxx",
    "boardVersion": 14,
    "hardware": "BCM2711",
    "processor": "Cortex-A72",
    "firmwareVersion": "firmware 20230217 (c) 2012-2023 Raspberry Pi Ltd.",
    "memoryMB": 8192,
    "manufactureDate": "2023-05",
    "soc": "BCM2711",
    "maker": "Raspberry Pi Foundation",
    "warrantyVoid": "No",
    "revisionCode": "c03114"
  },
  "gpioInfo": {
    "pins": [
      {
        "pin": 2,
        "name": "GPIO2",
        "mode": "IN",
        "value": "1",
        "function": "SDA1",
        "physicalPin": "3",
        "bcmPin": "2",
        "wpiPin": "8",
        "pullUp": true,
        "pullDown": false
      },
      {
        "pin": 3,
        "name": "GPIO3",
        "mode": "IN",
        "value": "1",
        "function": "SCL1",
        "physicalPin": "5",
        "bcmPin": "3",
        "wpiPin": "9",
        "pullUp": true,
        "pullDown": false
      },
      {
        "pin": 4,
        "name": "GPIO4",
        "mode": "OUT",
        "value": "0",
        "function": "GPCLK0",
        "physicalPin": "7",
        "bcmPin": "4",
        "wpiPin": "7",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 17,
        "name": "GPIO17",
        "mode": "OUT",
        "value": "1",
        "function": "GPIO",
        "physicalPin": "11",
        "bcmPin": "17",
        "wpiPin": "0",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 18,
        "name": "GPIO18",
        "mode": "PWM",
        "value": "0",
        "function": "PWM0",
        "physicalPin": "12",
        "bcmPin": "18",
        "wpiPin": "1",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 27,
        "name": "GPIO27",
        "mode": "IN",
        "value": "0",
        "function": "GPIO",
        "physicalPin": "13",
        "bcmPin": "27",
        "wpiPin": "2",
        "pullUp": false,
        "pullDown": true
      },
      {
        "pin": 22,
        "name": "GPIO22",
        "mode": "OUT",
        "value": "1",
        "function": "GPIO",
        "physicalPin": "15",
        "bcmPin": "22",
        "wpiPin": "3",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 23,
        "name": "GPIO23",
        "mode": "IN",
        "value": "1",
        "function": "GPIO",
        "physicalPin": "16",
        "bcmPin": "23",
        "wpiPin": "4",
        "pullUp": true,
        "pullDown": false
      },
      {
        "pin": 24,
        "name": "GPIO24",
        "mode": "OUT",
        "value": "0",
        "function": "GPIO",
        "physicalPin": "18",
        "bcmPin": "24",
        "wpiPin": "5",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 10,
        "name": "GPIO10",
        "mode": "ALT0",
        "value": "1",
        "function": "SPI0_MOSI",
        "physicalPin": "19",
        "bcmPin": "10",
        "wpiPin": "12",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 9,
        "name": "GPIO9",
        "mode": "ALT0",
        "value": "0",
        "function": "SPI0_MISO",
        "physicalPin": "21",
        "bcmPin": "9",
        "wpiPin": "13",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 25,
        "name": "GPIO25",
        "mode": "OUT",
        "value": "1",
        "function": "GPIO",
        "physicalPin": "22",
        "bcmPin": "25",
        "wpiPin": "6",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 11,
        "name": "GPIO11",
        "mode": "ALT0",
        "value": "0",
        "function": "SPI0_SCLK",
        "physicalPin": "23",
        "bcmPin": "11",
        "wpiPin": "14",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 8,
        "name": "GPIO8",
        "mode": "ALT0",
        "value": "1",
        "function": "SPI0_CE0_N",
        "physicalPin": "24",
        "bcmPin": "8",
        "wpiPin": "10",
        "pullUp": false,
        "pullDown": false
      },
      {
        "pin": 7,
        "name": "GPIO7",
        "mode": "ALT0",
        "value": "1",
        "function": "SPI0_CE1_N",
        "physicalPin": "26",
        "bcmPin": "7",
        "wpiPin": "11",
        "pullUp": false,
        "pullDown": false
      }
    ],
    "gpioLibrary": "RPi.GPIO (Python)",
    "gpioAccessible": true
  },
  "cameraInfo": {
    "cameraEnabled": true,
    "cameraDetected": true,
    "cameraModel": "Raspberry Pi Camera Module v2",
    "cameraDriver": "vcgencmd",
    "cameraResolution": "1920x1080",
    "cameraSupported": true,
    "cameraFirmware": "firmware 20230217"
  },
  "hatInfo": {
    "hatPresent": true,
    "hatVendor": "Pimoroni",
    "hatProduct": "Pirate Audio",
    "hatVersion": "1.0",
    "hatUuid": "12345678-1234-1234-1234-123456789012",
    "gpioMappings": [
      {
        "function": "BUTTON_A",
        "pin": 5,
        "description": "Button A",
        "activeLow": true
      },
      {
        "function": "BUTTON_B",
        "pin": 6,
        "description": "Button B",
        "activeLow": true
      },
      {
        "function": "LED",
        "pin": 13,
        "description": "Status LED",
        "activeLow": false
      },
      {
        "function": "AUDIO",
        "pin": 18,
        "description": "Audio PWM",
        "activeLow": false
      }
    ]
  },
  "installedPackages": [
    {
      "name": "python3",
      "version": "3.9.2-3",
      "architecture": "arm64",
      "repository": "apt",
      "size": 45200,
      "description": "Interactive high-level object-oriented language (version 3.9)",
      "maintainer": "Matthias Klose <doko@debian.org>",
      "installDate": 1705300200000,
      "section": "python"
    },
    {
      "name": "nodejs",
      "version": "18.13.0+dfsg-1~deb11u1",
      "architecture": "arm64",
      "repository": "apt",
      "size": 168400,
      "description": "Evented I/O for V8 javascript",
      "maintainer": "Debian Javascript Maintainers <pkg-javascript-devel@lists.alioth.debian.org>",
      "installDate": 1705301000000,
      "section": "javascript"
    },
    {
      "name": "docker-ce",
      "version": "5:20.10.23~3-0~debian-bullseye",
      "architecture": "arm64",
      "repository": "docker",
      "size": 134560,
      "description": "Docker: the open-source application container engine",
      "maintainer": "Docker <support@docker.com>",
      "installDate": 1705300500000,
      "section": "admin"
    },
    {
      "name": "nginx",
      "version": "1.18.0-6.1+deb11u3",
      "architecture": "arm64",
      "repository": "apt",
      "size": 56400,
      "description": "high performance web server",
      "maintainer": "Debian Nginx Maintainers <pkg-nginx-maintainers@lists.alioth.debian.org>",
      "installDate": 1705300600000,
      "section": "httpd"
    },
    {
      "name": "mongodb-org",
      "version": "6.0.4",
      "architecture": "arm64",
      "repository": "mongodb",
      "size": 224560,
      "description": "MongoDB document-oriented database system",
      "maintainer": "MongoDB Inc. <packaging@mongodb.com>",
      "installDate": 1705300700000,
      "section": "database"
    },
    {
      "name": "postgresql-13",
      "version": "13.10-0+deb11u1",
      "architecture": "arm64",
      "repository": "apt",
      "size": 112400,
      "description": "object-relational SQL database, version 13 server",
      "maintainer": "Debian PostgreSQL Maintainers <team+postgresql@tracker.debian.org>",
      "installDate": 1705300800000,
      "section": "database"
    },
    {
      "name": "chromium-browser",
      "version": "109.0.5414.119-1~deb11u1",
      "architecture": "arm64",
      "repository": "apt",
      "size": 456800,
      "description": "Chromium browser",
      "maintainer": "Debian Chromium Team <pkg-chromium-maint@lists.alioth.debian.org>",
      "installDate": 1705300900000,
      "section": "web"
    },
    {
      "name": "vlc",
      "version": "3.0.18-0+deb11u1",
      "architecture": "arm64",
      "repository": "apt",
      "size": 89600,
      "description": "multimedia player and streamer",
      "maintainer": "Debian Multimedia Maintainers <debian-multimedia@lists.debian.org>",
      "installDate": 1705300950000,
      "section": "video"
    },
    {
      "name": "rpi-chromium-mods",
      "version": "20221115",
      "architecture": "arm64",
      "repository": "rpi",
      "size": 1200,
      "description": "Modifications to Chromium for Raspberry Pi OS",
      "maintainer": "Simon Long <simon@raspberrypi.com>",
      "installDate": 1705300200000,
      "section": "web"
    },
    {
      "name": "raspi-config",
      "version": "20230530",
      "architecture": "all",
      "repository": "rpi",
      "size": 560,
      "description": "Raspberry Pi configuration tool",
      "maintainer": "Simon Long <simon@raspberrypi.com>",
      "installDate": 1705300200000,
      "section": "admin"
    }
  ],
  "overclockInfo": {
    "overVoltage": true,
    "armFrequency": 2000,
    "coreFrequency": 500,
    "sdramFrequency": 450,
    "gpuFrequency": 600,
    "turboEnabled": true,
    "overVoltageMin": 6,
    "overVoltageMax": 6,
    "overclockPreset": "turbo",
    "forceTurbo": false
  },
  "displayInfo": {
    "displayConnected": true,
    "displayType": "HDMI",
    "displayResolution": "1920x1080",
    "displayOverscan": "left=0 right=0 top=0 bottom=0",
    "displayHdmiMode": "16",
    "displayHdmiSafe": false,
    "displayCompositeEnabled": false
  },
  "hardwareDetails": {
    "audioDevices": [
      {
        "name": "bcm2835_audio - bcm2835 ALSA",
        "manufacturer": "Broadcom",
        "status": "OK",
        "isDefault": true,
        "driverVersion": null
      },
      {
        "name": "USB Audio - USB Audio",
        "manufacturer": "Generic",
        "status": "OK",
        "isDefault": false,
        "driverVersion": null
      }
    ],
    "usbDevices": [
      {
        "description": "Bus 001 Device 002: ID 0424:9514 Microchip Technology, Inc. (formerly SMSC) SMC9514 Hub"
      },
      {
        "description": "Bus 001 Device 003: ID 0424:ec00 Microchip Technology, Inc. (formerly SMSC) SMSC9512/9514 Fast Ethernet Adapter"
      },
      {
        "description": "Bus 001 Device 004: ID 0781:5581 SanDisk Corp. Ultra"
      },
      {
        "description": "Bus 001 Device 005: ID 04e8:6860 Samsung Electronics Co., Ltd Galaxy series, misc. (tethering mode)"
      }
    ],
    "storageControllers": [
      {
        "name": "MMC/SD Host Controller",
        "manufacturer": "Broadcom",
        "driverVersion": null,
        "pnpDeviceId": null
      },
      {
        "name": "USB controller",
        "manufacturer": "Unknown",
        "driverVersion": null,
        "pnpDeviceId": null
      }
    ],
    "motherboard": {
      "manufacturer": "Raspberry Pi Foundation",
      "product": "Raspberry Pi 4 Model B",
      "serial": "c03114xxxxxxxx",
      "version": "1.4",
      "biosVersion": "firmware 20230217",
      "biosDate": "2023-02-17"
    }
  },
  "collectorType": "RaspberryPi",
  "collectionDuration": 1234,
  "timestamp": 1705746840000,
  "error": null
};

// Simulate API delay
export const getMockRaspberryPiData = (delay = 1000) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(raspberryPiMockData);
    }, delay);
  });
};