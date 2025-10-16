import {
  OWGameListener,
  OWHotkeys,
  OWWindow
} from '@overwolf/overwolf-api-ts';

import { PSM } from 'tesseract.js';
import { kHotkeys, kWindowNames } from "../../consts";
import { GameState, GameStateGuesser } from '../../game_state/GameState';
import { OcrAreasResult, performOcrAreas } from '../../utils/ocr/area-ocr';
import { createBus, TypedBus } from '../../utils/window/window-bus';
import { INGAME_SETTINGS } from '../in_game/in_game-settings';

type AppMode = 'none' | '1v1' | 'scrim';

type AppEvents = {
  'game-state': GameState,
  'app-mode-switch': AppMode,
  'select-map': { realm: string, fileName: string },
  'game-info': overwolf.games.RunningGameInfo | null,
}

declare global {
  interface Window {
    bus: TypedBus<AppEvents>;
  }
}

window.bus = createBus();

class BackgroundController {
  private _gameListener: OWGameListener;
  private static _instance: BackgroundController;
  private _windows: Record<kWindowNames, OWWindow> = {} as any;

  private mode: AppMode = 'none';
  private guesser = new GameStateGuesser();

  private constructor() {
    for (const window of Object.values(kWindowNames)) this._windows[window] = new OWWindow(window);
    this.guesser.bus.on('gameState', gs => window.bus.emit('game-state', gs));
    this.startOcr();

    if (INGAME_SETTINGS.getValue().openOnStartup)
      this._windows.in_game.restore();

    this._windows.callouts.restore();
    this._windows.debug.restore();

    this.registerHotkeys();

    setInterval(() => overwolf.games.getRunningGameInfo(res => window.bus.emit('game-info', res)), 2000);
    this._gameListener = new OWGameListener({
      onGameStarted: () => {
        INGAME_SETTINGS.getValue().openOnStartup && this._windows.in_game.restore();
      },
      onGameEnded: () => {
        window.bus.emit('game-info', null);
        overwolf.windows.getMainWindow().close();
      },
    });
    this._gameListener.start();
  };

  public static instance(): BackgroundController {
    if (!BackgroundController._instance) {
      BackgroundController._instance = new BackgroundController();
    }

    return BackgroundController._instance;
  }

  registerHotkeys() {
    OWHotkeys.onHotkeyDown(kHotkeys.toggleMode1v1, () => this.setMode('1v1'));
    OWHotkeys.onHotkeyDown(kHotkeys.toggleModeScrim, () => this.setMode('scrim'));
    OWHotkeys.onHotkeyDown(kHotkeys.toggleMainWindow, () => this.toggleMainWindow());
  }

  async toggleMainWindow() {
    const inGameState = await this._windows.in_game.getWindowState();

    if (inGameState.window_state === "normal" ||
      inGameState.window_state === "maximized") {
      this._windows.in_game.minimize();
    } else {
      this._windows.in_game.restore();
    }
  }

  setMode(mode: typeof this.mode) {
    this.mode = mode === this.mode ? 'none' : mode;
    this._windows.mode_1v1[this.mode === '1v1' ? 'restore' : 'close']();
  }

  private _ocrInterval: NodeJS.Timeout;
  startOcr() {
    if (this._ocrInterval) return;
    this._ocrInterval = setInterval(async () => {
      performOcrAreas([
        { id: 'map', type: 'ocr', rect: { x: 0, y: .7, w: .5, h: .3 }, psm: PSM.SPARSE_TEXT },
        { id: 'main-menu', type: 'ocr', rect: { x: .05, y: .05, w: .3, h: .4 }, psm: PSM.SPARSE_TEXT_OSD },
        { id: 'menu-btn', type: 'ocr', rect: { x: .8, y: .85, w: .2, h: .15 }, psm: PSM.SPARSE_TEXT },
        { id: 'bloodpoints', type: 'ocr', rect: { x: .7, y: 0, w: .3, h: .15 }, psm: PSM.SPARSE_TEXT_OSD },
        { id: 'loading-screen', type: 'pure-black', rects: [{ x: 0, y: 0, w: 1, h: .02 }, { x: 0, y: .98, w: 1, h: .02 }, { x: 0, y: .02, w: .02, h: .96 }, { x: .98, y: .02, w: .02, h: .96 }], blackMax: 10, colorDeltaMax: 3, minMatchRatio: .97 },
        { id: 'loading-text', type: 'ocr', rect: { x: .25, y: .3, w: .5, h: .4 }, psm: PSM.SPARSE_TEXT },
        { id: 'settings', type: 'ocr', rect: { x: 0, y: 0, w: 1, h: .2 }, psm: PSM.SPARSE_TEXT },
      ]).then(res => this.evaluateRes(res));
    }, 1000);
  }

  evaluateRes(res: OcrAreasResult) {
    const makeReturn = (key: string) => {
      const debug = { type: key, res: res[key] };
      console.log(debug);
      return debug;
    };

    res['settings-back-btn'] = res['map'];

    if (res['map'] && res['map'].type === 'ocr') {
      if (res['map'].text.some(guess => this.guesser.guessMap(guess)))
        return makeReturn('map');
    }
    if (res['settings'] && res['settings'].type === 'ocr')
      if (this.guesser.guessSettings('right', res['settings']))
        return makeReturn('settings');
    if (res['loading-screen'] && res['loading-screen'].type === 'pure-black') {
      if (this.guesser.guessLoadingScreen(res['loading-screen']))
        return makeReturn('loading-screen');
    }
    if (res['loading-text'] && res['loading-text'].type === 'ocr') {
      if (this.guesser.guessLoadingScreen(undefined, res['loading-text']))
        return makeReturn('loading-text');
    }
    if (res['main-menu'] && res['main-menu'].type === 'ocr') {
      if (this.guesser.guessMenu('main-menu', res['main-menu']))
        return makeReturn('main-menu');
    }
    if (res['menu-btn'] && res['menu-btn'].type === 'ocr') {
      if (this.guesser.guessMenu('menu-btn', res['menu-btn']))
        return makeReturn('menu-btn');
    }
    if (res['bloodpoints'] && res['bloodpoints'].type === 'ocr') {
      if (this.guesser.guessMenu('bloodpoints', res['bloodpoints']))
        return makeReturn('bloodpoints');
    }
    if (res['settings-back-btn'] && res['settings-back-btn'].type === 'ocr')
      if (this.guesser.guessSettings('left', res['settings-back-btn']))
        return makeReturn('settings-back-btn');

    return null;
  }
}

BackgroundController.instance();
