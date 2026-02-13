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
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        {/* Floating medical orbs */}
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-primary/15 blur-3xl animate-float-slow" />
        <div className="absolute bottom-[15%] right-[8%] w-96 h-96 rounded-full bg-accent/20 blur-3xl animate-float-medium" />
        <div className="absolute top-[50%] left-[60%] w-52 h-52 rounded-full bg-primary/10 blur-2xl animate-float-fast" />
        <div className="absolute top-[25%] right-[20%] w-40 h-40 rounded-full bg-accent/15 blur-2xl animate-float-reverse" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Pulse rings */}
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 -translate-y-1/2">
          <div className="w-[600px] h-[600px] rounded-full border-2 border-primary/10 animate-pulse-ring" />
          <div className="absolute inset-8 rounded-full border border-primary/[0.07] animate-pulse-ring-delay" />
          <div className="absolute inset-16 rounded-full border border-primary/[0.05] animate-pulse-ring-delay-2" />
        </div>

        {/* ECG / Heartbeat line */}
        <svg className="absolute bottom-[12%] left-0 w-full h-24 opacity-[0.08]" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path
            className="animate-ecg-line"
            d="M0,50 L200,50 L220,50 L230,20 L240,80 L250,10 L260,90 L270,50 L290,50 L500,50 L520,50 L530,20 L540,80 L550,10 L560,90 L570,50 L590,50 L800,50 L820,50 L830,20 L840,80 L850,10 L860,90 L870,50 L890,50 L1200,50"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        </svg>

        {/* Floating medical icons */}
        <svg className="absolute top-[15%] right-[10%] w-16 h-16 text-primary/[0.07] animate-float-slow" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-1 10h-4v4h-4v-4H6v-4h4V5h4v4h4v4z" />
        </svg>
        <svg className="absolute bottom-[25%] left-[8%] w-12 h-12 text-accent/[0.08] animate-float-medium" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4.8 2.3A.3.3 0 105 2h0a2 2 0 012 2v.5a.5.5 0 00.5.5h1a.5.5 0 00.5-.5V4a2 2 0 012-2h0a.3.3 0 10.2.3 6 6 0 01-6 0zM12 12l-2.5 2.5M12 12l2.5 2.5M12 12V7" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        <svg className="absolute top-[60%] right-[30%] w-10 h-10 text-primary/[0.06] animate-float-fast" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>

        {/* Heartbeat icon pulsing */}
        <div className="absolute top-[70%] left-[75%] animate-heartbeat">
          <svg className="w-14 h-14 text-destructive/10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="absolute top-[20%] left-[40%] animate-heartbeat-delay">
          <svg className="w-8 h-8 text-destructive/[0.06]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/60 backdrop-blur-2xl relative">
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

      <main className="w-full px-6 lg:px-10 py-8 relative z-10">
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
