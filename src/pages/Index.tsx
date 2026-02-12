import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bone, Download } from "lucide-react";
import ScanUpload from "@/components/ScanUpload";
import AnalysisResult from "@/components/AnalysisResult";
import { generateReport } from "@/lib/generateReport";
import type { ScanAnalysis } from "@/types/scan";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanAnalysis | null>(null);
  const { toast } = useToast();

  const handleImageSelected = useCallback((selectedFile: File, previewUrl: string) => {
    setFile(selectedFile);
    setPreview(previewUrl);
    setResult(null);
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file || !preview) return;
    setIsAnalyzing(true);

    try {
      // Extract base64 from data URL
      const base64 = preview.split(",")[1];
      const mimeType = file.type || "image/png";

      const { data, error } = await supabase.functions.invoke("analyze-scan", {
        body: { imageBase64: base64, mimeType },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data as ScanAnalysis);
    } catch (err: any) {
      console.error("Analysis failed:", err);
      toast({
        title: "Analysis Failed",
        description: err.message || "Could not analyze the scan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, preview, toast]);

  const handleDownloadPDF = useCallback(() => {
    if (!result) return;
    generateReport(result, preview || undefined);
  }, [result, preview]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bone className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">BoneScan</span>
          </div>
          {result && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Upload */}
        <ScanUpload
          onImageSelected={handleImageSelected}
          preview={preview}
          onClear={handleClear}
          isAnalyzing={isAnalyzing}
        />

        {/* Analyze Button */}
        {preview && !result && !isAnalyzing && (
          <button
            onClick={handleAnalyze}
            className="w-full py-3.5 rounded-2xl font-display font-semibold text-primary-foreground transition-all animate-pulse-glow"
            style={{ background: "var(--gradient-primary)" }}
          >
            Analyze Scan
          </button>
        )}

        {/* Results */}
        {result && <AnalysisResult result={result} />}

        {/* Empty State */}
        {!preview && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
              Upload an X-Ray scan to get instant AI-powered fracture detection, severity assessment, and specialist recommendations.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
