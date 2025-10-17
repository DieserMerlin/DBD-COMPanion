import { createStorage } from "../../utils/localstorage/typed-localstorage";

export type AppMode = 'none' | '1v1' | 'scrim';


export type BackgroundSettings = {
  mode: AppMode;
  calloutOverlay: boolean;
}

export const BACKGROUND_SETTINGS = createStorage<BackgroundSettings>('BACKGROUND_SETTINGS', {
  mode: 'none',
  calloutOverlay: false
});