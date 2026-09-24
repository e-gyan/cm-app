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
  Sparkles,
  Sun,
  Layers,
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
    id: "velvet_purple",
    name: "Velvet Purple",
    type: "gradient",
    value: "linear-gradient(135deg, #4c1d95, #8b5cf6)",
    previewClass: "bg-gradient-to-br from-purple-900 to-purple-500",
  },
  {
    id: "sunset_crimson",
    name: "Sunset Crimson",
    type: "gradient",
    value: "linear-gradient(135deg, #881337, #f43f5e)",
    previewClass: "bg-gradient-to-br from-rose-900 to-rose-500",
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

  // AI & Smart Cutout Caching state (prevents synchronous lag on sliders/options)
  const [cutoutImage, setCutoutImage] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiCutoutApplied, setAiCutoutApplied] = useState<boolean>(false);

  // Studio Visual Separation (enhances subject popping off any background color)
  const [studioShadow, setStudioShadow] = useState<boolean>(true);
  const [subjectPop, setSubjectPop] = useState<boolean>(true);

  // Live real-world preview data URL (synchronously updated for Card View & Roster Badge)
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");

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
   * Enhanced Algorithmic Cutout Engine (Instant ~15ms fallback)
   * Samples corners and perimeter of the source image to identify multi-cluster background tones,
   * detects human torso/face skin geometry in the central portrait zone to protect the child,
   * and generates a clean alpha mask removing ambient walls, curtains, and backgrounds.
   */
  const createEnhancedAlgorithmicCutout = useCallback(
    (img: HTMLImageElement, tolerancePct: number): HTMLCanvasElement => {
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement("canvas");
      // Scale down large photos to standard high-res boundary for instant execution
      const maxDim = 800;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const targetW = Math.max(1, Math.round(w * scale));
      const targetH = Math.max(1, Math.round(h * scale));
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return canvas;

      ctx.drawImage(img, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;

      // 1. Multi-cluster sampling of background tones (corners and perimeters)
      const bgSamples: [number, number, number][] = [];
      const step = 4;
      const topBand = Math.floor(targetH * 0.16);
      const sideBand = Math.floor(targetW * 0.14);

      // Top band
      for (let y = 0; y < topBand; y += step) {
        for (let x = 0; x < targetW; x += step) {
          const idx = (y * targetW + x) * 4;
          bgSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }
      // Left and right side bands
      for (let y = topBand; y < targetH; y += step) {
        for (let x = 0; x < sideBand; x += step) {
          const idx = (y * targetW + x) * 4;
          bgSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
        for (let x = targetW - sideBand; x < targetW; x += step) {
          const idx = (y * targetW + x) * 4;
          bgSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }

      if (bgSamples.length === 0) return canvas;

      let sumR = 0, sumG = 0, sumB = 0;
      for (let i = 0; i < bgSamples.length; i++) {
        sumR += bgSamples[i][0];
        sumG += bgSamples[i][1];
        sumB += bgSamples[i][2];
      }
      const avgR = sumR / bgSamples.length;
      const avgG = sumG / bgSamples.length;
      const avgB = sumB / bgSamples.length;

      // Sample 4 pure corners
      const cornerCoords = [
        [2, 2],
        [targetW - 3, 2],
        [2, Math.floor(topBand * 0.8)],
        [targetW - 3, Math.floor(topBand * 0.8)],
      ];
      let cR = 0, cG = 0, cB = 0;
      for (const [cx, cy] of cornerCoords) {
        const cidx = (cy * targetW + cx) * 4;
        cR += data[cidx];
        cG += data[cidx + 1];
        cB += data[cidx + 2];
      }
      cR /= cornerCoords.length;
      cG /= cornerCoords.length;
      cB /= cornerCoords.length;

      const baseDist = 22 + tolerancePct * 1.6;
      const featherBand = 18;

      const centerX = targetW / 2;
      const centerY = targetH * 0.48;
      const portraitRadiusX = targetW * 0.36;
      const portraitRadiusY = targetH * 0.44;

      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const idx = (y * targetW + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const dx = (x - centerX) / portraitRadiusX;
          const dy = (y - centerY) / portraitRadiusY;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);

          // Skin tone protection
          const isSkin =
            r > 60 &&
            g > 40 &&
            b > 20 &&
            r > g &&
            g > b &&
            r - g >= 10 &&
            r - b >= 14 &&
            distFromCenter < 1.15;

          if (isSkin) {
            continue;
          }

          const dr1 = r - avgR;
          const dg1 = g - avgG;
          const db1 = b - avgB;
          const dist1 = Math.sqrt(0.299 * dr1 * dr1 + 0.587 * dg1 * dg1 + 0.114 * db1 * db1);

          const dr2 = r - cR;
          const dg2 = g - cG;
          const db2 = b - cB;
          const dist2 = Math.sqrt(0.299 * dr2 * dr2 + 0.587 * dg2 * dg2 + 0.114 * db2 * db2);

          const minColorDist = Math.min(dist1, dist2);

          if (distFromCenter > 1.15) {
            if (minColorDist < baseDist + 22) {
              data[idx + 3] = 0;
            } else {
              const alpha = Math.max(0, Math.min(255, (minColorDist - baseDist) * 6));
              data[idx + 3] = Math.min(data[idx + 3], alpha);
            }
          } else {
            if (minColorDist < baseDist - featherBand) {
              data[idx + 3] = 0;
            } else if (minColorDist < baseDist + featherBand) {
              const ratio = (minColorDist - (baseDist - featherBand)) / (featherBand * 2);
              data[idx + 3] = Math.round(ratio * 255);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return canvas;
    },
    []
  );

  // Trigger background removal: Instant smart fallback + background AI upgrade
  const processCutout = useCallback(
    (img: HTMLImageElement, tolerance: number) => {
      // 1. Immediate instant algorithmic cutout (0ms UI freeze)
      const fastCutout = createEnhancedAlgorithmicCutout(img, tolerance);
      setCutoutImage(fastCutout);
      setAiCutoutApplied(false);

      // 2. Dynamic AI Neural Background Removal in background
      setIsAiProcessing(true);
      import("@imgly/background-removal")
        .then(async ({ removeBackground: imglyRemoveBg }) => {
          try {
            const offscreen = document.createElement("canvas");
            const maxDim = 1024;
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            offscreen.width = Math.max(1, Math.round(img.width * scale));
            offscreen.height = Math.max(1, Math.round(img.height * scale));
            const oCtx = offscreen.getContext("2d");
            if (!oCtx) {
              setIsAiProcessing(false);
              return;
            }
            oCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);

            const blob = await new Promise<Blob | null>((resolve) =>
              offscreen.toBlob(resolve, "image/png")
            );
            if (!blob) {
              setIsAiProcessing(false);
              return;
            }

            const resultBlob = await imglyRemoveBg(blob, {
              model: "small",
            });
            const resultUrl = URL.createObjectURL(resultBlob);
            const aiImg = new Image();
            aiImg.onload = () => {
              setCutoutImage(aiImg);
              setAiCutoutApplied(true);
              setIsAiProcessing(false);
            };
            aiImg.onerror = () => {
              setIsAiProcessing(false);
            };
            aiImg.src = resultUrl;
          } catch (aiErr) {
            console.warn("AI background removal fallback active:", aiErr);
            setIsAiProcessing(false);
          }
        })
        .catch((err) => {
          console.warn("Could not load AI background removal library:", err);
          setIsAiProcessing(false);
        });
    },
    [createEnhancedAlgorithmicCutout]
  );

  // Re-process cutout whenever source image changes or background removal is activated
  useEffect(() => {
    if (sourceImage && removeBackground) {
      processCutout(sourceImage, cutoutTolerance);
    } else {
      setCutoutImage(null);
      setAiCutoutApplied(false);
      setIsAiProcessing(false);
    }
  }, [sourceImage, removeBackground, processCutout]);

  // Adjust algorithmic sensitivity if AI is not applied yet
  useEffect(() => {
    if (sourceImage && removeBackground && !aiCutoutApplied && !isAiProcessing) {
      const fastCutout = createEnhancedAlgorithmicCutout(sourceImage, cutoutTolerance);
      setCutoutImage(fastCutout);
    }
  }, [
    cutoutTolerance,
    sourceImage,
    removeBackground,
    aiCutoutApplied,
    isAiProcessing,
    createEnhancedAlgorithmicCutout,
  ]);

  // Redraw Canvas with Framing, Cutout Subject, and Studio Backdrops
  // Since cutoutImage is cached, this takes <1ms and reflects instantaneously!
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
        } else if (preset.id === "velvet_purple") {
          grad.addColorStop(0, "#4c1d95");
          grad.addColorStop(1, "#8b5cf6");
        } else if (preset.id === "sunset_crimson") {
          grad.addColorStop(0, "#881337");
          grad.addColorStop(1, "#f43f5e");
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

      // Studio radial backlight: gently radiates behind subject so the chosen backdrop stands out vibrantly
      if (preset.type !== "transparent") {
        const spotGrad = ctx.createRadialGradient(
          size / 2,
          size * 0.44,
          size * 0.05,
          size / 2,
          size * 0.44,
          size * 0.72
        );
        spotGrad.addColorStop(0, "rgba(255, 255, 255, 0.28)");
        spotGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.08)");
        spotGrad.addColorStop(1, "rgba(0, 0, 0, 0.22)");
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, size, size);
      }
    }

    // 2. Draw Subject (With or without Cutout)
    if (sourceImage) {
      ctx.save();

      const useCutout = removeBackground && cutoutImage && preset.type !== "original";
      const targetImg = useCutout ? cutoutImage! : sourceImage;

      ctx.translate(size / 2 + pan.x, size / 2 + pan.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      const imgAspect = targetImg.width / targetImg.height;
      let drawW = size;
      let drawH = size;
      if (imgAspect > 1) {
        drawW = size * imgAspect;
      } else {
        drawH = size / imgAspect;
      }

      if (useCutout) {
        // Studio drop shadow: casts realistic soft 3D depth shadow behind subject onto new background
        if (studioShadow) {
          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
          ctx.shadowBlur = 24;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 12;
          ctx.drawImage(targetImg, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }

        // Subject Pop Rim Light: subtle edge illumination so dark clothing/hair does not blend into backdrops
        if (subjectPop) {
          ctx.save();
          ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.drawImage(targetImg, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }

        // Crisp subject rendering
        ctx.drawImage(targetImg, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        // Original framing without background removal
        if (preset.type !== "original" && backdropSoftness > 0) {
          const featherRadius = size * 0.48;
          const featherGrad = ctx.createRadialGradient(
            0,
            0,
            featherRadius * (backdropSoftness / 100),
            0,
            0,
            featherRadius
          );
          featherGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
          featherGrad.addColorStop(0.9, "rgba(0, 0, 0, 0.95)");
          featherGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

          const tempMask = document.createElement("canvas");
          tempMask.width = drawW;
          tempMask.height = drawH;
          const tCtx = tempMask.getContext("2d");
          if (tCtx) {
            tCtx.drawImage(targetImg, 0, 0, drawW, drawH);
            ctx.drawImage(tempMask, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            ctx.drawImage(targetImg, -drawW / 2, -drawH / 2, drawW, drawH);
          }
        } else {
          ctx.drawImage(targetImg, -drawW / 2, -drawH / 2, drawW, drawH);
        }
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

    // Immediately synchronize real-time preview data URL for live Card View & Roster Badge
    try {
      const dataUrl = canvas.toDataURL("image/png");
      setPreviewDataUrl(dataUrl);
    } catch (e) {
      // ignore
    }
  }, [
    sourceImage,
    cutoutImage,
    removeBackground,
    selectedBackdrop,
    customBgColor,
    customBackdropImage,
    zoom,
    rotation,
    pan,
    studioShadow,
    subjectPop,
    backdropSoftness,
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

            {/* Live Real-world Previews (Reflects options instantaneously) */}
            <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live App Preview
              </span>

              {/* 80px Card Preview */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-md ring-4 ring-white bg-slate-200 flex items-center justify-center">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={28} className="text-slate-400" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-400">Card View (80px)</span>
              </div>

              {/* 40px Roster Badge Preview */}
              <div className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-100 w-full">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-sm bg-slate-200 ring-2 ring-indigo-50 flex items-center justify-center">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={16} className="text-slate-400" />
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

          {/* Background Removal & Subject Isolation Banner */}
          {sourceImage && !isCameraActive && (
            <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
                  <Wand2 size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900">
                      Remove Original Background (Subject Cutout)
                    </h4>
                    {removeBackground && (
                      <>
                        {isAiProcessing ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-full animate-pulse border border-indigo-200">
                            <Loader2 size={10} className="animate-spin text-indigo-600" />
                            AI Isolating Subject...
                          </span>
                        ) : aiCutoutApplied ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Check size={10} className="text-emerald-600" />
                            AI Studio Cutout
                          </span>
                        ) : cutoutImage ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200">
                            <Sparkles size={10} className="text-amber-600" />
                            Smart Cutout Active
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Isolates the subject and cleanly applies your chosen studio backdrop
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                {removeBackground && (
                  <button
                    onClick={() => sourceImage && processCutout(sourceImage, cutoutTolerance)}
                    disabled={isAiProcessing}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline disabled:opacity-50"
                    title="Re-run subject isolation"
                  >
                    <RefreshCw size={12} className={isAiProcessing ? "animate-spin" : ""} />
                    Re-isolate
                  </button>
                )}

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

          {/* Fine Tuning Controls (Cutout Tolerance, Zoom & Subject Separation) */}
          {sourceImage && !isCameraActive && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* Visual Separation Enhancements (makes new background color pop) */}
              {removeBackground && selectedBackdrop !== "original" && (
                <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2 sm:gap-4">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Subject Pop & Depth:
                  </span>

                  <button
                    type="button"
                    onClick={() => setStudioShadow(!studioShadow)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      studioShadow
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Layers size={13} className={studioShadow ? "text-indigo-600" : "text-slate-400"} />
                    <span>3D Studio Shadow</span>
                    {studioShadow && <Check size={12} className="text-indigo-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubjectPop(!subjectPop)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      subjectPop
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Sun size={13} className={subjectPop ? "text-indigo-600" : "text-slate-400"} />
                    <span>Silhouette Edge Pop</span>
                    {subjectPop && <Check size={12} className="text-indigo-600" />}
                  </button>
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
