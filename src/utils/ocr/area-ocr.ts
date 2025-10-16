import { createWorker, PSM, Worker } from "tesseract.js";

const STATIC_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_/() .,";
export const CANVAS = document.createElement("canvas");

// --- defaults you can tweak ---
const DEFAULT_LUM_MIN = 120;         // your old THRESHOLD
const DEFAULT_CHROMA_MAX = 18;       // "how gray" a pixel must be (0..255). 10–25 works well.
const MID_GRAY_LUM_MIN = 150;        // optional: keep darker gray letters if very gray
const MID_GRAY_CHROMA_MAX = 10;      // must be even more neutral to pass this lower luminance gate

// --- NEW defaults for the edge-uniform detector ---
const DEFAULT_BLACK_MAX = 12;          // per-channel max for a "black" pixel (inclusive)
const DEFAULT_SAMPLE_STRIDE = 2;       // 1 = check every pixel
const DEFAULT_MIN_MATCH_RATIO = 0.98;  // how much must match to pass (0..1)
const DEFAULT_COLOR_DELTA_MAX = 8;     // tolerance for "same color" (per-channel, 0..255)

// ---------- Worker (singleton) ----------
let _workerPromise: Promise<Worker> | null = null;
async function getWorker(): Promise<Worker> {
  if (!_workerPromise) {
    _workerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_WORD,
        preserve_interword_spaces: "1",
        tessedit_char_whitelist: STATIC_WHITELIST,
      });
      return worker;
    })();
  }
  return _workerPromise;
}

// ---------- Public API ----------
/**
 * A normalized rectangle: values are 0..1 relative to the full screenshot.
 * Example: bottom-left quarter => { x: 0, y: 0.5, width: 0.5, height: 0.5 }
 */
export type NormalizedRect = {
  x: number;      // 0..1 from left
  y: number;      // 0..1 from top
  w: number;  // 0..1
  h: number; // 0..1
};

export type ScanArea = {
  id: string;
  rect: NormalizedRect;
  threshold?: number;        // deprecated alias for lumMin
  psm?: PSM;
  whitelist?: string;
  lumMin?: number;           // new: primary luminance cut (0..255)
  chromaMax?: number;        // new: max allowed chroma (0..255)
};

/** ---- NEW: Discriminated area types (backward compatible) ---- */
export type OcrScanArea = ScanArea & { type?: "ocr" }; // default if type omitted

/**
 * Upgraded "pure-black" spec: still called "pure-black" for drop-in,
 * but now supports percentage pass + low-variance uniform color mode.
 */
export type PureBlackScanArea = {
  id: string;
  type: "pure-black";
  rects: NormalizedRect[];     // strips to test (edges)
  blackMax?: number;           // <= this per channel counts as "black"
  sampleStride?: number;       // pixel step for speed
  minMatchRatio?: number;      // 0..1, fraction of sampled pixels that must match
  /**
   * Pixels within `colorDeltaMax` of the dominant color ALSO count as matches,
   * even if they are not black (handles dark-but-uniform overlays/borders).
   */
  colorDeltaMax?: number;      // per-channel tolerance for "same color"
};

export type AnyScanArea = OcrScanArea | PureBlackScanArea;

/** ---- Results ---- */
export type OCRSingleResult = { type: "ocr"; text: string[]; confidence: number };
export type PureBlackResult = {
  type: "pure-black";
  passed: boolean;         // overall pass/fail considering percentage
  ratio: number;           // matched / tested
  tested: number;          // sampled pixels
  matched: number;         // pixels that matched (black OR uniform color)
  dominant?: { r: number; g: number; b: number }; // estimated dominant color
  firstFail?: { x: number; y: number; r: number; g: number; b: number; a: number }; // first non-matching (optional)
};

export type OcrAreasResult = Record<string, OCRSingleResult | PureBlackResult>;

/**
 * Captures a screenshot (while the game is focused) and OCRs multiple areas.
 * Returns an object keyed by area.id with the lines it found.
 */
