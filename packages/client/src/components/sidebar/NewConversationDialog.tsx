import React, { useState, useEffect } from 'react';
import { Portal, Dialog, TextInput, Button, Text } from 'react-native-paper';
import { createConversation } from '../../services/relaySender';

interface NewConversationDialogProps {
  visible: boolean;
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

/**
 * 새 대화 생성 다이얼로그
 */
export function NewConversationDialog({
  visible,
  workspaceId,
  workspaceName,
  onClose,
}: NewConversationDialogProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
    }
  }, [visible]);

  const handleCreate = () => {
    if (!name.trim()) return;

    createConversation(workspaceId, name.trim());
    setName('');
    onClose();
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose} style={{ maxWidth: 360, alignSelf: 'center' }}>
        <Dialog.Title>새 대화</Dialog.Title>
        <Dialog.Content>
          <Text variant="labelSmall" style={{ opacity: 0.6, marginBottom: 4 }}>
            워크스페이스
          </Text>
          <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
            {workspaceName}
          </Text>
          <TextInput
            mode="outlined"
            label="대화 이름"
            placeholder="예: 버그 수정, 새 기능 개발..."
            value={name}
            onChangeText={setName}
            autoFocus
            onSubmitEditing={handleCreate}
            dense
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleClose}>취소</Button>
          <Button mode="contained" onPress={handleCreate} disabled={!name.trim()}>
            생성
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
