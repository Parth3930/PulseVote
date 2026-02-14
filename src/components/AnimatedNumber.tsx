import { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 500,
  className = "",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValueRef = useRef(value);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const previousValue = previousValueRef.current;

    if (previousValue !== value) {
      setIsAnimating(true);
      const startTime = Date.now();
      const startValue = previousValue; // Use previous value, not displayValue
      const change = value - startValue;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = startValue + change * easeOutQuart;

        setDisplayValue(currentValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          setDisplayValue(value);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
      previousValueRef.current = value;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]); // Remove displayValue from dependencies

  return (
    <span
      className={`tabular-nums transition-transform duration-150 ${
        isAnimating ? "scale-110" : "scale-100"
      } ${className}`}
    >
      {Math.round(displayValue)}
    </span>
  );
}
