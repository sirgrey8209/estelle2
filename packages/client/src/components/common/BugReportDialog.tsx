import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Portal, Dialog, TextInput, Button, Text, useTheme } from 'react-native-paper';

interface BugReportDialogProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (message: string) => Promise<void>;
}

/**
 * 버그 리포트 다이얼로그
 */
export function BugReportDialog({ visible, onClose, onSubmit }: BugReportDialogProps) {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setSending(true);
    try {
      if (onSubmit) {
        await onSubmit(trimmedMessage);
      }
      setMessage('');
      onClose();
      Alert.alert('완료', '버그 리포트가 전송되었습니다.');
    } catch (error) {
      Alert.alert('오류', `전송 실패: ${error}`);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setMessage('');
      onClose();
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose} style={{ maxWidth: 400, alignSelf: 'center' }}>
        <Dialog.Title>버그 리포트</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodySmall" style={{ marginBottom: 8, opacity: 0.7 }}>
            문제를 설명해주세요:
          </Text>
          <TextInput
            mode="outlined"
            placeholder="어떤 문제가 발생했나요?"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            autoFocus
            disabled={sending}
            dense
            style={{ height: 100 }}
          />
          <Text variant="labelSmall" style={{ marginTop: 8, opacity: 0.5 }}>
            현재 대화/워크스페이스 정보가 함께 전송됩니다.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleClose} disabled={sending}>
            취소
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={sending || !message.trim()}
            loading={sending}
            buttonColor={theme.colors.error}
          >
            전송
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
