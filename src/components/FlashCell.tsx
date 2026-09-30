import { memo, useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  value: number | null;
  children: ReactNode;
  className?: string;
  label: string;
}

type Flash = { dir: 'up' | 'down'; n: number } | null;

/**
 * A table cell that flashes green when its value rises and red when it falls.
 * The flash is a 500ms CSS fade; bumping `n` as the key restarts the animation
 * when the same cell ticks again before the previous flash finished.
 */
export const FlashCell = memo(function FlashCell({ value, children, className, label }: Props) {
  const previous = useRef(value);
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before === null || value === null || before === value) return;

    setFlash((f) => ({ dir: value > before ? 'up' : 'down', n: (f?.n ?? 0) + 1 }));
    const timer = setTimeout(() => setFlash(null), 500);
    return () => clearTimeout(timer);
  }, [value]);

  const classes = ['num', className, flash && `flash flash-${flash.dir}`].filter(Boolean).join(' ');

  return (
    <td key={flash?.n ?? 0} className={classes} data-label={label}>
      {children}
    </td>
  );
});
