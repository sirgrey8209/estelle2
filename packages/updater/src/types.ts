/**
 * estelle-updater Types
 */

export interface MachineConfig {
  environmentFile: string;
}

export interface UpdaterConfig {
  masterUrl: string;
  whitelist: string[];
  machines?: Record<string, MachineConfig>;
}

export interface UpdateCommand {
  type: 'update';
  target: 'all' | string;  // 'all' or specific IP
  branch: string;
  environmentFile?: string;
}

export interface LogMessage {
  type: 'log';
  ip: string;
  message: string;
}

export interface ResultMessage {
  type: 'result';
  ip: string;
  success: boolean;
  version?: string;
  error?: string;
}

export interface WelcomeMessage {
  type: 'welcome';
  yourIp: string;  // IP as seen by master (after NAT)
}

export type AgentMessage = LogMessage | ResultMessage;

export type MasterMessage = UpdateCommand | WelcomeMessage;
