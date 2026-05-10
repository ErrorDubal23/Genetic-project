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
    <div className="rounded-lg border border-[#1e293b] bg-[#0b1120] overflow-hidden">
      {/* Barra estilo Mac */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#0f172a] border-b border-[#1e293b]">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-[#475569] font-medium tracking-wide uppercase">
          Cargar imagen
        </span>
      </div>

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
          transition-all duration-300 min-h-[240px] p-6
          ${dragging
            ? "border-2 border-dashed border-[#3b82f6] bg-[#1e3a5f]/20"
            : "border-2 border-dashed border-[#334155] hover:border-[#475569] hover:bg-[#0f172a]/50"
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
          <div className="flex flex-col items-center gap-3 w-full">
            <img
              src={preview}
              alt="preview"
              className="max-h-[200px] max-w-full object-contain rounded-md shadow-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-[11px] text-[#64748b]">
              Haz clic para cambiar la imagen
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 select-none">
            <div className="w-14 h-14 rounded-xl bg-[#1e293b] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <span className="text-sm text-[#cbd5e1] font-medium block">
                Arrastra una imagen aqui
              </span>
              <span className="text-xs text-[#475569] mt-1 block">
                o haz clic para seleccionar
              </span>
            </div>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] px-2 py-1 rounded bg-[#1e293b] text-[#64748b]">PNG</span>
              <span className="text-[10px] px-2 py-1 rounded bg-[#1e293b] text-[#64748b]">JPG</span>
              <span className="text-[10px] px-2 py-1 rounded bg-[#1e293b] text-[#64748b]">BMP</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
