import { create } from "zustand";
import { GameState, GameStateType } from "../../game_state/GameState";

export const useGameState = create<{ state: GameState }>(() => ({ state: { type: GameStateType.UNKNOWN } }));
overwolf.windows.getMainWindow().bus.on('game-state', state => useGameState.setState({ state }));
