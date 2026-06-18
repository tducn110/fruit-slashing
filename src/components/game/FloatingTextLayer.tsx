export interface BombText {
  x: number;
  y: number;
  id: number;
}

export interface PointText {
  x: number;
  y: number;
  id: number;
  text: string;
  color: string;
}

interface FloatingTextLayerProps {
  bombTexts: BombText[];
  pointTexts: PointText[];
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
          className="pointText"
          style={{ left: text.x, top: text.y, color: text.color }}
        >
          {text.text}
        </div>
      ))}
    </>
  );
}
