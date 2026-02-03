import React, { useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface MarkdownViewerProps {
  /** 마크다운 내용 */
  content: string;
  /** 파일명 */
  filename: string;
}

/**
 * 마크다운 뷰어 (v1 Flutter MarkdownViewer 대응)
 *
 * 기본적인 마크다운 렌더링 지원:
 * - 제목 (# ~ ####)
 * - 강조 (**bold**, *italic*)
 * - 코드 블록 (```)
 * - 인라인 코드 (`)
 * - 목록 (-, *, 1.)
 * - 인용 (>)
 * - 구분선 (---, ***)
 *
 * TODO: react-native-markdown-display 패키지로 전체 마크다운 지원
 */
export function MarkdownViewer({ content, filename }: MarkdownViewerProps) {
  const theme = useTheme();
  // 마크다운 파싱
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {elements.map((element, index) => (
          <MarkdownElement key={index} element={element} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * 마크다운 요소 타입
 */
type MarkdownElementType =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'paragraph'
  | 'code_block'
  | 'blockquote'
  | 'list_item'
  | 'ordered_list_item'
  | 'hr'
  | 'empty';

interface ParsedElement {
  type: MarkdownElementType;
  content: string;
  language?: string; // 코드 블록용
}

/**
 * 마크다운 파싱
 */
function parseMarkdown(content: string): ParsedElement[] {
  const lines = content.split('\n');
  const elements: ParsedElement[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 코드 블록 시작/끝
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push({
          type: 'code_block',
          content: codeBlockContent.trim(),
          language: codeBlockLanguage,
        });
        codeBlockContent = '';
        codeBlockLanguage = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // 빈 줄
    if (!line.trim()) {
      elements.push({ type: 'empty', content: '' });
      continue;
    }

    // 구분선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push({ type: 'hr', content: '' });
      continue;
    }

    // 제목
    const h4Match = line.match(/^####\s+(.+)/);
    if (h4Match) {
      elements.push({ type: 'h4', content: h4Match[1] });
      continue;
    }
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      elements.push({ type: 'h3', content: h3Match[1] });
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      elements.push({ type: 'h2', content: h2Match[1] });
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      elements.push({ type: 'h1', content: h1Match[1] });
      continue;
    }

    // 인용
    const quoteMatch = line.match(/^>\s*(.+)/);
    if (quoteMatch) {
      elements.push({ type: 'blockquote', content: quoteMatch[1] });
      continue;
    }

    // 비순서 목록
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      elements.push({ type: 'list_item', content: ulMatch[1] });
      continue;
    }

    // 순서 목록
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      elements.push({ type: 'ordered_list_item', content: olMatch[1] });
      continue;
    }

    // 일반 단락
    elements.push({ type: 'paragraph', content: line });
  }

  return elements;
}

/**
 * 마크다운 요소 렌더링
 */
function MarkdownElement({ element }: { element: ParsedElement }) {
  const theme = useTheme();

  switch (element.type) {
    case 'h1':
      return (
        <Text variant="headlineSmall" style={{ marginTop: 16, marginBottom: 8 }}>
          {renderInlineStyles(element.content, theme)}
        </Text>
      );
    case 'h2':
      return (
        <Text variant="titleLarge" style={{ marginTop: 12, marginBottom: 8 }}>
          {renderInlineStyles(element.content, theme)}
        </Text>
      );
    case 'h3':
      return (
        <Text variant="titleMedium" style={{ marginTop: 12, marginBottom: 4 }}>
          {renderInlineStyles(element.content, theme)}
        </Text>
      );
    case 'h4':
      return (
        <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4, opacity: 0.8 }}>
          {renderInlineStyles(element.content, theme)}
        </Text>
      );
    case 'paragraph':
      return (
        <Text variant="bodyMedium" style={{ lineHeight: 24, marginBottom: 8, opacity: 0.8 }} selectable>
          {renderInlineStyles(element.content, theme)}
        </Text>
      );
    case 'code_block':
      return (
        <View
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
          }}
        >
          {element.language && (
            <Text variant="labelSmall" style={{ opacity: 0.6, marginBottom: 8 }}>
              {element.language}
            </Text>
          )}
          <Text
            variant="bodySmall"
            style={{ fontFamily: 'monospace' }}
            selectable
          >
            {element.content}
          </Text>
        </View>
      );
    case 'blockquote':
      return (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: theme.colors.primary,
            paddingLeft: 12,
            marginVertical: 8,
          }}
        >
          <Text variant="bodyMedium" style={{ fontStyle: 'italic', opacity: 0.8 }} selectable>
            {renderInlineStyles(element.content, theme)}
          </Text>
        </View>
      );
    case 'list_item':
      return (
        <View style={{ flexDirection: 'row', marginLeft: 8, marginBottom: 4 }}>
          <Text style={{ color: theme.colors.primary, marginRight: 8 }}>•</Text>
          <Text variant="bodyMedium" style={{ flex: 1, opacity: 0.8 }} selectable>
            {renderInlineStyles(element.content, theme)}
          </Text>
        </View>
      );
    case 'ordered_list_item':
      return (
        <View style={{ flexDirection: 'row', marginLeft: 8, marginBottom: 4 }}>
          <Text style={{ color: theme.colors.primary, marginRight: 8 }}>-</Text>
          <Text variant="bodyMedium" style={{ flex: 1, opacity: 0.8 }} selectable>
            {renderInlineStyles(element.content, theme)}
          </Text>
        </View>
      );
    case 'hr':
      return (
        <View
          style={{
            height: 1,
            backgroundColor: theme.colors.outlineVariant,
            marginVertical: 16,
          }}
        />
      );
    case 'empty':
      return <View style={{ height: 8 }} />;
    default:
      return null;
  }
}

