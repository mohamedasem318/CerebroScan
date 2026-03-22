import { useState, useCallback, useEffect } from "react";
import { API_BASE } from "@/config";
import {
  Upload,
  FileImage,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScanStatus = "idle" | "ready" | "scanning" | "complete";
type ResultConfidence = "certain" | "uncertain" | null;

interface ScanResult {
  stage: string;
  confidence: number; // UI expects percentage (0-100)
  description: string;
  confidenceLevel: ResultConfidence;
  allPredictions?: { stage: string; confidence: number }[];
  mostLikely?: { stage: string; confidence: number }; // <--- ADD THIS
}


type ApiModel = {
  id: string;
  name: string;
  // backend may not provide these; keep optional to avoid UI/layout changes
  architecture?: string;
};

// Confidence thresholds per model (0..1). Edit anytime.
const MODEL_THRESHOLDS: Record<string, number> = {
  atlas: 0.75,
  orion: 0.8,
  pulse: 0.85,
};

const DEFAULT_THRESHOLD = 0.95;

function subtitleForLabel(label: string): string {
  const key = (label || "").toLowerCase();

  if (
  key.includes("normal") ||
  key.includes("healthy") ||
  key.includes("non")
) {
  return "No significant signs of cognitive impairment detected.";
}


  if (key.includes("very mild")) {
    return "Early signs of cognitive decline detected. Further evaluation recommended.";
  }

  if (key.includes("mild")) {
    return "Changes consistent with mild cognitive impairment. Consider follow-up assessment.";
  }

  if (key.includes("moderate")) {
    return "Significant neurological changes consistent with moderate-stage Alzheimer’s disease.";
  }

  if (key.includes("uncertain") || key.includes("unsure")) {
    return "Low confidence — consult a professional.";
  }

  return "Result generated. Consider clinical context and professional review.";
}

function isWarningLabel(label: string): boolean {
  const key = (label || "").toLowerCase();

  // keep your tags exactly how you want them
  if (key.includes("normal") || key.includes("healthy") || key.includes("non")) {
    return false;
  }
  return true;
}



export function ScanSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAllPredictions, setShowAllPredictions] = useState(false);

  // Real models from backend
  const [models, setModels] = useState<ApiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const res = await fetch(`${API_BASE}/api/models`);
        if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
        const data = await res.json();

        if (cancelled) return;

        // data.models expected: [{id, name, ...}]
       const fetchedModels = Array.isArray(data.models) ? data.models : [];
setModels(fetchedModels);

// Prefer Orion if present, else backend default, else first
const orionId = fetchedModels.find((m: any) => m.id === "orion")?.id;

setSelectedModelId(
  orionId || data.default_model_id || (fetchedModels[0]?.id ?? "")
);

      } catch (err) {
        console.error("Failed to load models", err);
      }
    }

    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus("ready");
    setResult(null);
    setShowAllPredictions(false);
  }, []);

