import { distance } from "fastest-levenshtein";
import { MapDirectory } from "../generated-map-directory";
import { createBus } from "../utils/window/window-bus";
import { CALLOUT_SETTINGS } from "../windows/callouts/callout-settings";
import { OCRSingleResult, PureBlackResult } from "../utils/ocr/area-ocr";

export enum GameStateType {
  MENU = 'MENU',
  MATCH = 'MATCH',
  LOADING = 'LOADING',
  UNKNOWN = 'UNKNOWN',
}

export type GameStateMap = {
  name: string;
  realm: string;
  mapFile: string;
  fullPath: string;
  credit: string;
  variants?: GameStateMap[];
}

export type GameState = {
  type: GameStateType;
  map?: GameStateMap;
}

const isEqual = (a, b) => a === b;

type RunningGameInfo = overwolf.games.RunningGameInfo;

export class GameStateGuesser {

  public readonly bus = createBus<{ gameState: GameState }>();

  constructor() {
    let inFocus = true, lastExternalActivity = Date.now();
    let polling = false;
    setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const { isInFocus } = await new Promise<RunningGameInfo>((res, rej) => {
          overwolf.games.getRunningGameInfo(res);
          setTimeout(rej, 900);
        });
        if (!inFocus && isInFocus) lastExternalActivity = Date.now();
        inFocus = isInFocus;

        if (!isInFocus) return;

        const lastUpdate = Math.max(lastExternalActivity, this.lastStateUpdate);
        if ((Date.now() - lastUpdate) > 10000 && this._state.type !== GameStateType.MATCH) this.push({ type: GameStateType.MATCH });
      } finally {
        polling = false;
      }
    }, 1000);
  }

  private lastStateUpdate = Date.now();
  private _state: GameState = { type: GameStateType.MENU };

  public get state() {
    return this._state;
  }

  publishGameStateChange(prev: GameState, next: GameState) {
    if (!isEqual(prev, next)) {
      this.bus.emit('gameState', next);
    }
  }

  push(next: GameState) {
    const prev = this._state;

    if (isEqual(prev, next)) return;
    if (prev.type !== GameStateType.MATCH) next.map = prev.map;

    this._state = next;
    this.lastStateUpdate = Date.now();
    this.publishGameStateChange(prev, next);
  }

  guessSettings(type: 'left' | 'right', res: OCRSingleResult) {
    const result = type === 'left' ?
      res.text.filter(text => ["back", "esc", "apply changes"].some(keyword => keyword.includes(text.toLowerCase()))).length >= 1 :
      res.text.filter(text => ["general", "accessibility", "beta", "online", "graphics", "audio", "controls", "input binding", "support", "match details", "general"].includes(text.toLowerCase())).length >= 6;
    if (result) this.push(this._state);
    return result;
  }

  guessLoadingScreen(blackRes?: PureBlackResult, textRes?: OCRSingleResult) {
    let result = false;
    if (blackRes?.passed) result = true;
    if (textRes?.text.some(text => text.toLowerCase().includes("connecting to other players"))) result = true;
    if (result) this.push({ type: GameStateType.LOADING });
    return result;
  }

  guessMenu(type: 'main-menu' | 'bloodpoints' | 'menu-btn', res: OCRSingleResult) {
    const getResult = () => {
      if (type === 'main-menu')
        return (res.text.filter(line => ["play", "rift pass", "quests", "store"].some(keyword => line.toLowerCase() === keyword)).length >= 2);
      else if (type === 'menu-btn')
        return (res.text.some(text => ["play", "continue", "cancel"].includes(text.toLowerCase())));
      else if (type === 'bloodpoints')
        return (res.text.filter(text => text.match(/\d{3,}/g)).length >= 3);
    }
    const result = getResult();
    if (result) this.push({ type: GameStateType.MENU });
    return result;
  }

  private _lastGuessedMap: { time: number, mapFile: string, match: number };
  guessMap(guessedName: string): GameStateMap | null {
    if (!CALLOUT_SETTINGS.getValue().autoDetect) return null;

    const matches = Object.keys(MapDirectory)
      .map(realm => MapDirectory[realm as keyof typeof MapDirectory].map(mapFile => ({ realm, mapFile, match: this.calculateMapNameMatch(mapFile, guessedName) })))
      .flat()
      .sort((a, b) => b.match - a.match);

    const [highestMatch] = matches;
    if (highestMatch.match < .92) return null; // Not a good match

    if (this._lastGuessedMap && (Date.now() - this._lastGuessedMap.time) > 3000 && highestMatch.match < this._lastGuessedMap.match) return; // Probably a worse guess after a good one
    this._lastGuessedMap = { time: Date.now(), ...highestMatch };

    const [map, ...variants] = matches
      .filter(m => m.match === highestMatch.match)
      .sort((a, b) => {
        const n = (s: string) => parseInt(s.match(/_(\d+)_(\.[a-z]+)?$/gi)?.[1] || '0');
        return n(a.mapFile) - n(b.mapFile);
      });

    const result = GameStateGuesser.makeMap(map, variants);
    this.push({ type: GameStateType.MATCH, map: result })
    return result;
  }

  public static makeMap(fromResult: { realm: string; mapFile: any; match: number; }, variants?: { realm: string; mapFile: any; match: number; }[]): GameStateMap {
    return { credit: 'hens333.com', name: fromResult.mapFile.replace(/.[a-z]+$/gi, ''), realm: fromResult.realm, mapFile: fromResult.mapFile, fullPath: `../../img/maps/${fromResult.realm}/${fromResult.mapFile}`, variants: variants?.map(v => this.makeMap(v)) };
  }

  calculateMapNameMatch(original: string, test: string) {
    const normalize = (word: string) =>
      word
        .trim()
        .toUpperCase()
        .replace(/[L|]/g, 'I')  // treat L and | like I
        .replace(/["'`´^]/g, '') // Remove extra chars
        .replace(/\.[A-Z]+$/, '') // Remove file extension
        .replace(/\s*_\d+_$/g, ""); // Remove group number

    const a = normalize(original);
    const b = normalize(test);

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1; // both empty after normalization

    const dist = distance(a, b);
    const sim = 1 - dist / maxLen;

    // Clamp to [0, 1] and return
    return Math.max(0, Math.min(1, sim));
  }
}