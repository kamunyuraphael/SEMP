export interface AlertEventPayload {
  type: 'anomaly' | 'threshold' | 'info';
  message: string;
  device?: string; // Human-readable device name, resolved server-side for display
  deviceId?: string; // Device ObjectId, present when the alert is tied to a device — lets the client offer a "turn off" action without another round trip
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
