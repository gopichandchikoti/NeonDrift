import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Leaves the app. Only meaningful in the Android app: a web page cannot close itself, so it does nothing there. */
export function exitApp(): void {
  if (isNative()) void App.exitApp();
}
