import { MarkdownContent } from '../../lib/markdown';

interface StreamingBubbleProps {
  text: string;
}

/**
 * 스트리밍 버블
 *
 * Claude의 응답이 스트리밍될 때 표시됩니다.
 */
export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <div
      className="my-0.5 ml-2 pl-1.5 pr-2 border-l-2 border-transparent max-w-[90%]"
    >
      <MarkdownContent content={text} showCursor />
    </div>
  );
}
