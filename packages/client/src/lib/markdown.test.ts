import { describe, it, expect, vi } from 'vitest';
import { parseMarkdown, renderInlineStyles } from './markdown';
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
});
