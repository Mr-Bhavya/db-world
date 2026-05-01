package com.db.dbworld.payloads.server.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class WindowsHardwareDetails {
    private MotherboardInfo motherboard;
    private List<AudioDevice> audioDevices;
    private List<UsbDevice> usbDevices;
    private List<MonitorInfo> monitors;
    private List<PrinterInfo> printers;
    private List<StorageController> storageControllers;
}
