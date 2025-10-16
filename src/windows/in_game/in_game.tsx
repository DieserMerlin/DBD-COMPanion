
import { createRoot } from 'react-dom/client';
import { AppWindow } from "../../AppWindow";
import { kWindowNames } from "../../consts";
import { IngameApp } from "./IngameApp";

class InGame extends AppWindow {
  private static _instance: InGame;

  private constructor() {
    super(kWindowNames.inGame);
  }


  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }

    return this._instance;
  }
}

InGame.instance();

const root = createRoot(document.getElementById('root')!);
root.render(<IngameApp />);
