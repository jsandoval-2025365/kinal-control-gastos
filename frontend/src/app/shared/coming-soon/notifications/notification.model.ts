export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  /** Texto del botón de acción opcional (ej. "Continuar sesión"). */
  actionLabel?: string;
  /** Se ejecuta al presionar el botón de acción. */
  onAction?: () => void;
  /** Si el usuario puede cerrarla manualmente con la "x". Default: true. */
  dismissible?: boolean;
  /** Si se define, la notificación se auto-cierra después de N ms. */
  autoDismissMs?: number;
}