/**
 * 인라인 스타일 렌더링 (bold, italic, code)
 */
function renderInlineStyles(text: string, theme: ReturnType<typeof useTheme>): React.ReactNode {
  // 간단한 구현 - 완전한 파싱은 markdown 라이브러리 사용 권장
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // **bold** 처리
  while (remaining.includes('**')) {
    const start = remaining.indexOf('**');
    const end = remaining.indexOf('**', start + 2);

    if (end === -1) break;

    if (start > 0) {
      parts.push(remaining.slice(0, start));
    }

    parts.push(
      <Text key={key++} style={{ fontWeight: 'bold' }}>
        {remaining.slice(start + 2, end)}
      </Text>
    );

    remaining = remaining.slice(end + 2);
  }

  // *italic* 처리 (bold 처리 후 남은 부분)
  let italicRemaining = remaining;
  const italicParts: React.ReactNode[] = [];

  while (italicRemaining.includes('*')) {
    const start = italicRemaining.indexOf('*');
    const end = italicRemaining.indexOf('*', start + 1);

    if (end === -1) break;

    if (start > 0) {
      italicParts.push(italicRemaining.slice(0, start));
    }

    italicParts.push(
      <Text key={key++} style={{ fontStyle: 'italic' }}>
        {italicRemaining.slice(start + 1, end)}
      </Text>
    );

    italicRemaining = italicRemaining.slice(end + 1);
  }

  if (italicParts.length > 0) {
    italicParts.push(italicRemaining);
    parts.push(...italicParts);
  } else if (remaining) {
    parts.push(remaining);
  }

  // `code` 처리
  const finalParts: React.ReactNode[] = [];
  for (const part of parts) {
    if (typeof part === 'string' && part.includes('`')) {
      let codePart = part;
      while (codePart.includes('`')) {
        const start = codePart.indexOf('`');
        const end = codePart.indexOf('`', start + 1);

        if (end === -1) {
          finalParts.push(codePart);
          codePart = '';
          break;
        }

        if (start > 0) {
          finalParts.push(codePart.slice(0, start));
        }

        finalParts.push(
          <Text
            key={key++}
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              paddingHorizontal: 4,
              borderRadius: 4,
              color: theme.colors.primary,
              fontFamily: 'monospace',
            }}
          >
            {codePart.slice(start + 1, end)}
          </Text>
        );

        codePart = codePart.slice(end + 1);
      }
      if (codePart) {
        finalParts.push(codePart);
      }
    } else {
      finalParts.push(part);
    }
  }

  return finalParts.length > 0 ? finalParts : text;
}
