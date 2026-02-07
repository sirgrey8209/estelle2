import { useState } from 'react';
import { Send, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import type { QuestionRequest as QuestionRequestType } from '@estelle/core';

interface QuestionRequestProps {
  request: QuestionRequestType;
  onAnswer?: (answer: string) => void;
}

/**
 * 질문 요청 뷰 (탭 형태로 여러 질문 지원, multiSelect 지원)
 */
export function QuestionRequest({ request, onAnswer }: QuestionRequestProps) {
  const { questions } = request;
  const [activeTab, setActiveTab] = useState(0);
  // 옵션 선택 (multiSelect일 때 배열)
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>({});
  // 직접 입력 (질문당 하나만)
  const [customValues, setCustomValues] = useState<Record<number, string>>({});
  const [customInput, setCustomInput] = useState('');

  const currentQuestion = questions[activeTab];
  const isMultiSelect = currentQuestion?.multiSelect === true;

  // 현재 선택된 옵션들
  const currentOptions = selectedOptions[activeTab] || [];
  // 현재 직접 입력값
  const currentCustom = customValues[activeTab];

  // 답변 완료 여부 체크
  const allAnswered = questions.every((_, i) => {
    const opts = selectedOptions[i] || [];
    const custom = customValues[i];
    return opts.length > 0 || !!custom;
  });

  const goToNextUnanswered = () => {
    const nextUnanswered = questions.findIndex((_, i) => {
      if (i <= activeTab) return false;
      const opts = selectedOptions[i] || [];
      const custom = customValues[i];
      return opts.length === 0 && !custom;
    });
    if (nextUnanswered !== -1) {
      setActiveTab(nextUnanswered);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (isMultiSelect) {
      // 토글
      setSelectedOptions(prev => {
        const current = prev[activeTab] || [];
        const index = current.indexOf(option);
        if (index === -1) {
          return { ...prev, [activeTab]: [...current, option] };
        } else {
          return { ...prev, [activeTab]: current.filter(o => o !== option) };
        }
      });
    } else {
      // 단일 선택: 옵션 선택 시 직접 입력값 제거
      setSelectedOptions(prev => ({ ...prev, [activeTab]: [option] }));
      setCustomValues(prev => ({ ...prev, [activeTab]: '' }));
      goToNextUnanswered();
    }
  };

  const handleCustomSubmit = () => {
    const value = customInput.trim();
    if (value) {
      // 직접 입력값 설정 (하나만)
      setCustomValues(prev => ({ ...prev, [activeTab]: value }));
      if (!isMultiSelect) {
        // 단일 선택: 직접 입력 시 옵션 선택 제거
        setSelectedOptions(prev => ({ ...prev, [activeTab]: [] }));
        goToNextUnanswered();
      }
      setCustomInput('');
    }
  };

  const handleRemoveCustom = () => {
    setCustomValues(prev => ({ ...prev, [activeTab]: '' }));
  };

  const handleSubmitAll = () => {
    if (!allAnswered) return;

    // 답변 포맷: "질문1"="답변1", "질문2"="답변2"
    const formattedAnswer = questions
      .map((q, i) => {
        const opts = selectedOptions[i] || [];
        const custom = customValues[i];
        const allValues = custom ? [...opts, custom] : opts;
        const answerText = allValues.join(', ');
        return `"${q.header || q.question}"="${answerText}"`;
      })
      .join(', ');

    onAnswer?.(formattedAnswer);
  };

  return (
    <div className="p-3 bg-blue-500/10">
      {/* 탭 헤더 + 전송 버튼 */}
      <div className="flex items-center gap-1 mb-3">
        {questions.map((q, i) => {
          const isActive = activeTab === i;
          const opts = selectedOptions[i] || [];
          const custom = customValues[i];
          const isAnswered = opts.length > 0 || !!custom;
          return (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={cn(
                'px-3 py-1 text-sm rounded-t border-b-2 transition-colors flex items-center gap-1',
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-background'
                  : 'border-transparent hover:bg-muted/50',
                isAnswered && !isActive && 'text-green-600 dark:text-green-400'
              )}
            >
              {isAnswered && <Check className="h-3 w-3" />}
              {q.header || `Q${i + 1}`}
            </button>
          );
        })}
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={handleSubmitAll}
          disabled={!allAnswered}
          className="shrink-0"
        >
          <Send className="h-4 w-4 mr-1" />
          전송
        </Button>
      </div>

      {/* 현재 질문 */}
      {currentQuestion && (
        <div className="space-y-3">
          <p className="text-sm">
            {currentQuestion.question}
            {isMultiSelect && <span className="ml-1 text-xs text-muted-foreground">(복수 선택)</span>}
          </p>

          {/* 옵션 버튼들 */}
          {currentQuestion.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected = currentOptions.includes(option);
                return (
                  <button
                    key={optionIndex}
                    onClick={() => handleOptionSelect(option)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1',
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-400'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {/* 직접 입력된 값 표시 */}
          {currentCustom && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRemoveCustom}
                className="px-3 py-1.5 text-sm rounded-full border border-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center gap-1"
              >
                {currentCustom}
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* 직접 입력 */}
          <div className="flex gap-2">
            <Input
              placeholder="직접 입력..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCustomSubmit();
                }
              }}
              className="flex-1"
            />
            {customInput.trim() && (
              <Button variant="ghost" onClick={handleCustomSubmit}>
                확인
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
