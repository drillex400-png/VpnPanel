import { useEffect, useRef } from "react";
import { animate, useMotionValue, useTransform, motion } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

/**
 * Smoothly counts a number from its previous value to the new one instead of snapping
 * instantly. Used for live metric cards (CPU%, RAM, disk...) that update every 4s over the
 * WebSocket stream -- an instant digit swap every 4s read as "flickery"; animating the
 * transition makes updates feel like telemetry settling rather than the UI blinking.
 */
export function AnimatedNumber({ value, decimals = 0, suffix = "", className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (v) => `${v.toFixed(decimals)}${suffix}`);
  const prevValue = useRef(value);

  useEffect(() => {
    // Skip animating on first mount -- only animate real value *changes*.
    if (prevValue.current === value) return;
    const controls = animate(motionValue, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    prevValue.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
