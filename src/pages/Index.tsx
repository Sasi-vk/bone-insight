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
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        {/* Floating medical orbs */}
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-primary/[0.04] blur-3xl animate-float-slow" />
        <div className="absolute bottom-[15%] right-[8%] w-96 h-96 rounded-full bg-accent/[0.05] blur-3xl animate-float-medium" />
        <div className="absolute top-[50%] left-[60%] w-52 h-52 rounded-full bg-primary/[0.03] blur-2xl animate-float-fast" />
        <div className="absolute top-[25%] right-[20%] w-40 h-40 rounded-full bg-accent/[0.04] blur-2xl animate-float-reverse" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Pulse rings */}
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 -translate-y-1/2">
          <div className="w-[600px] h-[600px] rounded-full border border-primary/[0.06] animate-pulse-ring" />
          <div className="absolute inset-8 rounded-full border border-primary/[0.04] animate-pulse-ring-delay" />
          <div className="absolute inset-16 rounded-full border border-primary/[0.03] animate-pulse-ring-delay-2" />
        </div>
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/60 backdrop-blur-2xl">
        <div className="w-full flex items-center justify-between px-6 lg:px-10 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
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
              className="gap-2 rounded-xl shadow-lg shadow-primary/10"
            >
              <Download className="w-3.5 h-3.5" />
              Download Report
            </Button>
          )}
        </div>
      </header>

      <main className="w-full px-6 lg:px-10 py-8">
        <div className={`grid gap-8 ${result ? "grid-cols-1 lg:grid-cols-2 items-start" : "grid-cols-1 max-w-2xl mx-auto"}`}>
          {/* Upload + Button */}
          <div className="space-y-5">
            <ScanUpload
              onImageSelected={handleImageSelected}
              preview={preview}
              onClear={handleClear}
              isAnalyzing={isAnalyzing}
            />

            {preview && !result && !isAnalyzing && (
              <Button
                onClick={handleAnalyze}
                className="w-full h-13 text-base font-display font-semibold rounded-xl gap-2 shadow-lg shadow-primary/20"
                size="lg"
              >
                <Activity className="w-4 h-4" />
                Analyze Scan
              </Button>
            )}

            {!preview && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <FeatureChip icon={<Activity className="w-4 h-4" />} text="Fracture Detection" />
                <FeatureChip icon={<FileText className="w-4 h-4" />} text="Instant Reports" />
                <FeatureChip icon={<Shield className="w-4 h-4" />} text="HIPAA Mindful" />
              </div>
            )}
          </div>

          {/* Results */}
          {result && (
            <div>
              <AnalysisResult result={result} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const FeatureChip = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex flex-col items-center gap-3 py-4 px-3 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 text-center hover:bg-card/80 hover:border-primary/20 transition-all duration-300 group">
    <div className="text-primary group-hover:scale-110 transition-transform duration-300">{icon}</div>
    <span className="text-xs font-medium text-muted-foreground leading-tight">{text}</span>
  </div>
);

export default Index;
