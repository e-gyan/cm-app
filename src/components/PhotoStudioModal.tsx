import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Camera,
  Upload,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Check,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
  Palette,
  Loader2,
} from "lucide-react";

export interface StudioBackdropPreset {
  id: string;
  name: string;
  type: "original" | "gradient" | "solid";
  value: string;
  previewClass: string;
}

export const BACKDROP_PRESETS: StudioBackdropPreset[] = [
  {
    id: "original",
    name: "Original",
    type: "original",
    value: "original",
    previewClass: "bg-slate-200 border-2 border-slate-300",
  },
  {
    id: "church_indigo",
    name: "Church Indigo",
    type: "gradient",
    value: "linear-gradient(135deg, #4338ca, #6366f1)",
    previewClass: "bg-gradient-to-br from-indigo-700 to-indigo-500",
  },
  {
    id: "royal_blue",
    name: "Royal Blue",
    type: "gradient",
    value: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
    previewClass: "bg-gradient-to-br from-blue-900 to-blue-500",
  },
  {
    id: "studio_amber",
    name: "Warm Amber",
    type: "gradient",
    value: "linear-gradient(135deg, #b45309, #f59e0b)",
    previewClass: "bg-gradient-to-br from-amber-700 to-amber-500",
  },
  {
    id: "slate_modern",
    name: "Studio Slate",
    type: "gradient",
    value: "linear-gradient(135deg, #1e293b, #475569)",
    previewClass: "bg-gradient-to-br from-slate-900 to-slate-600",
  },
  {
    id: "emerald_fresh",
    name: "Fresh Emerald",
    type: "gradient",
    value: "linear-gradient(135deg, #065f46, #10b981)",
    previewClass: "bg-gradient-to-br from-emerald-800 to-emerald-500",
  },
  {
    id: "studio_light",
    name: "Clean Light",
    type: "solid",
    value: "#f8fafc",
    previewClass: "bg-slate-100 border border-slate-300",
  },
];

interface PhotoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => Promise<void> | void;
  currentPhotoUrl?: string;
  memberName: string;
}

