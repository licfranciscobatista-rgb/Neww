export interface DevicePerformanceProfile {
  isLowMemoryDevice: boolean;
  deviceMemoryGb: number | null;
  stockfishHashMb: number;
  stockfishAutoRefine: boolean;
  preloadStockfish: boolean;
  allowRealMaia: boolean;
}

function readDeviceMemoryGb(): number | null {
  if (typeof navigator === 'undefined') return null;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === 'number' && Number.isFinite(memory) ? memory : null;
}

export function getDevicePerformanceProfile(): DevicePerformanceProfile {
  const deviceMemoryGb = readDeviceMemoryGb();
  const isLowMemoryDevice = deviceMemoryGb !== null && deviceMemoryGb <= 4;

  return {
    isLowMemoryDevice,
    deviceMemoryGb,
    stockfishHashMb: isLowMemoryDevice ? 8 : 16,
    stockfishAutoRefine: !isLowMemoryDevice,
    preloadStockfish: !isLowMemoryDevice,
    allowRealMaia: !isLowMemoryDevice,
  };
}
