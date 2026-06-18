import React from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export interface PanelFrameProps {
  title: React.ReactNode;
  width?: number;
  maxHeight?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function PanelFrame({
  title,
  width = 340,
  maxHeight,
  onClose,
  children,
}: PanelFrameProps) {
  return (
    <div style={{
      position: "absolute", top: 12, right: 12,
      background: "rgba(255,255,255,0.97)",
      border: "1.5px solid var(--border)",
      borderRadius: 16,
      padding: "20px 24px",
      width,
      maxHeight,
      overflowY: maxHeight ? "auto" : undefined,
      boxShadow: "0 12px 32px rgba(42,36,24,0.2)",
      fontFamily: "var(--font-family)",
      zIndex: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>{title}</span>
        <IconButton label="Đóng" onClick={onClose} variant="ghost">
          <X size={16} />
        </IconButton>
      </div>
      {children}
    </div>
  );
}
