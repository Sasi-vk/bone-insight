import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";

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
      reader.onload = (e) => {
        onImageSelected(file, e.target?.result as string);
      };
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

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden card-glass group">
          <img src={preview} alt="Uploaded scan" className="w-full max-h-[500px] object-contain bg-black/50" />
          {!isAnalyzing && (
            <button
              onClick={onClear}
              className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-destructive hover:border-destructive transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
              <div className="relative w-full h-full">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="w-full h-1 bg-primary/60 animate-scan" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                    <p className="font-display text-sm text-foreground/80">Analyzing scan...</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <label
          className={`upload-zone ${isDragging ? "active" : ""} rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer min-h-[300px] transition-all`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="w-7 h-7 text-primary" />
          </div>
          <p className="font-display text-lg text-foreground mb-1">Upload X-Ray Scan</p>
          <p className="text-sm text-muted-foreground mb-4">Drag & drop or tap to browse</p>
          <div className="flex gap-2">
            {["PNG", "JPG", "DICOM"].map((fmt) => (
              <span key={fmt} className="px-3 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                {fmt}
              </span>
            ))}
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
      )}
    </div>
  );
};

export default ScanUpload;
