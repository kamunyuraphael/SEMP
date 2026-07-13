export interface AlertEventPayload {
  type: 'anomaly' | 'threshold' | 'info';
  message: string;
  device?: string;
  anomalyDetails?: string;
  timestamp: Date;
}

export interface ServerToClientEvents {
  alert: (payload: AlertEventPayload) => void;
}

export interface ClientToServerEvents {
  subscribeAlerts: (userId: string) => void;
  unsubscribeAlerts: (userId: string) => void;
}
