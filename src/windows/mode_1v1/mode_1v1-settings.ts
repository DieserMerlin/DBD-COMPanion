import { createStorage } from "../../utils/localstorage/typed-localstorage";

export type Mode1v1Settings = {
  startKllrOnSwing: boolean;
  startSurvOnCrouch: boolean;
  stopOnEmote: boolean;

  showMs: boolean;
  showHotkeys: boolean;

  customCss: string;

  selected: 'killer' | 'survivor';
}

export const MODE_1V1_SETTINGS = createStorage<Mode1v1Settings>('MODE_1V1_SETTINGS', {
  startKllrOnSwing: true,
  startSurvOnCrouch: true,
  stopOnEmote: true,

  showMs: true,
  showHotkeys: true,

  customCss: '',

  selected: 'survivor',
});
