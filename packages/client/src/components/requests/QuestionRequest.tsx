import React, { useState } from 'react';
import { View } from 'react-native';
import { Text, Button, TextInput, Chip, useTheme } from 'react-native-paper';
import type { QuestionRequest as QuestionRequestType } from '../../stores/claudeStore';
import { semanticColors } from '../../theme';

interface QuestionRequestProps {
  request: QuestionRequestType;
  onAnswer?: (answer: string) => void;
}

/**
 * 질문 요청 뷰
 */
export function QuestionRequest({ request, onAnswer }: QuestionRequestProps) {
  const theme = useTheme();
  const [customAnswer, setCustomAnswer] = useState('');

  const handleOptionSelect = (option: string) => {
    onAnswer?.(option);
  };

  const handleCustomSubmit = () => {
    if (customAnswer.trim()) {
      onAnswer?.(customAnswer.trim());
      setCustomAnswer('');
    }
  };

  return (
    <View style={{ padding: 12, backgroundColor: semanticColors.infoContainer }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: semanticColors.info,
            marginRight: 8,
          }}
        />
        <Text variant="titleSmall" style={{ color: semanticColors.info }}>
          질문
        </Text>
      </View>

      <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
        {request.question}
      </Text>

      {request.options.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {request.options.map((option, index) => (
            <Chip
              key={index}
              mode="outlined"
              onPress={() => handleOptionSelect(option)}
              compact
            >
              {option}
            </Chip>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          mode="outlined"
          placeholder="직접 입력..."
          value={customAnswer}
          onChangeText={setCustomAnswer}
          onSubmitEditing={handleCustomSubmit}
          dense
          style={{ flex: 1 }}
        />
        <Button
          mode="contained"
          onPress={handleCustomSubmit}
          disabled={!customAnswer.trim()}
        >
          전송
        </Button>
      </View>
    </View>
  );
}