export const PhotoStudioModal: React.FC<PhotoStudioModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentPhotoUrl,
  memberName,
}) => {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedBackdrop, setSelectedBackdrop] = useState<string>("church_indigo");
  const [backdropSoftness, setBackdropSoftness] = useState<number>(55);
  
  // Camera state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize source image if currentPhotoUrl exists
  useEffect(() => {
    if (isOpen && currentPhotoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setSourceImage(img);
        setZoom(1.1);
        setPan({ x: 0, y: 0 });
        setRotation(0);
      };
      img.src = currentPhotoUrl;
    } else if (isOpen && !currentPhotoUrl) {
      setSourceImage(null);
    }
  }, [isOpen, currentPhotoUrl]);

  // Clean up camera stream when modal closes
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen, stopCamera]);

  // Start Webcam
  const startCamera = async () => {
    setCameraError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser."
          : "Could not access camera. Please upload an image file instead."
      );
    }
  };

  // Snapshot from Camera
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const offscreen = document.createElement("canvas");
    offscreen.width = video.videoWidth || 640;
    offscreen.height = video.videoHeight || 640;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
    const snapDataUrl = offscreen.toDataURL("image/jpeg", 0.95);

    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      stopCamera();
      setZoom(1.1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
    };
    img.src = snapDataUrl;
  };

  // Handle Local File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        stopCamera();
        setZoom(1.1);
        setPan({ x: 0, y: 0 });
        setRotation(0);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Redraw Canvas with Framing and Constant Background
  const renderCompositeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 512; // High-res internal rendering buffer
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const preset = BACKDROP_PRESETS.find((p) => p.id === selectedBackdrop) || BACKDROP_PRESETS[0];

    // 1. Draw Constant Backdrop (if not original)
    if (preset.type !== "original") {
      if (preset.type === "gradient") {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        if (preset.id === "church_indigo") {
          grad.addColorStop(0, "#3730a3");
          grad.addColorStop(1, "#6366f1");
        } else if (preset.id === "royal_blue") {
          grad.addColorStop(0, "#1e3a8a");
          grad.addColorStop(1, "#3b82f6");
        } else if (preset.id === "studio_amber") {
          grad.addColorStop(0, "#92400e");
          grad.addColorStop(1, "#f59e0b");
        } else if (preset.id === "slate_modern") {
          grad.addColorStop(0, "#0f172a");
          grad.addColorStop(1, "#475569");
        } else if (preset.id === "emerald_fresh") {
          grad.addColorStop(0, "#064e3b");
          grad.addColorStop(1, "#10b981");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      } else {
        ctx.fillStyle = preset.value;
        ctx.fillRect(0, 0, size, size);
      }

      // Subtle studio spotlight effect
      const spotGrad = ctx.createRadialGradient(
        size / 2,
        size / 2.2,
        size * 0.1,
        size / 2,
        size / 2.2,
        size * 0.65
      );
      spotGrad.addColorStop(0, "rgba(255, 255, 255, 0.22)");
      spotGrad.addColorStop(1, "rgba(0, 0, 0, 0.18)");
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, size, size);
    }

    // 2. Draw Image Subject
    if (sourceImage) {
      ctx.save();

      // If applying a studio backdrop, apply a circular portrait feather mask
      if (preset.type !== "original") {
        const featherRadius = size * 0.44;
        const featherGrad = ctx.createRadialGradient(
          size / 2,
          size / 2,
          featherRadius * (backdropSoftness / 100),
          size / 2,
          size / 2,
          featherRadius
        );
        featherGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
        featherGrad.addColorStop(0.85, "rgba(0, 0, 0, 0.95)");
        featherGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        // Create temporary offscreen canvas for feathered subject
        const offCanvas = document.createElement("canvas");
        offCanvas.width = size;
        offCanvas.height = size;
        const offCtx = offCanvas.getContext("2d");

        if (offCtx) {
          offCtx.save();
          offCtx.translate(size / 2 + pan.x, size / 2 + pan.y);
          offCtx.rotate((rotation * Math.PI) / 180);
          offCtx.scale(zoom, zoom);

          // Calculate aspect-ratio fit
          const imgAspect = sourceImage.width / sourceImage.height;
          let drawW = size;
          let drawH = size;
          if (imgAspect > 1) {
            drawW = size * imgAspect;
          } else {
            drawH = size / imgAspect;
          }

          offCtx.drawImage(sourceImage, -drawW / 2, -drawH / 2, drawW, drawH);
          offCtx.restore();

          // Apply soft feather mask
          offCtx.globalCompositeOperation = "destination-in";
          offCtx.fillStyle = featherGrad;
          offCtx.fillRect(0, 0, size, size);

          // Blend onto main canvas
          ctx.drawImage(offCanvas, 0, 0);
        }
      } else {
        // Original mode: standard high-fidelity centered crop
        ctx.translate(size / 2 + pan.x, size / 2 + pan.y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);

        const imgAspect = sourceImage.width / sourceImage.height;
        let drawW = size;
        let drawH = size;
        if (imgAspect > 1) {
          drawW = size * imgAspect;
        } else {
          drawH = size / imgAspect;
        }

        ctx.drawImage(sourceImage, -drawW / 2, -drawH / 2, drawW, drawH);
      }

      ctx.restore();
    } else {
      // Empty state placeholder
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No Image Selected", size / 2, size / 2);
    }
  }, [sourceImage, zoom, rotation, pan, selectedBackdrop, backdropSoftness]);

  useEffect(() => {
    if (isOpen) {
      renderCompositeCanvas();
    }
  }, [isOpen, renderCompositeCanvas]);

  // Mouse / Touch Dragging for Panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sourceImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Final Export & Save
  const handleExportAndSave = async () => {
    if (!canvasRef.current || !sourceImage) return;
    setIsProcessing(true);

    try {
      // Create final 256x256 output canvas for optimal compression & bandwidth
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = 256;
      outputCanvas.height = 256;
      const outCtx = outputCanvas.getContext("2d");
      if (!outCtx) return;

      outCtx.drawImage(canvasRef.current, 0, 0, 256, 256);

      // Export as WebP with 0.85 quality (~15-25KB)
      const dataUrl = outputCanvas.toDataURL("image/webp", 0.85);

      await onSave(dataUrl);
      onClose();
    } catch (err) {
      console.error("Failed to export photo:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Photo Studio & Avatar Creator
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {memberName ? `Customizing portrait for ${memberName}` : "Upload or capture child portrait"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Studio Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Top Action Tabs (Camera or Upload) */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (isCameraActive) {
                  stopCamera();
                } else {
                  startCamera();
                }
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                isCameraActive
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Camera size={18} />
              {isCameraActive ? "Stop Camera" : "Snap with Camera"}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <Upload size={18} />
              Choose Photo File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {cameraError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {cameraError}
            </div>
          )}

          {/* Interactive Stage */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Main Canvas / Video Stage */}
            <div className="md:col-span-8 flex flex-col items-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-inner border-4 border-slate-100 bg-slate-900 flex items-center justify-center">
                {isCameraActive ? (
                  <div className="w-full h-full relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/60 rounded-full m-4" />
                    <button
                      onClick={captureSnapshot}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-white text-slate-900 rounded-full font-extrabold text-sm shadow-xl hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Camera size={16} className="text-indigo-600" /> Take Snapshot
                    </button>
                  </div>
                ) : (
                  <>
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      className={`w-full h-full object-contain ${
                        sourceImage ? "cursor-move" : "cursor-default"
                      }`}
                    />
                    {/* Framing Guide */}
                    <div className="absolute inset-0 pointer-events-none border-2 border-indigo-400/40 rounded-full m-3 ring-8 ring-slate-950/20" />
                  </>
                )}
              </div>

              {sourceImage && !isCameraActive && (
                <p className="text-[11px] font-semibold text-slate-400 mt-2">
                  Tip: Click and drag inside the frame to adjust child position
                </p>
              )}
            </div>

            {/* Live Real-world Previews */}
            <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live App Preview
              </span>

              {/* 80px Card Preview */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-md ring-4 ring-white bg-slate-200">
                  {canvasRef.current && (
                    <img
                      src={canvasRef.current.toDataURL()}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-400">Card View (80px)</span>
              </div>

              {/* 40px Roster Badge Preview */}
              <div className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-100 w-full">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-sm bg-slate-200 ring-2 ring-indigo-50">
                  {canvasRef.current && (
                    <img
                      src={canvasRef.current.toDataURL()}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="overflow-hidden leading-tight">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {memberName || "Child Name"}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Present</div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls: Constant Background Palette */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Palette size={14} className="text-indigo-600" />
                Constant Studio Background
              </label>
              <span className="text-[11px] font-medium text-slate-400">
                Gives every child a clean, uniform backdrop
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {BACKDROP_PRESETS.map((preset) => {
                const isSelected = selectedBackdrop === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedBackdrop(preset.id)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center ${preset.previewClass}`}>
                      {isSelected && <Check size={14} className={preset.id === "studio_light" ? "text-slate-800" : "text-white"} />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fine Tuning Controls (Zoom & Softness) */}
          {sourceImage && !isCameraActive && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <ZoomIn size={14} /> Zoom & Framing
                  </span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              {selectedBackdrop !== "original" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Sliders size={14} /> Studio Edge Softness
                    </span>
                    <span>{backdropSoftness}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    step="5"
                    value={backdropSoftness}
                    onChange={(e) => setBackdropSoftness(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleExportAndSave}
            disabled={!sourceImage || isProcessing}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving Portrait...
              </>
            ) : (
              <>
                <Check size={16} /> Save & Apply Photo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
