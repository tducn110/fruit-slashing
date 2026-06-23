interface BombText {
  x: number;
  y: number;
  id: number;
}

interface PointText {
  x: number;
  y: number;
  id: number;
  text: string;
  color: string;
  variant?: "points" | "combo" | "critical";
}

interface FloatingTextLayerProps {
  bombTexts: BombText[];
  pointTexts: PointText[];
}

function pointTextClass(variant: PointText["variant"]) {
  if (variant === "critical") return "pointText criticalText";
  if (variant === "combo") return "pointText comboFloatText";
  return "pointText";
}

export function FloatingTextLayer({
  bombTexts,
  pointTexts,
}: FloatingTextLayerProps) {
  return (
    <>
      {bombTexts.map((text) => (
        <div key={text.id} className="bombText" style={{ left: text.x, top: text.y }}>
          BÙM!
        </div>
      ))}

      {pointTexts.map((text) => (
        <div
          key={text.id}
          className={pointTextClass(text.variant)}
          style={{ left: text.x, top: text.y, color: text.color }}
        >
          {text.text}
        </div>
      ))}
    </>
  );
}
