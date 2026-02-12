import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Download, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      const base64 = preview.split(",")[1];
      const { data, error } = await supabase.functions.invoke("analyze-scan", {
        body: { imageBase64: base64, mimeType: file.type || "image/png" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data as ScanAnalysis);
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message || "Please try again.", variant: "destructive" });
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
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-5 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base text-foreground leading-none">BoneScan AI</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Medical Scan Analysis</p>
            </div>
          </div>
          {result && (
            <Button
              onClick={handleDownloadPDF}
              size="sm"
              className="gap-2 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              Download Report
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Upload + Button */}
          <div className={`space-y-4 ${result ? "lg:col-span-2" : "lg:col-span-5 max-w-xl mx-auto w-full"}`}>
            <ScanUpload
              onImageSelected={handleImageSelected}
              preview={preview}
              onClear={handleClear}
              isAnalyzing={isAnalyzing}
            />

            {preview && !result && !isAnalyzing && (
              <Button
                onClick={handleAnalyze}
                className="w-full h-12 text-base font-display font-semibold rounded-xl gap-2"
                size="lg"
              >
                <Activity className="w-4 h-4" />
                Analyze Scan
              </Button>
            )}

            {!preview && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <FeatureChip icon={<Activity className="w-3.5 h-3.5" />} text="Fracture Detection" />
                <FeatureChip icon={<FileText className="w-3.5 h-3.5" />} text="Instant Reports" />
                <FeatureChip icon={<Shield className="w-3.5 h-3.5" />} text="HIPAA Mindful" />
              </div>
            )}
          </div>

          {/* Right: Results */}
          {result && (
            <div className="lg:col-span-3">
              <AnalysisResult result={result} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const FeatureChip = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl bg-card border border-border text-center">
    <div className="text-primary">{icon}</div>
    <span className="text-[11px] font-medium text-muted-foreground leading-tight">{text}</span>
  </div>
);

export default Index;
