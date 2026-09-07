import { useTranslation } from "react-i18next";

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

function floatingTextPosition(x: number, y: number, variant?: PointText["variant"]) {
  const horizontalInset = variant === "combo" || variant === "critical" ? "min(118px, 50%)" : "min(74px, 50%)";
  return {
    left: `clamp(${horizontalInset}, ${x}px, calc(100% - ${horizontalInset}))`,
    top: `clamp(34px, ${y}px, calc(100% - 48px))`,
  };
}

export function FloatingTextLayer({
  bombTexts,
  pointTexts,
}: FloatingTextLayerProps) {
  const { t } = useTranslation();

  return (
    <>
      {bombTexts.map((text) => (
        <div key={text.id} className="bombText" style={floatingTextPosition(text.x, text.y)}>
          {t('game.bomb_explosion', 'BÙM!')}
        </div>
      ))}

      {pointTexts.map((text) => (
        <div
          key={text.id}
          className={pointTextClass(text.variant)}
          style={{ ...floatingTextPosition(text.x, text.y, text.variant), color: text.color }}
        >
          {text.text}
        </div>
      ))}
    </>
  );
}
