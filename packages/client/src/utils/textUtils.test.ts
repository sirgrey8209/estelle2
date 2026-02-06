import { describe, it, expect } from 'vitest';
import { removeSystemReminder, diffLines } from './textUtils';

describe('removeSystemReminder', () => {
  it('should remove single system-reminder tag', () => {
    const input = 'Hello <system-reminder>some content</system-reminder> World';
    const result = removeSystemReminder(input);
    expect(result).toBe('Hello  World');
  });

  it('should remove multiple system-reminder tags', () => {
    const input = '<system-reminder>first</system-reminder>Text<system-reminder>second</system-reminder>';
    const result = removeSystemReminder(input);
    expect(result).toBe('Text');
  });

  it('should handle multiline content in system-reminder', () => {
    const input = `File content
<system-reminder>
This is a
multiline reminder
</system-reminder>
More content`;
    const result = removeSystemReminder(input);
    expect(result).toBe(`File content

More content`);
  });

  it('should return original text if no system-reminder', () => {
    const input = 'Just plain text';
    const result = removeSystemReminder(input);
    expect(result).toBe('Just plain text');
  });

  it('should handle empty string', () => {
    const result = removeSystemReminder('');
    expect(result).toBe('');
  });
});

describe('diffLines', () => {
  it('should return same for identical lines', () => {
    const result = diffLines('line1\nline2', 'line1\nline2');
    expect(result).toEqual([
      { type: 'same', text: 'line1' },
      { type: 'same', text: 'line2' },
    ]);
  });

  it('should detect added lines', () => {
    const result = diffLines('line1', 'line1\nline2');
    expect(result).toEqual([
      { type: 'same', text: 'line1' },
      { type: 'add', text: 'line2' },
    ]);
  });

  it('should detect removed lines', () => {
    const result = diffLines('line1\nline2', 'line1');
    expect(result).toEqual([
      { type: 'same', text: 'line1' },
      { type: 'remove', text: 'line2' },
    ]);
  });

  it('should detect changed lines', () => {
    const result = diffLines('old line', 'new line');
    expect(result).toEqual([
      { type: 'remove', text: 'old line' },
      { type: 'add', text: 'new line' },
    ]);
  });

  it('should handle complex diff', () => {
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\nmodified\nline3\nline4';
    const result = diffLines(oldText, newText);

    // line1: same
    expect(result[0]).toEqual({ type: 'same', text: 'line1' });
    // line2 removed, modified added
    expect(result.some(d => d.type === 'remove' && d.text === 'line2')).toBe(true);
    expect(result.some(d => d.type === 'add' && d.text === 'modified')).toBe(true);
    // line3: same
    expect(result.some(d => d.type === 'same' && d.text === 'line3')).toBe(true);
    // line4: added
    expect(result.some(d => d.type === 'add' && d.text === 'line4')).toBe(true);
  });

  it('should handle empty old text', () => {
    const result = diffLines('', 'new line');
    // split('')는 ['']를 반환하므로 빈 줄이 remove로 나옴
    expect(result).toEqual([
      { type: 'remove', text: '' },
      { type: 'add', text: 'new line' },
    ]);
  });

  it('should handle empty new text', () => {
    const result = diffLines('old line', '');
    // split('')는 ['']를 반환하므로 빈 줄이 add로 나옴
    expect(result).toEqual([
      { type: 'remove', text: 'old line' },
      { type: 'add', text: '' },
    ]);
  });

  it('should handle both empty', () => {
    const result = diffLines('', '');
    // 둘 다 빈 문자열이면 ['']와 ['']를 비교하므로 same
    expect(result).toEqual([
      { type: 'same', text: '' },
    ]);
  });
});
