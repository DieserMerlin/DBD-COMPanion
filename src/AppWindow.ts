import { OWWindow } from "@overwolf/overwolf-api-ts";

// A base class for the app's foreground windows.
// Sets the modal and drag behaviors, which are shared across the desktop and in-game windows.
export class AppWindow {
  protected currWindow: OWWindow;
  protected mainWindow: OWWindow;
  protected maximized: boolean = false;
  private observer: MutationObserver | null = null;

  constructor(windowName: string) {
    this.mainWindow = new OWWindow("background");
    this.currWindow = new OWWindow(windowName);

    // Wire anything already in the DOM
    this.tryWireAll();

    // Also watch for future mounts/re-renders
    this.observer = new MutationObserver(() => this.tryWireAll());
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /** Find and wire all relevant UI elements if present (idempotent). */
  private tryWireAll() {
    this.wireButton("closeButton", "click", () => {
      this.mainWindow.close();
    });

    this.wireButton("minimizeButton", "click", () => {
      this.currWindow.minimize();
    });

    this.wireButton("maximizeButton", "click", () => {
      if (!this.maximized) {
        this.currWindow.maximize();
      } else {
        this.currWindow.restore();
      }
      this.maximized = !this.maximized;
    });

    const header = document.getElementById("header");
    if (header && !header.dataset.dragWired) {
      this.setDrag(header);
      header.dataset.dragWired = "1";
    }
  }

  /** Helper that prevents double-binding by marking the element once wired. */
  private wireButton<K extends keyof HTMLElementEventMap>(
    id: string,
    event: K,
    handler: (ev: HTMLElementEventMap[K]) => void
  ) {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el || el.dataset.wired === "1") return;

    el.addEventListener(event, handler as unknown as EventListener);
    el.dataset.wired = "1";
  }

  /** Optionally call if you tear down this UI/controller. */
  public disconnect() {
    this.observer?.disconnect();
    this.observer = null;
  }

  public async getWindowState() {
    return await this.currWindow.getWindowState();
  }

  public async setDrag(elem: HTMLElement) {
    this.currWindow.dragMove(elem);
  }
}
