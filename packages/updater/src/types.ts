/**
 * estelle-updater Types
 */

export interface UpdaterConfig {
  masterUrl: string;
  whitelist: string[];
}

export interface UpdateCommand {
  type: 'update';
  target: 'all' | string;  // 'all' or specific IP
  branch: string;
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

export type AgentMessage = LogMessage | ResultMessage;

export type MasterMessage = UpdateCommand;
