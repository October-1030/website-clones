"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, LockKeyhole, RotateCcw, Upload } from "lucide-react";
import { portraitCropRect, portraitStyles, validatePortraitFile, type PortraitStyle } from "@/lib/portrait";

export default function PortraitWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [style, setStyle] = useState<PortraitStyle>("classic");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function selectFile(file: File | undefined) {
    if (!file) return;
    const message = validatePortraitFile(file);
    if (message) {
      setError(message);
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setError(null);
    onToast("Image loaded locally");
  }

  function reset() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setFileName("");
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setError(null);
  }

  function exportPortrait() {
    const image = imageRef.current;
    if (!image || !image.complete || !image.naturalWidth) {
      setError("Wait for the image to finish loading.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 800;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("This browser cannot prepare the image.");
      return;
    }
    const current = portraitStyles[style];
    const crop = portraitCropRect(image.naturalWidth, image.naturalHeight, zoom, offsetX, offsetY);
    context.fillStyle = current.background;
    context.fillRect(0, 0, 800, 800);
    context.filter = current.filter;
    context.drawImage(image, crop.sx, crop.sy, crop.size, crop.size, 0, 0, 800, 800);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("The image could not be exported.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `studypal-${style}-portrait.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      onToast("800 × 800 portrait exported");
    }, "image/png");
  }

  const selected = portraitStyles[style];
  return <section className="portrait-workspace" aria-labelledby="portrait-title">
    <header><span className="everywhere-kicker">Private local portrait studio</span><h2 id="portrait-title"><ImageIcon size={20} />Prepare a professional profile photo</h2><p>Crop, position, and style a photo entirely in this browser. This is not AI face generation, and your image is never uploaded or saved by StudyPal.</p></header>
    <div className="portrait-policy"><LockKeyhole size={15} /><span>Local-only processing · no biometric upload · no account access · exported file is yours to review</span></div>
    {!imageUrl ? <label className="portrait-dropzone"><Upload size={22} /><strong>Choose a portrait photo</strong><span>JPEG, PNG, or WebP · up to 10 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} /></label> : <div className="portrait-editor">
      <div className="portrait-preview" style={{ background: selected.background }}><img ref={imageRef} src={imageUrl} alt="Local portrait preview" style={{ filter: selected.filter, transform: `scale(${zoom})`, objectPosition: `${50 + offsetX * 0.25}% ${50 + offsetY * 0.25}%` }} /></div>
      <div className="portrait-controls"><div className="portrait-file"><strong>{fileName}</strong><button type="button" onClick={reset}><RotateCcw size={13} />Choose another</button></div><fieldset><legend>Style</legend><div className="portrait-styles">{(Object.keys(portraitStyles) as PortraitStyle[]).map((key) => <button type="button" key={key} className={style === key ? "portrait-style-active" : ""} onClick={() => setStyle(key)}><strong>{portraitStyles[key].label}</strong><span>{portraitStyles[key].description}</span></button>)}</div></fieldset><label>Zoom <output>{zoom.toFixed(1)}×</output><input type="range" min="1" max="2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label>Horizontal position<input type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label><label>Vertical position<input type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label><button type="button" className="portrait-export" onClick={exportPortrait}><Download size={15} />Export 800 × 800 PNG</button></div>
    </div>}
    {error && <div className="portrait-error" role="alert">{error}</div>}
  </section>;
}
