/**
 * BarcodeScanner — uses the native BarcodeDetector API (Chrome/Edge/Android).
 * Falls back to a manual input field for iOS Safari or older browsers.
 *
 * FIX: Added confirmation debounce — the same code must be detected TWICE
 * in a row before it fires, eliminating partial / corrupted reads.
 * Also validates digit count for EAN-13/EAN-8/UPC-A before accepting.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, Keyboard, RefreshCw, ZapOff, CheckCircle2 } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

const isBarcodeDetectorSupported = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window;

/**
 * Validate that a scanned code looks like a real barcode.
 * EAN-13 = exactly 13 digits
 * EAN-8  = exactly 8 digits
 * UPC-A  = exactly 12 digits
 * Code128 / Code39 / others = at least 4 characters
 */
function isLikelyValidBarcode(code: string, format?: string): boolean {
  if (!code || code.trim().length === 0) return false;
  const trimmed = code.trim();

  // For digit-only formats, enforce exact lengths
  if (/^\d+$/.test(trimmed)) {
    if (format === "ean_13" && trimmed.length !== 13) return false;
    if (format === "ean_8"  && trimmed.length !== 8)  return false;
    if (format === "upc_a"  && trimmed.length !== 12) return false;
    // Generic digit string — must be at least 6 digits
    if (trimmed.length < 6) return false;
  } else {
    // Alphanumeric (Code128, Code39, QR, etc.) — at least 4 chars
    if (trimmed.length < 4) return false;
  }
  return true;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);

  // Confirmation buffer: we require the SAME value twice before firing
  const lastSeenRef      = useRef<string>("");
  const confirmCountRef  = useRef<number>(0);
  const CONFIRM_NEEDED   = 2; // detections in a row required
  const RESCAN_DELAY_MS  = 2500; // cooldown after a successful scan

  const [mode, setMode]           = useState<"camera" | "manual">(
    isBarcodeDetectorSupported() ? "camera" : "manual"
  );
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode]   = useState("");
  const [scanning, setScanning]       = useState(false);
  const [confirmed, setConfirmed]     = useState("");   // last confirmed scan (for UI flash)
  const [cooldown, setCooldown]       = useState(false); // prevent re-fire during delay

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setScanning(false);
    setConfirmed("");
    lastSeenRef.current     = "";
    confirmCountRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a", "upc_e", "itf", "codabar"],
      });
      setScanning(true);

      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(scan);
          return;
        }

        if (!cooldown) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const { rawValue, format } = barcodes[0];
              const code = rawValue?.trim();

              if (code && isLikelyValidBarcode(code, format)) {
                if (code === lastSeenRef.current) {
                  // Same code again — increment confidence counter
                  confirmCountRef.current += 1;
                  if (confirmCountRef.current >= CONFIRM_NEEDED) {
                    // ✅ Confirmed — fire the callback
                    confirmCountRef.current = 0;
                    lastSeenRef.current = "";
                    if ("vibrate" in navigator) navigator.vibrate(120);
                    setConfirmed(code);
                    setCooldown(true);
                    onScan(code);
                    setTimeout(() => {
                      setConfirmed("");
                      setCooldown(false);
                    }, RESCAN_DELAY_MS);
                  }
                } else {
                  // Different code — reset counter, start fresh
                  lastSeenRef.current = code;
                  confirmCountRef.current = 1;
                }
              } else {
                // Partial / invalid read — reset completely
                lastSeenRef.current = "";
                confirmCountRef.current = 0;
              }
            } else {
              // Nothing detected — slowly decay the counter so a brief miss doesn't reset
              if (confirmCountRef.current > 0) confirmCountRef.current -= 0.2;
              if (confirmCountRef.current <= 0) {
                confirmCountRef.current = 0;
                lastSeenRef.current = "";
              }
            }
          } catch (_) {
            // Detection can throw on every frame — silently ignore
          }
        }

        rafRef.current = requestAnimationFrame(scan);
      };

      rafRef.current = requestAnimationFrame(scan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Could not start camera: " + msg);
      }
    }
  }, [onScan, cooldown]);

  useEffect(() => {
    if (mode === "camera" && isBarcodeDetectorSupported()) startCamera();
    return () => stopCamera();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    onScan(code);
    setManualCode("");
  }

  // Confidence ring: 0–1 based on confirmCount / CONFIRM_NEEDED
  const confidence = Math.min(confirmCountRef.current / CONFIRM_NEEDED, 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-semibold text-card-foreground">Scan Barcode</h2>
          <div className="flex items-center gap-2">
            {isBarcodeDetectorSupported() && (
              <>
                <button onClick={() => setMode("camera")}
                  className={`p-1.5 rounded-lg transition text-sm flex items-center gap-1 ${mode === "camera" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  title="Camera mode">
                  <Camera className="w-4 h-4" />
                </button>
                <button onClick={() => setMode("manual")}
                  className={`p-1.5 rounded-lg transition ${mode === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  title="Manual entry">
                  <Keyboard className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera mode */}
        {mode === "camera" && (
          <div className="relative">
            {cameraError ? (
              <div className="p-6 text-center space-y-3">
                <ZapOff className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={startCamera} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <button onClick={() => setMode("manual")} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium">
                    Type manually
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative bg-black aspect-[4/3] overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                  {/* Scanning reticle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-56 h-32">
                      {/* Dimmed overlay outside the scan zone */}
                      <div className="absolute -inset-[200px] bg-black/40" />

                      {/* Corner marks — green when confirming */}
                      {(["top-0 left-0 border-t-2 border-l-2",
                         "top-0 right-0 border-t-2 border-r-2",
                         "bottom-0 left-0 border-b-2 border-l-2",
                         "bottom-0 right-0 border-b-2 border-r-2"] as const).map((cls, i) => (
                        <div key={i} className={`absolute w-6 h-6 rounded-sm transition-colors duration-150 ${
                          confirmed ? "border-success" : confirmCountRef.current > 0 ? "border-warning" : "border-primary"
                        } ${cls}`} />
                      ))}

                      {/* Confidence progress bar at bottom of reticle */}
                      {!confirmed && scanning && (
                        <div className="absolute -bottom-3 left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-100"
                            style={{ width: `${confidence * 100}%` }}
                          />
                        </div>
                      )}

                      {/* Scan line animation when idle */}
                      {scanning && !confirmed && confirmCountRef.current === 0 && (
                        <div className="absolute left-2 right-2 h-0.5 bg-primary/60 animate-bounce" style={{ top: "50%" }} />
                      )}
                    </div>
                  </div>

                  {/* Success flash */}
                  {confirmed && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-success/90 text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="font-mono font-semibold text-sm">{confirmed}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 space-y-1">
                  <p className="text-center text-xs text-muted-foreground">
                    Hold steady — confirming before adding
                  </p>
                  {lastSeenRef.current && !confirmed && (
                    <p className="text-center text-[11px] text-primary/70 font-mono">
                      Reading: {lastSeenRef.current}…
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Manual / keyboard scanner mode */}
        {mode === "manual" && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              {isBarcodeDetectorSupported()
                ? "Type or paste a barcode number, or use a USB/Bluetooth barcode scanner."
                : "Your browser doesn't support the camera scanner. Type or paste the barcode below."}
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Scan or type barcode..."
                className="flex-1 px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const code = manualCode.trim();
                    if (code) { onScan(code); setManualCode(""); }
                  }
                }}
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
              >
                Add
              </button>
            </form>
            <p className="text-xs text-muted-foreground/70">
              💡 USB/Bluetooth scanners work automatically — they type the code and press Enter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
