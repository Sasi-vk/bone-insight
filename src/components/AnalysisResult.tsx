import type { ScanAnalysis } from "@/types/scan";
import { AlertTriangle, CheckCircle, MapPin, Pill, Stethoscope, Clock, FileText, Activity } from "lucide-react";

interface AnalysisResultProps {
  result: ScanAnalysis;
}

const severityBadgeClass: Record<string, string> = {
  None: "badge-severity-none",
  Mild: "badge-severity-mild",
  Moderate: "badge-severity-moderate",
  Severe: "badge-severity-severe",
  Critical: "badge-severity-critical",
};

const urgencyBadgeClass: Record<string, string> = {
  Routine: "badge-severity-none",
  "Within a week": "badge-severity-mild",
  "Within 24 hours": "badge-severity-moderate",
  Immediate: "badge-severity-critical",
};

const AnalysisResult = ({ result }: AnalysisResultProps) => {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Diagnosis Header */}
      <div className="card-elevated-lg p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${result.detected ? "bg-destructive/10" : "bg-success/10"}`}>
            {result.detected ? (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-lg text-foreground leading-tight">{result.condition}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityBadgeClass[result.severity]}`}>
                <Activity className="w-3 h-3 mr-1" />
                {result.severity}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${urgencyBadgeClass[result.urgency]}`}>
                <Clock className="w-3 h-3 mr-1" />
                {result.urgency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Report Sections */}
      <div className="card-elevated overflow-hidden divide-y divide-border">
        <ReportRow icon={<MapPin className="w-4 h-4 text-primary" />} label="Affected Region" value={result.affectedRegion} />
        <ReportRow icon={<FileText className="w-4 h-4 text-primary" />} label="Clinical Findings" value={result.findings} />
        <ReportRow icon={<Pill className="w-4 h-4 text-accent" />} label="Suggested Medication" value={result.medication} />
        <ReportRow icon={<Stethoscope className="w-4 h-4 text-accent" />} label="Recommended Specialist" value={result.doctorType} highlight />
        {result.additionalNotes && (
          <ReportRow icon={<FileText className="w-4 h-4 text-muted-foreground" />} label="Notes" value={result.additionalNotes} />
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground/70">Disclaimer:</span> This AI-generated analysis is for informational purposes only. It is not a substitute for professional medical diagnosis or treatment. Please consult a qualified healthcare provider for medical advice.
        </p>
      </div>
    </div>
  );
};

const ReportRow = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <div className={`px-4 py-3.5 ${highlight ? "bg-accent/5" : ""}`}>
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm leading-relaxed ${highlight ? "font-semibold text-foreground" : "text-foreground/85"}`}>{value}</p>
      </div>
    </div>
  </div>
);

export default AnalysisResult;
