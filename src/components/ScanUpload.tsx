import { useCallback, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";

interface ScanUploadProps {
  onImageSelected: (file: File, preview: string) => void;
  preview: string | null;
  onClear: () => void;
  isAnalyzing: boolean;
}

const ScanUpload = ({ onImageSelected, preview, onClear, isAnalyzing }: ScanUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => onImageSelected(file, e.target?.result as string);
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (preview) {
    return (
      <div className="relative card-elevated overflow-hidden">
        <div className="bg-muted/30 p-1">
          <img
            src={preview}
            alt="Uploaded scan"
            className="w-full max-h-[420px] object-contain rounded-xl"
          />
        </div>
        {!isAnalyzing && (
          <button
            onClick={onClear}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-card/90 backdrop-blur-sm border border-border shadow-sm hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-card/70 backdrop-blur-sm flex items-center justify-center">
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="w-full h-0.5 bg-primary animate-scan" />
            </div>
            <div className="text-center space-y-3 z-10">
              <div className="w-10 h-10 rounded-full border-[3px] border-primary border-t-transparent animate-spin mx-auto" />
              <div>
                <p className="font-display font-semibold text-sm text-foreground">Analyzing Scan</p>
                <p className="text-xs text-muted-foreground mt-0.5">Processing with AI model...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <label
      className={`upload-zone ${isDragging ? "active" : ""} rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-card/60 backdrop-blur-sm transition-all group`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="py-20 px-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors">
          <Upload className="w-7 h-7 text-primary" />
        </div>
        <p className="font-display font-bold text-lg text-foreground mb-1.5">Upload X-Ray Scan</p>
        <p className="text-sm text-muted-foreground mb-6">Drag & drop or click to browse</p>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Supports PNG, JPG, JPEG, DICOM</span>
        </div>
      </div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </label>
  );
};

export default ScanUpload;
