interface CountdownOverlayProps {
  countdown: number | null;
  starting: boolean;
}

export function CountdownOverlay({ countdown, starting }: CountdownOverlayProps) {
  if (countdown === null && !starting) return null;

  return (
    <div className="countdownOverlay">
      <div className="countdownNumber">{starting ? "…" : countdown}</div>
    </div>
  );
}
