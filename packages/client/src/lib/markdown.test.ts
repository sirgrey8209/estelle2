import { describe, it, expect, vi } from 'vitest';
import { parseMarkdown, renderInlineStyles, MarkdownElement, MarkdownContent } from './markdown';
import { render } from '@testing-library/react';
import { createElement } from 'react';

describe('renderInlineStyles - links', () => {
  it('should parse web link [text](https://url)', () => {
    const result = renderInlineStyles('Check [Google](https://google.com) now');
    const { container } = render(createElement('div', null, result));

    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.textContent).toBe('Google');
    expect(link?.getAttribute('href')).toBe('https://google.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should parse http link', () => {
    const result = renderInlineStyles('Visit [Site](http://example.com)');
    const { container } = render(createElement('div', null, result));

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('http://example.com');
  });

  it('should parse file path link', () => {
    const onFilePathClick = vi.fn();
    const result = renderInlineStyles('Open [config](/home/user/config.ts)', onFilePathClick);
    const { container } = render(createElement('div', null, result));

    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain('config');
  });

  it('should handle multiple links in one line', () => {
    const result = renderInlineStyles('[A](https://a.com) and [B](https://b.com)');
    const { container } = render(createElement('div', null, result));

    const links = container.querySelectorAll('a');
    expect(links.length).toBe(2);
  });

  it('should handle link with inline styles', () => {
    const result = renderInlineStyles('**Bold** and [Link](https://test.com)');
    const { container } = render(createElement('div', null, result));

    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('a')).toBeTruthy();
  });

  it('should NOT parse links inside backticks as links', () => {
    const result = renderInlineStyles('Use `[text](url)` syntax');
    const { container } = render(createElement('div', null, result));

    // Should render as code, not as a link
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('code')).toBeTruthy();
    expect(container.querySelector('code')?.textContent).toBe('[text](url)');
  });
});

describe('parseMarkdown - tables', () => {
  it('should parse simple table', () => {
    const input = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;

    const result = parseMarkdown(input);

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('table');
    expect(result[0].headers).toEqual(['Header 1', 'Header 2']);
    expect(result[0].rows).toEqual([['Cell 1', 'Cell 2']]);
  });

  it('should parse table with multiple rows', () => {
    const input = `| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |`;

    const result = parseMarkdown(input);

    expect(result[0].rows?.length).toBe(2);
    expect(result[0].rows?.[0]).toEqual(['1', '2']);
    expect(result[0].rows?.[1]).toEqual(['3', '4']);
  });

  it('should handle table with alignment markers', () => {
    const input = `| Left | Center | Right |
|:-----|:------:|------:|
| L    | C      | R     |`;

    const result = parseMarkdown(input);

    expect(result[0].type).toBe('table');
    expect(result[0].headers).toEqual(['Left', 'Center', 'Right']);
  });

  it('should handle empty cells', () => {
    const input = `| A | B |
|---|---|
|   | X |`;

    const result = parseMarkdown(input);

    expect(result[0].rows?.[0]).toEqual(['', 'X']);
  });

  it('should handle pipe characters inside backticks in cells', () => {
    const input = `| Feature | Syntax |
|---------|--------|
| Table | \`| col | col |\` |`;

    const result = parseMarkdown(input);

    expect(result[0].type).toBe('table');
    expect(result[0].headers).toEqual(['Feature', 'Syntax']);
    expect(result[0].rows?.length).toBe(1);
    expect(result[0].rows?.[0]).toEqual(['Table', '`| col | col |`']);
  });

  it('should not parse incomplete table (no separator)', () => {
    const input = `| Not | A | Table |
| Just | Pipes |`;

    const result = parseMarkdown(input);

    // Should be paragraphs, not a table
    expect(result.every(e => e.type === 'paragraph')).toBe(true);
  });

  it('should parse table surrounded by other content', () => {
    const input = `Some text

| H1 | H2 |
|----|---|
| A  | B |

More text`;

    const result = parseMarkdown(input);

    expect(result[0].type).toBe('paragraph');
    expect(result[2].type).toBe('table');
    expect(result[4].type).toBe('paragraph');
  });
});

describe('MarkdownElement - table rendering', () => {
  it('should render table with headers and rows', () => {
    const element = {
      type: 'table' as const,
      content: '',
      headers: ['Name', 'Value'],
      rows: [['A', '1'], ['B', '2']],
    };

    const { container } = render(createElement(MarkdownElement, { element }));

    const table = container.querySelector('table');
    expect(table).toBeTruthy();

    const ths = container.querySelectorAll('th');
    expect(ths.length).toBe(2);
    expect(ths[0].textContent).toBe('Name');
    expect(ths[1].textContent).toBe('Value');

    const tds = container.querySelectorAll('td');
    expect(tds.length).toBe(4);
  });

  it('should apply select-text class to cells', () => {
    const element = {
      type: 'table' as const,
      content: '',
      headers: ['H'],
      rows: [['C']],
    };

    const { container } = render(createElement(MarkdownElement, { element }));

    const th = container.querySelector('th');
    const td = container.querySelector('td');

    expect(th?.className).toContain('select-text');
    expect(td?.className).toContain('select-text');
  });

  it('should render inline styles in table cells', () => {
    const element = {
      type: 'table' as const,
      content: '',
      headers: ['**Bold Header**'],
      rows: [['`code`']],
    };

    const { container } = render(createElement(MarkdownElement, { element }));

    expect(container.querySelector('th strong')).toBeTruthy();
    expect(container.querySelector('td code')).toBeTruthy();
  });
});

describe('MarkdownContent - integration', () => {
  it('should render mixed content with table and links', () => {
    const content = `# Title

Check [docs](https://docs.com) for info.

| Feature | Status |
|---------|--------|
| Tables  | Done   |
| Links   | Done   |

Open [config](/etc/config.ts) to edit.`;

    const onFilePathClick = vi.fn();
    const { container } = render(
      createElement(MarkdownContent, { content, onFilePathClick })
    );

    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelectorAll('a').length).toBe(1);
    expect(container.querySelectorAll('button').length).toBe(1); // file link
  });

  it('should call onFilePathClick when file link clicked', () => {
    const content = 'Open [file](/path/to/file.ts)';
    const onFilePathClick = vi.fn();

    const { container } = render(
      createElement(MarkdownContent, { content, onFilePathClick })
    );

    const button = container.querySelector('button');
    button?.click();

    expect(onFilePathClick).toHaveBeenCalledWith('/path/to/file.ts');
  });
});