useEffect(() => {
  function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) {
          handleFile(f);
          e.preventDefault();
        }
        break;
      }
    }
  }

  window.addEventListener("paste", onPaste);
  return () => window.removeEventListener("paste", onPaste);
}, [handleFile]);


  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const runScan = useCallback(() => {
    if (!file) return;

    setStatus("scanning");
    // You only want label+confidence, so we keep this UI feature off:
    setShowAllPredictions(false);

    (async () => {
      try {
        if (!selectedModelId) {
          console.error("No model selected");
          return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("model_id", selectedModelId);

        const res = await fetch(`${API_BASE}/api/classify`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Classification failed (${res.status})`);
        const data = await res.json();

// --- use backend's "probabilities" list (sorted high -> low) ---
const probs = Array.isArray(data?.probabilities) ? data.probabilities : [];

const sorted = [...probs].sort((a: any, b: any) => (b.prob ?? 0) - (a.prob ?? 0));
const top = sorted[0];
const nextBest = sorted.length > 1 ? sorted[1] : null;


const backendLabel = data?.prediction?.label ?? "Unknown";
const backendConfidenceRaw = data?.prediction?.confidence ?? 0;
const confidencePct = Math.round(backendConfidenceRaw * 100);

// most likely actual class (top probability)
const mostLikely = top
  ? { stage: top.label, confidence: Math.round((top.prob ?? 0) * 100) }
  : undefined;





        // Preserve the existing "certain/uncertain" styling logic
       



const threshold = MODEL_THRESHOLDS[selectedModelId] ?? DEFAULT_THRESHOLD;

// true “uncertain” is either explicit OR below threshold
const isUncertain =
  backendLabel.toLowerCase() === "uncertain" ||
  backendConfidenceRaw < threshold;


setResult({
  stage: isUncertain ? "Uncertain" : (mostLikely?.stage ?? backendLabel),
  confidence: confidencePct,
  description: isUncertain
    ? subtitleForLabel("uncertain")
    : subtitleForLabel(mostLikely?.stage ?? backendLabel),
  confidenceLevel: isUncertain ? "uncertain" : "certain",
  mostLikely, // ✅ store best class for later
  allPredictions: sorted.map((p: any) => ({
    stage: p.label,
    confidence: Math.round((p.prob ?? 0) * 100),
  })),
});







        // Hide the "Show most likely result" button by making it think it's already expanded
        // (but since allPredictions is undefined, nothing extra renders).

        setStatus("complete");
      } catch (err) {
        console.error("Classification failed", err);
        setStatus("idle");
      }
    })();
  }, [file, selectedModelId]);

  const newScan = useCallback(() => {
    setFile(null);
    setPreview(null);
    setStatus("idle");
    setResult(null);
    setShowAllPredictions(false);
  }, []);

  const getStatusDisplay = () => {
    switch (status) {
      case "idle":
        return { text: "Upload an image to begin", icon: <Upload className="w-5 h-5" /> };
      case "ready":
        return { text: "Ready for scan", icon: <FileImage className="w-5 h-5" /> };
      case "scanning":
        return { text: "Analyzing MRI...", icon: <Loader2 className="w-5 h-5 animate-spin" /> };
      case "complete":
        return result?.confidenceLevel === "certain"
          ? { text: "Analysis Complete", icon: <CheckCircle2 className="w-5 h-5 text-success" /> }
          : { text: "Analysis Complete (Uncertain)", icon: <AlertTriangle className="w-5 h-5 text-warning" /> };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Upload Card */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 text-muted-foreground">
                {statusDisplay.icon}
                <span className={`font-medium ${status === "scanning" ? "scan-pulse" : ""}`}>
                  {statusDisplay.text}
                </span>
              </div>

              {/* Model Selector (VISUALS UNCHANGED) */}
              <Select
                value={selectedModelId}
                onValueChange={setSelectedModelId}
                disabled={status === "scanning"}
              >
                <SelectTrigger className="w-[200px] bg-background">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <span className="font-medium">{model.name}</span>
                      {model.architecture ? (
                        <span className="text-muted-foreground ml-2">– {model.architecture}</span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              {status === "ready" && (
                <Button onClick={runScan} variant="glow">
                  Run Scan
                </Button>
              )}
              {status === "scanning" && (
                <Button disabled variant="secondary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </Button>
              )}
              {status === "complete" && (
                <Button onClick={newScan} variant="outline">
                  New Scan
                </Button>
              )}
            </div>
          </div>

          {/* Drop Zone */}
          {!preview && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById("fileInput")?.click()}
              className={`upload-zone ${isDragging ? "dragover" : ""}`}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground font-medium mb-2">
                Drag & drop or paste (Ctrl+V) an MRI image
              </p>
              <p className="text-sm text-muted-foreground">
                Supports JPG, PNG • Brain-only slices recommended
              </p>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden bg-muted aspect-video max-w-md mx-auto">
                <img
                  src={preview}
                  alt="MRI Preview"
                  className="w-full h-full object-contain"
                />
                {status !== "scanning" && status !== "complete" && (
                  <button
                    onClick={newScan}
                    className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur text-foreground hover:bg-background transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {status === "scanning" && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <span className="text-sm font-medium text-foreground">Analyzing...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results Card */}
        {result && status === "complete" && (
          <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
  isWarningLabel(result.stage)
    ? "bg-warning/10"
    : "bg-success/10"
}`}>

                {isWarningLabel(result.stage)
  ? <AlertTriangle className="w-6 h-6 text-warning" />
  : <CheckCircle2 className="w-6 h-6 text-success" />
}

              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-foreground">{result.stage}</h3>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
  isWarningLabel(result.stage)
    ? "bg-warning/10 text-warning"
    : "bg-success/10 text-success"
}`}>

                    {result.confidence.toFixed(1)}% confidence
                  </span>
                </div>
                <p className="text-muted-foreground mb-4">{result.description}</p>

                {/* Show most likely button - only for uncertain results */}
                {result.confidenceLevel === "uncertain" && !showAllPredictions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllPredictions(true)}
                  >
                    <HelpCircle className="w-4 h-4" />
                    Show most likely result
                  </Button>
                )}

                {/* All predictions */}
                {showAllPredictions && result.allPredictions && (
  <div className="mt-4 p-4 rounded-xl bg-muted/50 space-y-2 animate-scale-in">
    <h4 className="text-sm font-semibold text-foreground mb-3">All Predictions:</h4>

    {/* show “most likely” when top is Uncertain */}
    {result.stage.toLowerCase() === "uncertain" && result.mostLikely && (
      <div className="text-sm text-muted-foreground mb-2">
        Most likely: <span className="text-foreground font-medium">{result.mostLikely.stage}</span>{" "}
        ({result.mostLikely.confidence}%)
      </div>
    )}

    {result.allPredictions.map((pred, i) => (

                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-foreground">{pred.stage}</span>
                            <span className="text-xs text-muted-foreground">{pred.confidence.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${pred.confidence}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Examples Card */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-foreground mb-6">Examples</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Supported Example */}
            <div className="space-y-3">
              <div className="success-badge">
                <CheckCircle2 className="w-4 h-4" />
                Supported Example
              </div>
              <p className="text-sm text-muted-foreground">
                Brain-only MRI slice (no skull visible). These images produce the most accurate results.
              </p>
              <div className="rounded-xl overflow-hidden border-2 border-success/30 bg-success/5">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <img
  src="/static/assets/brain/unsupportedexample.jpg"
  alt="Supported example (brain-only)"
  className="w-full h-full object-cover"
/>

                </div>
              </div>
            </div>

            {/* Unsupported Example */}
            <div className="space-y-3">
              <div className="warning-badge">
                <AlertTriangle className="w-4 h-4" />
                Unsupported Example
              </div>
              <p className="text-sm text-muted-foreground">
                Skull visible — please upload a brain-only slice for accurate classification.
              </p>
              <div className="rounded-xl overflow-hidden border-2 border-warning/50 bg-warning/5 relative">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <img
  src="/static/assets/brain/supportedexample.jpg"
  alt="Unsupported example (skull visible)"
  className="w-full h-full object-cover"
/>

                </div>
                {/* Warning overlay stripe */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--warning) / 0.1) 10px, hsl(var(--warning) / 0.1) 20px)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
