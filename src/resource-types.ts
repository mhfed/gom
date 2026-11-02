export interface ResourceUsage {
  memoryMiB: number | null;
  cpuPercent: number | null;
}
export interface ResourceAccountUsage extends ResourceUsage {
  shared: boolean;
}
export interface ResourceSnapshot {
  sampledAt: number;
  total: ResourceUsage;
  accountsTotal: ResourceUsage;
  other: ResourceUsage;
  accounts: Record<string, ResourceAccountUsage>;
}
export interface ResourceState {
  open: boolean;
  sleeping: string[];
  busy: string[];
  blocked: Record<string, string>;
  snapshot: ResourceSnapshot | null;
  unavailable: boolean;
  error: string;
}
