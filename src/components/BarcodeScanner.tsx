/**
 * BarcodeScanner — uses the native BarcodeDetector API (Chrome/Edge/Android).
 * Falls back to a manual input field for iOS Safari or older browsers.
 *
 * USB/Bluetooth barcode scanners also work natively — they type the barcode
 * number very fast and press Enter, which triggers the onScan callback.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, Keyboard, RefreshCw, ZapOff } from "lucide-react";

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

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const rafRef = useRef<number>(0);
  const [mode, setMode] = useState<"camera" | "manual">(
    isBarcodeDetectorSupported() ? "camera" : "manual"
  );
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState("");

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setScanning(false);
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
      detectorRef.current = detector;
      setScanning(true);

      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code && code !== lastScanned) {
              setLastScanned(code);
              // vibrate if supported
              if ("vibrate" in navigator) navigator.vibrate(100);
              onScan(code);
              // Brief pause then allow re-scan
              setTimeout(() => setLastScanned(""), 2000);
            }
          }
        } catch (_) {
          // silent — detection on every frame will sometimes fail
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
  }, [lastScanned, onScan]);

  useEffect(() => {
    if (mode === "camera" && isBarcodeDetectorSupported()) {
      startCamera();
    }
    return () => stopCamera();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    onScan(code);
    setManualCode("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-semibold text-card-foreground">Scan Barcode</h2>
          <div className="flex items-center gap-2">
            {isBarcodeDetectorSupported() && (
              <>
                <button
                  onClick={() => setMode("camera")}
                  className={`p-1.5 rounded-lg transition text-sm flex items-center gap-1 ${mode === "camera" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  title="Camera mode"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMode("manual")}
                  className={`p-1.5 rounded-lg transition ${mode === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                  title="Manual entry"
                >
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
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Scanning reticle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-52 h-28">
                      {/* Corner marks */}
                      {["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2",
                        "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((cls, i) => (
                        <div key={i} className={`absolute w-5 h-5 border-primary rounded-sm ${cls}`} />
                      ))}
                      {/* Scan line */}
                      {scanning && (
                        <div className="absolute left-2 right-2 h-0.5 bg-primary/70 animate-bounce" style={{ top: "50%" }} />
                      )}
                    </div>
                  </div>
                  {lastScanned && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-success/90 text-white text-xs px-3 py-1.5 rounded-full font-mono">
                      ✓ {lastScanned}
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground py-3 px-4">
                  Point camera at a barcode. Works with EAN-13, Code 128, QR, and more.
                </p>
              </>
            )}
          </div>
        )}

        {/* Manual / keyboard scanner mode */}
        {mode === "manual" && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              {isBarcodeDetectorSupported()
                ? "Type or paste a barcode number, or use a USB/Bluetooth barcode scanner — it will auto-submit."
                : "Your browser doesn't support the camera scanner. Type or paste the barcode below, or use a USB/Bluetooth scanner."}
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan or type barcode..."
                className="flex-1 px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                // USB barcode scanners type very fast and press Enter
                onKeyDown={(e) => {
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
