import { GameStateMap } from "../../game_state/GameState";
import { createStorage } from "../../utils/localstorage/typed-localstorage";


export type CalloutSettings = {
  size: number;
  opacity: number;

  autoDetect: boolean;

  show: boolean;
  showHotkeys: boolean;

  browser: boolean;

  map: GameStateMap | null;
}

export const CALLOUT_SETTINGS = createStorage<CalloutSettings>('CALLOUT_SETTINGS', {
  size: .4,
  opacity: .5,

  autoDetect: true,

  show: true,
  showHotkeys: true,

  map: null,

  browser: false,
});
