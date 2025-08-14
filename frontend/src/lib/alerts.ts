import { writable, type Writable } from 'svelte/store';

export type AlertType = 'success' | 'error' | 'info';

export type AlertState = {
  visible: boolean;
  message: string | null;
  type: AlertType;
};

const initialState: AlertState = { visible: false, message: null, type: 'info' };

export const alert: Writable<AlertState> = writable(initialState);

let hideTimeout: ReturnType<typeof setTimeout> | null = null;

export function showAlert(message: string, type: AlertType = 'info', durationMs = 3000): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  alert.set({ visible: true, message, type });
  if (durationMs > 0) {
    hideTimeout = setTimeout(() => {
      clearAlert();
    }, durationMs);
  }
}

export function showSuccess(message: string, durationMs = 3000): void {
  showAlert(message, 'success', durationMs);
}

export function showError(message: string, durationMs = 4000): void {
  showAlert(message, 'error', durationMs);
}

export function clearAlert(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  alert.set(initialState);
}


