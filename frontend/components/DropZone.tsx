"use client";
import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  onFile:   (file: File) => void;
  preview:  string | null;
  loading?: boolean;
}

export default function DropZone({ onFile, preview, loading = false }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);
  const angleRef  = useRef(0);
  const rafRef    = useRef<number>();
  const [dragging, setDragging] = useState(false);

  /* Animated conic-gradient border */
  useEffect(() => {
    const animate = () => {
      const speed = dragging ? 2.5 : 0.45;
      angleRef.current = (angleRef.current + speed) % 360;
      if (borderRef.current && !loading) {
        const a = dragging ? 0.9 : 0.5;
        borderRef.current.style.background = [
          "linear-gradient(#111111, #111111) padding-box",
          `conic-gradient(from ${angleRef.current}deg, transparent 60%, rgba(255,255,255,${a * 0.6}) 78%, rgba(255,255,255,${a}) 85%, rgba(255,255,255,${a * 0.6}) 92%, transparent 100%) border-box`,
        ].join(", ");
      } else if (borderRef.current && loading) {
        borderRef.current.style.background = [
          "linear-gradient(#111111, #111111) padding-box",
          "linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.12)) border-box",
        ].join(", ");
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [dragging, loading]);

  const handle = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    onFile(file);
  }, [onFile]);

  return (
    <div
      ref={borderRef}
      className="rounded-xl p-[1px] transition-all duration-300"
      style={{ border: "1px solid transparent" }}
    >
      <div
        onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!loading) {
            const f = e.dataTransfer.files[0];
            if (f) handle(f);
          }
        }}
        onClick={() => { if (!loading) inputRef.current?.click(); }}
        className="relative flex flex-col items-center justify-center rounded-[11px] overflow-hidden transition-all duration-300 min-h-[260px]"
        style={{
          background: "#111111",
          cursor: loading ? "default" : "pointer",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
        />

        {/* Scanner overlay during loading */}
        {loading && <div className="scanner-line" />}

        {preview ? (
          <div className="flex flex-col items-center gap-2 w-full p-4">
            <img
              src={preview}
              alt="preview"
              className="max-h-[200px] max-w-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {!loading && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)" }}>
                clic para cambiar
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 select-none px-8 py-10">
            {/* Upload icon con animación float */}
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center ${dragging ? "" : "icon-float"}`}
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", transition: "transform 0.3s, border-color 0.3s", borderColor: dragging ? "rgba(255,255,255,0.35)" : undefined }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragging ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.3s" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center flex flex-col gap-1">
              <span
                className="block text-sm font-medium"
                style={{ color: dragging ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)" }}
              >
                {dragging ? "Suelta la imagen" : "Arrastra una imagen"}
              </span>
              <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.22)" }}>
                o haz clic para seleccionar
              </span>
            </div>
            <div className="flex gap-2">
              {["PNG", "JPG", "BMP", "TIFF"].map((ext) => (
                <span
                  key={ext}
                  style={{
                    fontSize: 9,
                    padding: "2px 8px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 4,
                    color: "rgba(255,255,255,0.22)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
