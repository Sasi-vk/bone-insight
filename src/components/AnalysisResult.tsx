import type { ScanAnalysis } from "@/types/scan";
import { AlertTriangle, CheckCircle, MapPin, Pill, Stethoscope, Clock, FileText } from "lucide-react";

interface AnalysisResultProps {
  result: ScanAnalysis;
}

const severityColor: Record<string, string> = {
  None: "text-primary",
  Mild: "text-yellow-400",
  Moderate: "text-orange-400",
  Severe: "text-red-400",
  Critical: "text-red-500",
};

const severityBg: Record<string, string> = {
  None: "bg-primary/10 border-primary/20",
  Mild: "bg-yellow-400/10 border-yellow-400/20",
  Moderate: "bg-orange-400/10 border-orange-400/20",
  Severe: "bg-red-400/10 border-red-400/20",
  Critical: "bg-red-500/10 border-red-500/20",
};

const AnalysisResult = ({ result }: AnalysisResultProps) => {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Status Banner */}
      <div className={`rounded-2xl p-4 border ${result.detected ? severityBg[result.severity] : "bg-primary/10 border-primary/20"}`}>
        <div className="flex items-center gap-3">
          {result.detected ? (
            <AlertTriangle className={`w-6 h-6 ${severityColor[result.severity]}`} />
          ) : (
            <CheckCircle className="w-6 h-6 text-primary" />
          )}
          <div>
            <p className="font-display font-semibold text-foreground">{result.condition}</p>
            <p className={`text-sm font-medium ${result.detected ? severityColor[result.severity] : "text-primary"}`}>
              Severity: {result.severity}
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-3">
        <InfoCard icon={<MapPin className="w-4 h-4 text-primary" />} label="Affected Region" value={result.affectedRegion} />
        <InfoCard icon={<FileText className="w-4 h-4 text-primary" />} label="Findings" value={result.findings} />
        <InfoCard icon={<Pill className="w-4 h-4 text-primary" />} label="Suggested Medication" value={result.medication} />
        <InfoCard icon={<Stethoscope className="w-4 h-4 text-primary" />} label="Consult Specialist" value={result.doctorType} />
        <InfoCard icon={<Clock className="w-4 h-4 text-primary" />} label="Urgency" value={result.urgency} />
        {result.additionalNotes && (
          <InfoCard icon={<FileText className="w-4 h-4 text-muted-foreground" />} label="Additional Notes" value={result.additionalNotes} />
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center px-4 leading-relaxed">
        ⚠️ This AI analysis is for informational purposes only and does not replace professional medical advice. Always consult a qualified healthcare provider.
      </p>
    </div>
  );
};

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="card-glass rounded-xl p-4">
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-sm text-foreground leading-relaxed">{value}</p>
      </div>
    </div>
  </div>
);

export default AnalysisResult;
