import React from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

interface PanelFrameProps {
  title: React.ReactNode;
  width?: number;
  maxHeight?: string;
  onClose: () => void;
  showClose?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function PanelFrame({
  title,
  width = 340,
  maxHeight,
  onClose,
  showClose = true,
  className = "",
  style,
  children,
}: PanelFrameProps) {
  return (
    <div className={className} style={{
      position: "absolute", top: 12, right: 12,
      background: "rgba(255,255,255,0.97)",
      border: "1.5px solid var(--border)",
      borderRadius: 16,
      padding: "20px 24px",
      width,
      maxWidth: "calc(100vw - 24px)",
      maxHeight,
      overflowY: maxHeight ? "auto" : undefined,
      boxShadow: "0 12px 32px rgba(42,36,24,0.2)",
      fontFamily: "var(--font-family)",
      zIndex: 20,
      ...style,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>{title}</span>
        {showClose && <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "linear-gradient(180deg, #ffd75e, #fdbb2d)",
            border: "2px solid #e09f1f",
            color: "#fff",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(253, 187, 45, 0.4)",
          }}
        >
          <X size={16} strokeWidth={3} />
        </button>}
      </div>
      {children}
    </div>
  );
}
