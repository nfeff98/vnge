import { useState, useEffect, useRef } from 'react';
import { SketchPicker, type ColorResult } from 'react-color';

interface ColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ColorPickerProps {
  color: ColorValue;
  onChange: (color: ColorValue) => void;
  disabled?: boolean;
}

export default function ColorPicker({ color, onChange, disabled = false }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleChange = (colorResult: ColorResult) => {
    onChange({
      r: colorResult.rgb.r,
      g: colorResult.rgb.g,
      b: colorResult.rgb.b,
      a: colorResult.rgb.a ?? 1
    });
  };

  // Close picker when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Add listener on next tick to avoid immediate closure
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const colorString = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;

  return (
    <div className="relative nodrag">
      {/* Color preview box */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className="w-full h-8 rounded border-2 border-gray-600 cursor-pointer hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed nodrag"
        style={{ backgroundColor: colorString }}
        title={disabled ? 'Color from input' : 'Click to edit color'}
      />

      {/* Sketch picker popup */}
      {isOpen && (
        <>
          {/* Invisible backdrop to catch clicks */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          
          {/* Picker */}
          <div 
            ref={pickerRef}
            className="absolute z-50 mt-2 left-0 nodrag"
            onClick={(e) => e.stopPropagation()}
          >
            <SketchPicker
              color={{
                r: color.r,
                g: color.g,
                b: color.b,
                a: color.a
              }}
              onChange={handleChange}
              disableAlpha={false}
            />
          </div>
        </>
      )}
    </div>
  );
}

