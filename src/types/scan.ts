export interface ScanAnalysis {
  detected: boolean;
  condition: string;
  severity: "Mild" | "Moderate" | "Severe" | "Critical" | "None";
  affectedRegion: string;
  findings: string;
  medication: string;
  doctorType: string;
  urgency: "Immediate" | "Within 24 hours" | "Within a week" | "Routine";
  additionalNotes: string;
}
