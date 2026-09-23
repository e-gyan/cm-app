import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Camera,
  Upload,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Check,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
  Palette,
  Loader2,
  Wand2,
  Smartphone,
  Eye,
} from "lucide-react";

export interface StudioBackdropPreset {
  id: string;
  name: string;
  type: "original" | "gradient" | "solid" | "custom_color" | "custom_image" | "transparent";
  value: string;
  previewClass: string;
}

export const BACKDROP_PRESETS: StudioBackdropPreset[] = [
  {
    id: "church_indigo",
    name: "Church Indigo",
    type: "gradient",
    value: "linear-gradient(135deg, #3730a3, #6366f1)",
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
    value: "linear-gradient(135deg, #92400e, #f59e0b)",
    previewClass: "bg-gradient-to-br from-amber-700 to-amber-500",
  },
  {
    id: "slate_modern",
    name: "Studio Slate",
    type: "gradient",
    value: "linear-gradient(135deg, #0f172a, #475569)",
    previewClass: "bg-gradient-to-br from-slate-900 to-slate-600",
  },
  {
    id: "emerald_fresh",
    name: "Fresh Emerald",
    type: "gradient",
    value: "linear-gradient(135deg, #064e3b, #10b981)",
    previewClass: "bg-gradient-to-br from-emerald-800 to-emerald-500",
  },
  {
    id: "studio_light",
    name: "Clean Light",
    type: "solid",
    value: "#f8fafc",
    previewClass: "bg-slate-100 border border-slate-300",
  },
  {
    id: "custom_color",
    name: "Custom Color",
    type: "custom_color",
    value: "#4f46e5",
    previewClass: "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 border border-slate-200",
  },
  {
    id: "custom_image",
    name: "Custom Image",
    type: "custom_image",
    value: "",
    previewClass: "bg-amber-100 border border-amber-300 text-amber-700",
  },
  {
    id: "transparent",
    name: "Transparent",
    type: "transparent",
    value: "transparent",
    previewClass: "bg-[conic-gradient(#cbd5e1_90deg,#f1f5f9_90deg_180deg,#cbd5e1_180deg_270deg,#f1f5f9_270deg)] bg-[length:12px_12px]",
  },
  {
    id: "original",
    name: "Original Photo",
    type: "original",
    value: "original",
    previewClass: "bg-slate-200 border-2 border-slate-300",
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
  const [backdropSoftness, setBackdropSoftness] = useState<number>(50);

  // Background removal / Cutout controls
  const [removeBackground, setRemoveBackground] = useState<boolean>(true);
  const [cutoutTolerance, setCutoutTolerance] = useState<number>(45); // 15 - 85%
  const [customBgColor, setCustomBgColor] = useState<string>("#4338ca");
  const [customBackdropImage, setCustomBackdropImage] = useState<HTMLImageElement | null>(null);

  // Camera state (Front and Rear support)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customBgInputRef = useRef<HTMLInputElement | null>(null);
  const rearCameraInputRef = useRef<HTMLInputElement | null>(null);
  const frontCameraInputRef = useRef<HTMLInputElement | null>(null);

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

  // Clean up camera stream
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

  // Start Camera with Front or Rear facing mode
  const startCamera = async (targetFacing: "user" | "environment" = facingMode) => {
    setCameraError(null);
    try {
      stopCamera();

      // Constraint request with fallback
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
      } catch (err) {
        // Fallback for strict browsers
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setFacingMode(targetFacing);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        "Could not access live camera. You can also tap 'Take Photo (Rear / Front)' below to use your phone camera directly, or choose a file."
      );
    }
  };

  // Switch between front and rear cameras
  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    await startCamera(nextMode);
  };

  // Snapshot from Camera
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const offscreen = document.createElement("canvas");
    offscreen.width = video.videoWidth || 720;
    offscreen.height = video.videoHeight || 720;
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

  // Handle Local File Upload or Native Camera Capture
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

  // Handle Custom Backdrop Image Upload
  const handleCustomBackdropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCustomBackdropImage(img);
        setSelectedBackdrop("custom_image");
        setRemoveBackground(true);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /**
   * Smart Portrait Background Removal / Cutout Engine
   * Samples corners and perimeter of the source image to identify background tones,
   * detects human torso/face skin geometry in the central portrait zone to protect the child,
   * and generates a clean alpha mask removing ambient walls, curtains, and backgrounds.
   */
  const generateCutoutCanvas = useCallback(
    (img: HTMLImageElement, size: number, tolerancePct: number): HTMLCanvasElement => {
      const w = size;
      const h = size;

      // Draw framed, transformed source image to temp canvas
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = w;
      srcCanvas.height = h;
      const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
      if (!srcCtx) return srcCanvas;

      srcCtx.save();
      srcCtx.translate(w / 2 + pan.x, h / 2 + pan.y);
      srcCtx.rotate((rotation * Math.PI) / 180);
      srcCtx.scale(zoom, zoom);

      const imgAspect = img.width / img.height;
      let drawW = w;
      let drawH = h;
      if (imgAspect > 1) {
        drawW = w * imgAspect;
      } else {
        drawH = w / imgAspect;
      }
      srcCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      srcCtx.restore();

      const imgData = srcCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // 1. Sample perimeter pixels to model background colors
      const bgSamples: [number, number, number][] = [];
      const step = 4;

      // Sample top row, top corners, left and right edges outside center portrait
      for (let x = 0; x < w; x += step) {
        for (let y = 0; y < Math.floor(h * 0.12); y += step) {
          const idx = (y * w + x) * 4;
          bgSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }
      for (let y = 0; y < h; y += step) {
        // Left 10%
        for (let x = 0; x < Math.floor(w * 0.12); x += step) {
          const idx = (y * w + x) * 4;
          bgSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
        // Right 10%
        for (let x = Math.floor(w * 0.88); x < w; x += step) {
          const idx = (y * w + x) * 4;
          bgSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }

      if (bgSamples.length === 0) return srcCanvas;

      // Calculate average background RGB and variance
      let avgR = 0,
        avgG = 0,
        avgB = 0;
      for (let i = 0; i < bgSamples.length; i++) {
        avgR += bgSamples[i][0];
        avgG += bgSamples[i][1];
        avgB += bgSamples[i][2];
      }
      avgR /= bgSamples.length;
      avgG /= bgSamples.length;
      avgB /= bgSamples.length;

      // Distance threshold computed from tolerance slider
      // tolerancePct: 15 to 85 -> threshold 25 to 140
      const threshold = 20 + tolerancePct * 1.5;
      const featherBand = 18;

      const centerX = w / 2;
      const centerY = h / 2;
      const portraitRadiusX = w * 0.38;
      const portraitRadiusY = h * 0.46;

      // 2. Classify and mask pixels
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Normalized distance from center portrait zone
          const dx = (x - centerX) / portraitRadiusX;
          const dy = (y - centerY) / portraitRadiusY;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);

          // Skin tone detector (protects child's face, neck, and hands)
          const isSkin =
            r > 50 &&
            g > 35 &&
            b > 20 &&
            r > g &&
            r > b &&
            Math.abs(r - g) > 10 &&
            distFromCenter < 1.05;

          // Euclidean color distance to background
          const dr = r - avgR;
          const dg = g - avgG;
          const db = b - avgB;
          const colorDist = Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);

          if (isSkin) {
            // Protected skin: preserve full opacity
            data[idx + 3] = 255;
          } else if (distFromCenter > 1.25) {
            // Deep outside portrait frame: remove background cleanly
            if (colorDist < threshold + 15) {
              data[idx + 3] = 0;
            } else {
              const alpha = Math.max(0, Math.min(255, (colorDist - threshold) * 8));
              data[idx + 3] = Math.min(data[idx + 3], alpha);
            }
          } else {
            // Near or inside portrait subject
            if (colorDist < threshold - featherBand) {
              // Exact match to background color
              data[idx + 3] = 0;
            } else if (colorDist < threshold + featherBand) {
              // Smooth gradient edge feathering
              const ratio = (colorDist - (threshold - featherBand)) / (featherBand * 2);
              data[idx + 3] = Math.round(ratio * 255);
            }
            // Otherwise, keep subject opaque
          }
        }
      }

      srcCtx.putImageData(imgData, 0, 0);
      return srcCanvas;
    },
    [pan, rotation, zoom]
  );

  // Redraw Canvas with Framing, Cutout Subject, and Studio Backdrops
  const renderCompositeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 512; // High-resolution internal buffer
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const preset = BACKDROP_PRESETS.find((p) => p.id === selectedBackdrop) || BACKDROP_PRESETS[0];

    // 1. Draw Backdrop Layer
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
      } else if (preset.type === "solid") {
        ctx.fillStyle = preset.value;
        ctx.fillRect(0, 0, size, size);
      } else if (preset.type === "custom_color") {
        ctx.fillStyle = customBgColor;
        ctx.fillRect(0, 0, size, size);
      } else if (preset.type === "custom_image" && customBackdropImage) {
        // Draw custom image backdrop scaled to fill
        const bgAspect = customBackdropImage.width / customBackdropImage.height;
        let bW = size;
        let bH = size;
        if (bgAspect > 1) {
          bW = size * bgAspect;
        } else {
          bH = size / bgAspect;
        }
        ctx.drawImage(customBackdropImage, (size - bW) / 2, (size - bH) / 2, bW, bH);
      } else if (preset.type === "transparent") {
        // Transparent PNG background
        ctx.clearRect(0, 0, size, size);
      }

      // Add studio vignette/lighting if not transparent
      if (preset.type !== "transparent") {
        const spotGrad = ctx.createRadialGradient(
          size / 2,
          size / 2.2,
          size * 0.1,
          size / 2,
          size / 2.2,
          size * 0.65
        );
        spotGrad.addColorStop(0, "rgba(255, 255, 255, 0.18)");
        spotGrad.addColorStop(1, "rgba(0, 0, 0, 0.16)");
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, size, size);
      }
    }

    // 2. Draw Subject (With or without Cutout)
    if (sourceImage) {
      ctx.save();

      if (removeBackground && preset.type !== "original") {
        // Render smart cutout subject
        const cutout = generateCutoutCanvas(sourceImage, size, cutoutTolerance);

        // Apply circular feathering around the studio frame
        const featherRadius = size * 0.48;
        const featherGrad = ctx.createRadialGradient(
          size / 2,
          size / 2,
          featherRadius * (backdropSoftness / 100),
          size / 2,
          size / 2,
          featherRadius
        );
        featherGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
        featherGrad.addColorStop(0.9, "rgba(0, 0, 0, 0.95)");
        featherGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = size;
        maskCanvas.height = size;
        const mCtx = maskCanvas.getContext("2d");
        if (mCtx) {
          mCtx.drawImage(cutout, 0, 0);
          mCtx.globalCompositeOperation = "destination-in";
          mCtx.fillStyle = featherGrad;
          mCtx.fillRect(0, 0, size, size);
          ctx.drawImage(maskCanvas, 0, 0);
        }
      } else {
        // Original framing without background removal
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
  }, [
    sourceImage,
    zoom,
    rotation,
    pan,
    selectedBackdrop,
    backdropSoftness,
    removeBackground,
    cutoutTolerance,
    customBgColor,
    customBackdropImage,
    generateCutoutCanvas,
  ]);

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

      // Export as WebP (or PNG for transparent)
      const dataUrl =
        selectedBackdrop === "transparent"
          ? outputCanvas.toDataURL("image/png")
          : outputCanvas.toDataURL("image/webp", 0.85);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 shadow-sm">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Photo Studio & Avatar Creator
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {memberName ? `Customizing portrait for ${memberName}` : "Capture or upload child portrait"}
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Capture & Upload Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Phone Rear Camera Direct Capture */}
            <button
              onClick={() => rearCameraInputRef.current?.click()}
              className="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
              title="Open phone rear camera directly"
            >
              <Smartphone size={15} className="text-indigo-600" />
              <span>Rear Camera</span>
            </button>
            <input
              ref={rearCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Phone Front / Selfie Direct Capture */}
            <button
              onClick={() => frontCameraInputRef.current?.click()}
              className="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
              title="Open phone selfie camera directly"
            >
              <Smartphone size={15} className="text-indigo-600" />
              <span>Front Camera</span>
            </button>
            <input
              ref={frontCameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Live WebRTC Camera Stream */}
            <button
              onClick={() => {
                if (isCameraActive) {
                  stopCamera();
                } else {
                  startCamera("environment");
                }
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all shadow-sm ${
                isCameraActive
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Camera size={15} />
              <span>{isCameraActive ? "Stop Live" : "Live Viewfinder"}</span>
            </button>

            {/* File Upload from Gallery/Device */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <Upload size={15} />
              <span>Choose File</span>
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
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
              {cameraError}
            </div>
          )}

          {/* Interactive Stage & Live Previews */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            {/* Main Stage */}
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

                    {/* Camera Control Overlay */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        onClick={toggleCameraFacing}
                        className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm transition-all"
                        title="Flip Front / Rear Camera"
                      >
                        <RefreshCw size={13} />
                        {facingMode === "user" ? "Front" : "Rear"}
                      </button>
                    </div>

                    <button
                      onClick={captureSnapshot}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-white text-slate-900 rounded-full font-extrabold text-sm shadow-xl hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Camera size={16} className="text-indigo-600" /> Snap Photo
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
                    {/* Portrait circular frame guide */}
                    <div className="absolute inset-0 pointer-events-none border-2 border-indigo-400/40 rounded-full m-3 ring-8 ring-slate-950/20" />
                  </>
                )}
              </div>

              {sourceImage && !isCameraActive && (
                <p className="text-[11px] font-semibold text-slate-400 mt-2">
                  Tip: Drag inside the frame to center child; zoom & rotate below
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

          {/* Background Removal & Subject Isolation Toggle */}
          {sourceImage && !isCameraActive && (
            <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Wand2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Remove Original Background (Subject Cutout)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Isolates the child/person and places them seamlessly on your chosen backdrop
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeBackground}
                    onChange={(e) => setRemoveBackground(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Studio Backdrops & Custom Colors */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Palette size={14} className="text-indigo-600" />
                Constant Studio Backdrops & Colors
              </label>
              <span className="text-[11px] font-medium text-slate-400">
                Preset, Custom Colors, or Custom Images
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {BACKDROP_PRESETS.map((preset) => {
                const isSelected = selectedBackdrop === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedBackdrop(preset.id);
                      if (preset.id === "custom_image" && !customBackdropImage) {
                        customBgInputRef.current?.click();
                      }
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center ${preset.previewClass}`}
                      style={
                        preset.id === "custom_color"
                          ? { backgroundColor: customBgColor }
                          : undefined
                      }
                    >
                      {isSelected && (
                        <Check
                          size={14}
                          className={
                            preset.id === "studio_light" || preset.id === "transparent"
                              ? "text-slate-800"
                              : "text-white"
                          }
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hidden Input for Custom Image Backdrop */}
            <input
              ref={customBgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomBackdropUpload}
            />

            {/* Custom Color & Image Pickers */}
            {selectedBackdrop === "custom_color" && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 animate-in fade-in">
                <input
                  type="color"
                  value={customBgColor}
                  onChange={(e) => setCustomBgColor(e.target.value)}
                  className="w-9 h-9 rounded-xl border-none cursor-pointer bg-transparent"
                />
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    Pick Solid Backdrop Color
                  </label>
                  <input
                    type="text"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    placeholder="#4f46e5"
                    className="p-1 px-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg outline-none uppercase w-28"
                  />
                </div>
              </div>
            )}

            {selectedBackdrop === "custom_image" && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">
                    {customBackdropImage ? "Custom Backdrop Image Loaded" : "No Custom Image Chosen"}
                  </span>
                </div>
                <button
                  onClick={() => customBgInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-xl font-bold text-xs transition-all shadow-sm"
                >
                  {customBackdropImage ? "Change Image" : "Upload Image"}
                </button>
              </div>
            )}
          </div>

          {/* Fine Tuning Controls (Cutout Tolerance & Zoom) */}
          {sourceImage && !isCameraActive && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <ZoomIn size={14} /> Zoom & Scale
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

              {removeBackground && selectedBackdrop !== "original" ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Sliders size={14} /> Cutout Sensitivity
                    </span>
                    <span>{cutoutTolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="85"
                    step="5"
                    value={cutoutTolerance}
                    onChange={(e) => setCutoutTolerance(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              ) : (
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
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
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

export default PhotoStudioModal;
