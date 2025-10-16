import { createStorage } from "../../utils/localstorage/typed-localstorage";

type IngameSettings = {
  openOnStartup: boolean;
};

export const INGAME_SETTINGS = createStorage<IngameSettings>('INGAME_SETTINGS', {
  openOnStartup: true
});
