/**
 * Utility functions for platform detection and feature checking
 */

/**
 * Checks if the current environment is a web browser
 * @returns boolean indicating if running in a web browser
 */
export function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Checks if the current platform is iOS
 * @returns boolean indicating if running on iOS
 */
export function isIOS(): boolean {
  if (!isWeb()) return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Checks if the current platform is Android
 * @returns boolean indicating if running on Android
 */
export function isAndroid(): boolean {
  if (!isWeb()) return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Checks if audio recording is supported in the current environment
 * @returns boolean indicating if audio recording is supported
 */
export function isAudioRecordingSupported(): boolean {
  if (!isWeb()) return false;
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia !== 'undefined' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Returns an appropriate error message based on platform for unsupported features
 * @returns Error message for unsupported features
 */
export function getUnsupportedMessage(): string {
  if (!isWeb()) {
    return 'Voice input is only available in the web version of the app.';
  } else if (isIOS()) {
    return 'Voice input may not be available on some iOS devices. Please try using a desktop browser or Android device.';
  } else if (!isAudioRecordingSupported()) {
    return 'Your browser does not support audio recording. Please try Chrome or Firefox.';
  }
  return 'Your device does not support voice input.';
}
