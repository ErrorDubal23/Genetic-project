"use client";
import { useRef, useState, useCallback } from "react";

interface Props {
  onFile: (file: File) => void;
  preview: string | null;
}

export default function DropZone({ onFile, preview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handle(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center cursor-pointer
        rounded border transition-colors duration-200 min-h-[220px]
        ${dragging
          ? "border-white bg-white/5"
          : "border-[#2a2a2a] bg-[#141414] hover:border-[#444]"
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />

      {preview ? (
        <img
          src={preview}
          alt="preview"
          className="max-h-[200px] max-w-full object-contain rounded"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 select-none text-[#555]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="text-sm">Arrastra una imagen o haz clic</span>
          <span className="text-xs text-[#333]">PNG, JPG, BMP, TIFF</span>
        </div>
      )}

      {preview && (
        <div className="absolute bottom-2 right-2 text-[10px] text-[#444]">
          clic para cambiar
        </div>
      )}
    </div>
  );
}
