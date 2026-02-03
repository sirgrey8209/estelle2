import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import {
  Portal,
  Dialog,
  TextInput,
  Button,
  Text,
  List,
  IconButton,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useWorkspaceStore } from '../../stores';
import { requestFolderList, requestFolderCreate, requestWorkspaceCreate } from '../../services/relaySender';

interface NewWorkspaceDialogProps {
  visible: boolean;
  onClose: () => void;
}

interface FolderState {
  path: string;
  folders: string[];
  isLoading: boolean;
  error: string | null;
}

/**
 * 새 워크스페이스 생성 다이얼로그
 */
export function NewWorkspaceDialog({ visible, onClose }: NewWorkspaceDialogProps) {
  const theme = useTheme();
  const { connectedPylons } = useWorkspaceStore();

  const pcs = connectedPylons.map((p) => ({
    pcId: String(p.deviceId),
    pcName: p.deviceName,
  }));

  const [selectedPcIndex, setSelectedPcIndex] = useState(0);
  const [name, setName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderState, setFolderState] = useState<FolderState>({
    path: '',
    folders: [],
    isLoading: false,
    error: null,
  });

  const selectedPc = pcs[selectedPcIndex];

  useEffect(() => {
    if (visible && selectedPc) {
      loadFolders();
    }
  }, [visible, selectedPcIndex]);

  useEffect(() => {
    const handleFolderListResult = (event: CustomEvent) => {
      const { path, folders, error } = event.detail;
      setFolderState({
        path: path || '',
        folders: folders || [],
        isLoading: false,
        error: error || null,
      });
    };

    window.addEventListener('folder_list_result' as any, handleFolderListResult);
    return () => {
      window.removeEventListener('folder_list_result' as any, handleFolderListResult);
    };
  }, []);

  const loadFolders = (path?: string) => {
    if (!selectedPc) return;

    setFolderState((prev) => ({ ...prev, isLoading: true, error: null }));
    setSelectedFolder(null);
    requestFolderList(parseInt(selectedPc.pcId, 10), path);
  };

  const cyclePc = () => {
    if (pcs.length > 1) {
      setSelectedPcIndex((prev) => (prev + 1) % pcs.length);
      setSelectedFolder(null);
    }
  };

  const goToParent = () => {
    const parts = folderState.path.split(/[/\\]/);
    if (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('\\');
      if (parentPath) {
        loadFolders(parentPath);
      }
    }
  };

  const selectFolder = (folderName: string) => {
    setSelectedFolder(folderName);
    setName(folderName);
  };

  const enterFolder = (folderName: string) => {
    const fullPath = `${folderState.path}\\${folderName}`;
    loadFolders(fullPath);
  };

  const createFolder = () => {
    const folderName = prompt('새 폴더 이름을 입력하세요');
    if (folderName && selectedPc) {
      requestFolderCreate(parseInt(selectedPc.pcId, 10), folderState.path, folderName);
      setTimeout(() => loadFolders(folderState.path), 500);
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !selectedPc) return;

    const workingDir = selectedFolder
      ? `${folderState.path}\\${selectedFolder}`
      : folderState.path;

    requestWorkspaceCreate(parseInt(selectedPc.pcId, 10), name.trim(), workingDir);

    setName('');
    setSelectedFolder(null);
    onClose();
  };

  const handleClose = () => {
    setName('');
    setSelectedFolder(null);
    onClose();
  };

  if (pcs.length === 0) {
    return (
      <Portal>
        <Dialog visible={visible} onDismiss={handleClose} style={{ maxWidth: 400, alignSelf: 'center' }}>
          <Dialog.Title>워크스페이스 추가</Dialog.Title>
          <Dialog.Content>
            <Text style={{ textAlign: 'center', opacity: 0.6, paddingVertical: 24 }}>
              연결된 PC가 없습니다
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleClose}>닫기</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose} style={{ maxWidth: 420, alignSelf: 'center', maxHeight: '80%' }}>
        <Dialog.Title>새 워크스페이스</Dialog.Title>
        <Dialog.Content>
          {/* PC 선택 + 이름 입력 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <IconButton
              icon="desktop-tower"
              mode="outlined"
              size={20}
              onPress={cyclePc}
              disabled={pcs.length <= 1}
            />
            <TextInput
              mode="outlined"
              placeholder="워크스페이스 이름"
              value={name}
              onChangeText={setName}
              dense
              style={{ flex: 1 }}
            />
          </View>

          {/* 경로 표시 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text variant="bodySmall" style={{ flex: 1, opacity: 0.7 }} numberOfLines={1}>
              {folderState.path || '로딩 중...'}
            </Text>
            <IconButton icon="arrow-up" size={18} onPress={goToParent} />
          </View>

          {/* 폴더 목록 */}
          <ScrollView style={{ maxHeight: 200 }}>
            {folderState.isLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : folderState.error ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.error }}>{folderState.error}</Text>
              </View>
            ) : (
              <>
                {folderState.folders.map((folder) => (
                  <List.Item
                    key={folder}
                    title={folder}
                    left={() => <List.Icon icon="folder" />}
                    right={() => selectedFolder === folder ? <List.Icon icon="check" /> : null}
                    onPress={() => selectFolder(folder)}
                    onLongPress={() => enterFolder(folder)}
                    style={{
                      backgroundColor: selectedFolder === folder ? theme.colors.primaryContainer : undefined,
                      paddingVertical: 0,
                      minHeight: 40,
                    }}
                    titleStyle={{ fontSize: 14 }}
                  />
                ))}
                <List.Item
                  title="새 폴더"
                  left={() => <List.Icon icon="folder-plus" />}
                  onPress={createFolder}
                  style={{ paddingVertical: 0, minHeight: 40 }}
                  titleStyle={{ fontSize: 14, opacity: 0.7 }}
                />
              </>
            )}
          </ScrollView>
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