// --- performOcrAreas(...) stays the same signature ---
export async function performOcrAreas(areas: AnyScanArea[]): Promise<OcrAreasResult | null> {
  // 0) Ensure there's a running, focused game. If not, abort to avoid desktop screenshots.
  const gi = await new Promise<overwolf.games.GetRunningGameInfoResult>((resolve) =>
    overwolf.games.getRunningGameInfo(resolve)
  );
  if (!gi || !gi.success || !gi.isRunning || !gi.isInFocus) {
    return null;
  }

  // 1) Take screenshot (now guaranteed while game is focused)
  const shot = await new Promise<overwolf.media.FileResult>((resolve) =>
    overwolf.media.takeScreenshot(resolve)
  );
  if (!shot.success || !shot.url || !shot.path) return null;

  // 2) Read bytes via Overwolf IO
  const bin = await new Promise<overwolf.io.ReadBinaryFileResult>((resolve) =>
    overwolf.io.readBinaryFile(shot.path, {} as any, resolve)
  );
  if (!bin.success || !bin.content) {
    await safeDelete(shot.path);
    return null;
  }

  // 3) Create a Blob URL and load image
  const u8 = new Uint8Array(bin.content as unknown as number[]);
  const blob = new Blob([u8], { type: "image/png" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const needOcr = areas.some(a => (a as OcrScanArea).type === "ocr" || (a as OcrScanArea).type === undefined);
    const worker = needOcr ? await getWorker() : null;

    const results: OcrAreasResult = {};

    for (const area of areas) {
      // ---------- NEW: upgraded PURE-BLACK / UNIFORM detector ----------
      if ((area as PureBlackScanArea).type === "pure-black") {
        const {
          id,
          rects: rects,
          blackMax = DEFAULT_BLACK_MAX,
          sampleStride = DEFAULT_SAMPLE_STRIDE,
          minMatchRatio = DEFAULT_MIN_MATCH_RATIO,
          colorDeltaMax = DEFAULT_COLOR_DELTA_MAX,
        } = area as PureBlackScanArea;

        let tested = 0;
        let matched = 0;
        let firstFail: PureBlackResult["firstFail"] | undefined;
        // Running estimate of dominant color via incremental mean (robust and cheap)
        let meanR = 0, meanG = 0, meanB = 0;
        let seen = 0;

        for (const rect of rects) {
          const { sx, sy, sw, sh } = normalizedToPixels(rect, img.width, img.height);

          CANVAS.width = sw;
          CANVAS.height = sh;
          const ctx = CANVAS.getContext("2d", { willReadFrequently: true })!;
          ctx.clearRect(0, 0, sw, sh);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

          const data = ctx.getImageData(0, 0, sw, sh);
          const { width, height, data: px } = data;

          // Two-pass in one loop:
          // 1) Update dominant color online.
          // 2) Count matches: black OR within delta of current dominant.
          for (let y = 0; y < height; y += sampleStride) {
            const baseY = y * width * 4;
            for (let x = 0; x < width; x += sampleStride) {
              const i = baseY + x * 4;
              const r = px[i + 0], g = px[i + 1], b = px[i + 2], a = px[i + 3];
              tested++;

              // Online mean update (Kahan not needed here)
              seen++;
              meanR += (r - meanR) / seen;
              meanG += (g - meanG) / seen;
              meanB += (b - meanB) / seen;

              const isBlack =
                r <= blackMax && g <= blackMax && b <= blackMax;

              // Compare to *current* dominant color estimate
              const dr = Math.abs(r - meanR);
              const dg = Math.abs(g - meanG);
              const db = Math.abs(b - meanB);
              const isUniform =
                dr <= colorDeltaMax && dg <= colorDeltaMax && db <= colorDeltaMax;

              if (isBlack || isUniform) {
                matched++;
              } else if (!firstFail) {
                firstFail = { x: clamp(sx + x, 0, img.width - 1), y: clamp(sy + y, 0, img.height - 1), r, g, b, a };
              }
            }
          }

          // Early stop across rects if even perfect remaining can’t reach minMatchRatio
          const remainingWorstCaseMatched = matched + (tested === 0 ? 0 : 0); // (info only)
          // We can compute theoretical max achievable ratio; cheap bound:
          // If current ratio already < minMatchRatio and even counting all remaining as matches
          // can't recover, then break. (We don't know remaining samples count yet without scanning.)
          // For simplicity and stability, we skip an aggressive early stop here to avoid undercounting.
        }

        const ratio = tested > 0 ? matched / tested : 0;
        const passed = ratio >= minMatchRatio;

        results[id] = {
          type: "pure-black",
          passed,
          ratio,
          tested,
          matched,
          dominant: {
            r: Math.round(meanR),
            g: Math.round(meanG),
            b: Math.round(meanB),
          },
          ...(firstFail ? { firstFail } : {}),
        };
        continue;
      }

      // ---------- OCR branch (unchanged) ----------
      const {
        id,
        rect,
        lumMin = (area as OcrScanArea).threshold ?? DEFAULT_LUM_MIN,
        chromaMax = DEFAULT_CHROMA_MAX,
        psm = PSM.SPARSE_TEXT_OSD,
        whitelist = STATIC_WHITELIST,
      } = area as OcrScanArea;

      const { sx, sy, sw, sh } = normalizedToPixels(rect, img.width, img.height);

      CANVAS.width = sw;
      CANVAS.height = sh;
      const ctx = CANVAS.getContext("2d", { willReadFrequently: true })!;
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const imgData = ctx.getImageData(0, 0, sw, sh);
      binarizeGrayOnlyInPlace(imgData, { lumMin, chromaMax });
      ctx.putImageData(imgData, 0, 0);

      if (worker) {
        await worker.setParameters({
          tessedit_pageseg_mode: psm,
          tessedit_char_whitelist: whitelist,
          preserve_interword_spaces: "1",
        });
      }

      const { data: ocr } = worker
        ? await worker.recognize(CANVAS.toDataURL("image/png"))
        : { data: { text: "", confidence: 0 } as any };

      const text = (ocr.text || "").trim();
      results[id] = { type: "ocr", text: text ? splitLines(text) : [], confidence: ocr.confidence };
    }

    return results;
  } finally {
    URL.revokeObjectURL(url);
    await safeDelete(shot.path);
  }
}

// ----- helpers (unchanged + NEW) -----

function normalizedToPixels(rect: NormalizedRect, imgW: number, imgH: number) {
  const sx = clamp(Math.round(rect.x * imgW), 0, imgW - 1);
  const sy = clamp(Math.round(rect.y * imgH), 0, imgH - 1);
  const sw = clamp(Math.round(rect.w * imgW), 1, imgW - sx);
  const sh = clamp(Math.round(rect.h * imgH), 1, imgH - sy);
  return { sx, sy, sw, sh };
}

// ---------- Image utils ----------
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img as HTMLImageElement);
    img.onerror = reject;
    img.src = url;
  });
}

function binarizeGrayOnlyInPlace(
  data: ImageData,
  opts: { lumMin: number; chromaMax: number }
) {
  const { lumMin, chromaMax } = opts;
  const px = data.data;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i + 0], g = px[i + 1], b = px[i + 2];

    // --- chroma (how far from gray) ---
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const chroma = maxc - minc; // 0 = perfect gray, higher = more color

    // default white background
    px[i + 0] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;

    if (chroma <= chromaMax) {
      // --- luminance (perceived brightness) ---
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Main gate: bright, near-gray -> black text
      if (lum >= lumMin) {
        px[i + 0] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 255;
        continue;
      }

      // Optional catch: very neutral mid-gray (for smaller UI labels)
      if (chroma <= MID_GRAY_CHROMA_MAX && lum >= MID_GRAY_LUM_MIN) {
        px[i + 0] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 255;
      }
    }
  }
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function safeDelete(path?: string) {
  if (!path) return;
  try {
    await new Promise<object>((resolve) =>
      // @ts-expect-error Overwolf types
      overwolf.extensions.io.delete("pictures", path, resolve)
    );
  } catch {
    /* ignore cleanup errors */
  }
}
