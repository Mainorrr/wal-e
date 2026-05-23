interface MaterialSymbolProps {
  icon: string;
  filled?: boolean;
  className?: string;
  size?: number;
}

export function MaterialSymbol({ icon, filled = false, className = '', size = 24 }: MaterialSymbolProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        fontSize: size,
      }}
    >
      {icon}
    </span>
  );
}