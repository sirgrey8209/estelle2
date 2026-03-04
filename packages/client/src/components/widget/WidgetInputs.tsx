/**
 * @file WidgetInputs.tsx
 * @description InputNode를 렌더링하는 컴포넌트
 */

import { useState, useCallback, type KeyboardEvent } from 'react';
import type {
  InputNode,
  ButtonsInputNode,
  TextInputNode,
  SliderInputNode,
  ConfirmInputNode,
} from '@estelle/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface WidgetInputsProps {
  inputs: InputNode[];
  onInput: (id: string, value: unknown) => void;
  className?: string;
}

/**
 * InputNode 배열을 렌더링하는 컴포넌트
 */
export function WidgetInputs({ inputs, onInput, className }: WidgetInputsProps) {
  if (inputs.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {inputs.map((input) => (
        <WidgetInputItem key={input.id} input={input} onInput={onInput} />
      ))}
    </div>
  );
}

// ============================================================================
// Input Item Router
// ============================================================================

interface WidgetInputItemProps {
  input: InputNode;
  onInput: (id: string, value: unknown) => void;
}

function WidgetInputItem({ input, onInput }: WidgetInputItemProps) {
  switch (input.type) {
    case 'buttons':
      return <ButtonsInput input={input} onInput={onInput} />;
    case 'text':
      return <TextInput input={input} onInput={onInput} />;
    case 'slider':
      return <SliderInput input={input} onInput={onInput} />;
    case 'confirm':
      return <ConfirmInput input={input} onInput={onInput} />;
    default:
      return null;
  }
}

// ============================================================================
// Buttons Input
// ============================================================================

interface ButtonsInputProps {
  input: ButtonsInputNode;
  onInput: (id: string, value: unknown) => void;
}

function ButtonsInput({ input, onInput }: ButtonsInputProps) {
  const disabledSet = new Set(input.disabled ?? []);

  const handleClick = useCallback(
    (option: string) => {
      onInput(input.id, option);
    },
    [input.id, onInput]
  );

  return (
    <div className="flex flex-wrap gap-2">
      {input.options.map((option) => (
        <Button
          key={option}
          variant="outline"
          size="sm"
          disabled={disabledSet.has(option)}
          onClick={() => handleClick(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Text Input
// ============================================================================

interface TextInputProps {
  input: TextInputNode;
  onInput: (id: string, value: unknown) => void;
}

function TextInput({ input, onInput }: TextInputProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();
        onInput(input.id, value.trim());
        setValue('');
      }
    },
    [input.id, value, onInput]
  );

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={input.placeholder ?? '입력 후 Enter'}
      className="max-w-sm"
    />
  );
}

// ============================================================================
// Slider Input
// ============================================================================

interface SliderInputProps {
  input: SliderInputNode;
  onInput: (id: string, value: unknown) => void;
}

function SliderInput({ input, onInput }: SliderInputProps) {
  const [value, setValue] = useState(input.min);

  const handleChange = useCallback(
    (newValue: number) => {
      setValue(newValue);
      onInput(input.id, newValue);
    },
    [input.id, onInput]
  );

  return (
    <div className="flex items-center gap-3 max-w-sm">
      <input
        type="range"
        min={input.min}
        max={input.max}
        step={input.step ?? 1}
        value={value}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <span className="text-sm text-muted-foreground min-w-[3ch] text-right">
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// Confirm Input
// ============================================================================

interface ConfirmInputProps {
  input: ConfirmInputNode;
  onInput: (id: string, value: unknown) => void;
}

function ConfirmInput({ input, onInput }: ConfirmInputProps) {
  const handleClick = useCallback(() => {
    onInput(input.id, true);
  }, [input.id, onInput]);

  return (
    <Button variant="default" size="sm" onClick={handleClick}>
      {input.label}
    </Button>
  );
}
