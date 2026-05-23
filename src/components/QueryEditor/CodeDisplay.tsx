interface CodeDisplayProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
}

export function CodeDisplay({ value, onChange, disabled, placeholder }: CodeDisplayProps) {
  return (
    <div className="flex-1 overflow-auto bg-surface-container-lowest p-4 font-code-md text-code-md">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        className={`w-full h-full bg-transparent resize-none outline-none font-code-md text-code-md leading-[24px] ${disabled ? 'text-outline opacity-50' : 'text-on-surface-variant'}`}
        placeholder={placeholder}
      />
    </div>
  );
}
