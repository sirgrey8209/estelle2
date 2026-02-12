/**
 * @file integration.test.ts
 * @description Relay L2 통합 테스트 - 실제 WebSocket 연결을 통한 연결/인증 프로세스 검증
 *
 * 이 테스트 파일은 실제 WebSocket 서버를 시작하고 실제 클라이언트로 연결하여
 * 전체 연결/인증/라우팅 프로세스를 검증합니다.
 *
 * 테스트 포트: 19000번대 (개발 포트와 충돌 방지)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import type { CliResult } from '../src/cli.js';
import { runCli } from '../src/cli.js';

// ============================================================================
// 테스트 설정
// ============================================================================

/** 테스트용 포트 (19000번대 사용) */
const TEST_PORT = 19100;

/** 메시지 수신 타임아웃 (ms) */
const MESSAGE_TIMEOUT = 2000;


// ============================================================================
// 테스트 헬퍼 함수
// ============================================================================

/**
 * WebSocket 연결 및 메시지 수신을 위한 헬퍼 클래스
 */
class TestClient {
  ws: WebSocket | null = null;
  messages: unknown[] = [];
  private messageResolvers: Array<(msg: unknown) => void> = [];

  constructor(private url: string) {}

  /** 서버에 연결 */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        resolve();
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        this.messages.push(msg);

        // 대기 중인 resolver가 있으면 처리
        const resolver = this.messageResolvers.shift();
        if (resolver) {
          resolver(msg);
        }
      });

      this.ws.on('error', (err) => {
        reject(err);
      });
    });
  }

  /** 메시지 전송 */
  send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** 다음 메시지 대기 */
  async waitForMessage(timeout = MESSAGE_TIMEOUT): Promise<unknown> {
    // 이미 수신된 메시지가 있으면 바로 반환
    if (this.messages.length > 0) {
      return this.messages.shift();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      this.messageResolvers.push((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  /** 특정 타입의 메시지 대기 */
  async waitForMessageType(type: string, timeout = MESSAGE_TIMEOUT): Promise<unknown> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // 이미 수신된 메시지에서 찾기
      const index = this.messages.findIndex((m: any) => m.type === type);
      if (index >= 0) {
        return this.messages.splice(index, 1)[0];
      }

      // 새 메시지 대기
      try {
        const msg = await this.waitForMessage(Math.max(100, timeout - (Date.now() - startTime)));
        if ((msg as any).type === type) {
          return msg;
        }
        // 다른 타입이면 다시 큐에 넣고 계속 대기
        this.messages.push(msg);
      } catch {
        // 타임아웃 - 계속 시도
      }
    }

    throw new Error(`Message type '${type}' not received within ${timeout}ms`);
  }

  /** 연결 종료 */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** 모든 수신 메시지 초기화 */
  clearMessages(): void {
    this.messages = [];
  }
}

// ============================================================================
// 통합 테스트
// ============================================================================

describe('Relay L2 통합 테스트', () => {
  let serverResult: CliResult | undefined;
  let originalPort: string | undefined;
  let clients: TestClient[] = [];

  /** 테스트용 클라이언트 생성 */
  function createClient(): TestClient {
    const client = new TestClient(`ws://localhost:${TEST_PORT}`);
    clients.push(client);
    return client;
  }

  /** 모든 클라이언트 정리 */
  function cleanupClients(): void {
    for (const client of clients) {
      client.close();
    }
    clients = [];
  }

  beforeAll(async () => {
    // 환경변수 백업 및 설정
    originalPort = process.env['PORT'];
    process.env['PORT'] = String(TEST_PORT);

    // 서버 시작
    serverResult = await runCli();
    expect(serverResult.started).toBe(true);
  });

  afterAll(async () => {
    // 클라이언트 정리
    cleanupClients();

    // 서버 종료
    if (serverResult?.server) {
      await serverResult.server.stop();
      serverResult = undefined;
    }

    // 환경변수 복원
    if (originalPort !== undefined) {
      process.env['PORT'] = originalPort;
    } else {
      delete process.env['PORT'];
    }
  });

  afterEach(() => {
    // 각 테스트 후 클라이언트 정리
    cleanupClients();
  });

  // ==========================================================================
  // 1. 연결
  // ==========================================================================

  describe('1. 연결', () => {
    it('1.1 should_receive_connected_message_when_websocket_connects', async () => {
      // Arrange
      const client = createClient();

      // Act
      await client.connect();
      const msg = await client.waitForMessage() as any;

      // Assert
      expect(msg.type).toBe('connected');
      expect(msg.payload).toBeDefined();
      expect(msg.payload.clientId).toBeDefined();
      expect(typeof msg.payload.clientId).toBe('string');
      expect(msg.payload.message).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. Pylon 인증
  // ==========================================================================

  describe('2. Pylon 인증', () => {
    it('2.1 should_authenticate_pylon_when_deviceId_provided_and_IP_allowed', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert
      expect(result.payload.success).toBe(true);
      expect(result.payload.device).toBeDefined();
      expect(result.payload.device.deviceId).toBe(1);
      expect(typeof result.payload.device.deviceId).toBe('number');
    });

    it('2.2 should_reject_pylon_when_deviceId_missing', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'pylon' }, // deviceId 누락
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert
      expect(result.payload.success).toBe(false);
      expect(result.payload.error).toBe('Missing deviceId for pylon');
    });

    it('2.3 should_authenticate_pylon_when_IP_is_allowed_localhost', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act - deviceId 2는 127.0.0.1, ::1만 허용
      // 로컬 테스트 환경에서는 localhost로 연결하므로 성공해야 함
      // (IP 제한 거부 케이스는 단위 테스트 auth.test.ts에서 검증)
      client.send({
        type: 'auth',
        payload: { deviceId: 2, deviceType: 'pylon' },
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert - localhost 연결이므로 허용된 IP로 인증 성공
      expect(result.payload.success).toBe(true);
      expect(result.payload.device).toBeDefined();
      expect(result.payload.device.deviceId).toBe(2);
    });

    it('2.4 should_reject_pylon_when_deviceId_not_registered', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act - deviceId 50은 등록되지 않음
      client.send({
        type: 'auth',
        payload: { deviceId: 50, deviceType: 'pylon' },
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert
      expect(result.payload.success).toBe(false);
      expect(result.payload.error).toBe('Unknown device: 50');
    });
  });

  // ==========================================================================
  // 3. App 인증
  // ==========================================================================

  describe('3. App 인증', () => {
    it('3.1 should_auto_assign_encoded_deviceId_when_mobile_connects_without_deviceId', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert - 인코딩된 deviceId (envId=0, type=app(1), index=0~15 → 16~31)
      expect(result.payload.success).toBe(true);
      expect(result.payload.device).toBeDefined();
      expect(result.payload.device.deviceId).toBeGreaterThanOrEqual(16);
      expect(result.payload.device.deviceId).toBeLessThanOrEqual(31);
    });

    it('3.2 should_auto_assign_encoded_deviceId_when_desktop_connects_without_deviceId', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'desktop' },
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert - 인코딩된 deviceId (envId=0, type=app(1), index=0~15 → 16~31)
      expect(result.payload.success).toBe(true);
      expect(result.payload.device).toBeDefined();
      expect(result.payload.device.deviceId).toBeGreaterThanOrEqual(16);
      expect(result.payload.device.deviceId).toBeLessThanOrEqual(31);
    });

    it('3.3 should_assign_incremented_deviceId_for_second_app', async () => {
      // Arrange
      const client1 = createClient();
      const client2 = createClient();

      await client1.connect();
      await client1.waitForMessage(); // connected 메시지 소비
      await client2.connect();
      await client2.waitForMessage(); // connected 메시지 소비

      // Act - 첫 번째 앱 인증
      client1.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });
      const result1 = await client1.waitForMessageType('auth_result') as any;

      // Act - 두 번째 앱 인증
      client2.send({
        type: 'auth',
        payload: { deviceType: 'desktop' },
      });
      const result2 = await client2.waitForMessageType('auth_result') as any;

      // Assert - 두 앱의 deviceId가 연속된 값인지 검증 (서버 전역 상태에 의존하지 않음)
      expect(result1.payload.success).toBe(true);
      expect(result2.payload.success).toBe(true);
      expect(result2.payload.device.deviceId).toBe(result1.payload.device.deviceId + 1);
    });

    it('3.4 should_reject_when_deviceType_missing', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act
      client.send({
        type: 'auth',
        payload: {}, // deviceType 누락
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert
      expect(result.payload.success).toBe(false);
      expect(result.payload.error).toBe('Missing deviceType');
    });
  });

  // ==========================================================================
  // 4. 인증 응답 형식
  // ==========================================================================

  describe('4. 인증 응답 형식', () => {
    it('4.1 should_return_correct_success_response_structure', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert - 성공 시 응답 구조 검증
      expect(result.type).toBe('auth_result');
      expect(result.payload.success).toBe(true);
      expect(result.payload.device).toBeDefined();
      expect(typeof result.payload.device.deviceId).toBe('number');
      expect(result.payload.device.deviceType).toBeDefined();
      expect(result.payload.device.name).toBeDefined();
      expect(result.payload.device.icon).toBeDefined();
      expect(result.payload.device.role).toBeDefined();
    });

    it('4.2 should_return_deviceId_as_number_not_string', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert - deviceId는 항상 number 타입이어야 함
      expect(result.payload.success).toBe(true);
      expect(typeof result.payload.device.deviceId).toBe('number');
      expect(typeof result.payload.device.deviceId).not.toBe('string');
    });

    it('4.3 should_return_correct_failure_response_structure', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act - deviceType 누락으로 실패 유도
      client.send({
        type: 'auth',
        payload: {},
      });

      const result = await client.waitForMessageType('auth_result') as any;

      // Assert - 실패 시 응답 구조 검증
      expect(result.type).toBe('auth_result');
      expect(result.payload.success).toBe(false);
      expect(typeof result.payload.error).toBe('string');
      expect(result.payload.device).toBeUndefined();
    });
  });

  // ==========================================================================
  // 5. 인증 후 동작
  // ==========================================================================

  describe('5. 인증 후 동작', () => {
    it('5.1 should_respond_to_get_devices_after_authentication', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // 인증
      client.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });
      await client.waitForMessageType('auth_result');
      client.clearMessages();

      // Act
      client.send({ type: 'get_devices' });
      const result = await client.waitForMessageType('device_list') as any;

      // Assert
      expect(result.type).toBe('device_list');
      expect(result.payload.devices).toBeInstanceOf(Array);
    });

    it('5.2 should_respond_to_ping_after_authentication', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // 인증
      client.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });
      await client.waitForMessageType('auth_result');
      client.clearMessages();

      // Act
      client.send({ type: 'ping' });
      const result = await client.waitForMessageType('pong') as any;

      // Assert
      expect(result.type).toBe('pong');
    });

    it('5.3 should_reject_get_devices_before_authentication', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act - 인증 없이 get_devices 요청
      client.send({ type: 'get_devices' });
      const result = await client.waitForMessageType('error') as any;

      // Assert
      expect(result.type).toBe('error');
      expect(result.payload.error).toBe('Not authenticated');
    });

    it('5.4 should_reject_ping_before_authentication', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 메시지 소비

      // Act - 인증 없이 ping 요청
      client.send({ type: 'ping' });
      const result = await client.waitForMessageType('error') as any;

      // Assert
      expect(result.type).toBe('error');
      expect(result.payload.error).toBe('Not authenticated');
    });
  });

  // ==========================================================================
  // 6. 브로드캐스트
  // ==========================================================================

  describe('6. 브로드캐스트', () => {
    it('6.1 should_broadcast_device_status_when_new_device_authenticates', async () => {
      // Arrange - 첫 번째 클라이언트 연결 및 인증
      const client1 = createClient();
      await client1.connect();
      await client1.waitForMessage(); // connected 메시지 소비
      client1.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });
      await client1.waitForMessageType('auth_result');
      client1.clearMessages();

      // Arrange - 두 번째 클라이언트 연결
      const client2 = createClient();
      await client2.connect();
      await client2.waitForMessage(); // connected 메시지 소비

      // Act - 두 번째 클라이언트 인증
      client2.send({
        type: 'auth',
        payload: { deviceType: 'desktop' },
      });
      await client2.waitForMessageType('auth_result');

      // Assert - 첫 번째 클라이언트가 device_status 브로드캐스트 수신
      const deviceStatus = await client1.waitForMessageType('device_status') as any;
      expect(deviceStatus.type).toBe('device_status');
      expect(deviceStatus.payload.devices).toBeInstanceOf(Array);
      // Note: 현재 구현은 인증 시 브로드캐스트 전 상태 업데이트가 되지 않아 빈 배열이나 부분적인 목록이 올 수 있음
      // 아래 assertion은 실제 디바이스 목록이 올바르게 전송되는지 확인 (2개 이상이어야 함)
      // 버그로 인해 실패할 수 있음 - 이 테스트는 실패해야 정상
      expect(deviceStatus.payload.devices.length).toBeGreaterThanOrEqual(2);
    });

    it('6.2 should_broadcast_device_status_when_device_disconnects', async () => {
      // Arrange - 두 클라이언트 연결 및 인증
      const client1 = createClient();
      const client2 = createClient();

      await client1.connect();
      await client1.waitForMessage();
      client1.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      await client1.waitForMessageType('auth_result');
      client1.clearMessages();

      await client2.connect();
      await client2.waitForMessage();
      client2.send({ type: 'auth', payload: { deviceType: 'desktop' } });
      await client2.waitForMessageType('auth_result');

      // device_status 브로드캐스트 소비
      await client1.waitForMessageType('device_status');
      client1.clearMessages();

      // Act - client2 연결 종료
      client2.close();
      // clients 배열에서 제거 (afterEach에서 다시 close하지 않도록)
      clients = clients.filter((c) => c !== client2);

      // Assert - client1이 device_status 브로드캐스트 수신
      const deviceStatus = await client1.waitForMessageType('device_status') as any;
      expect(deviceStatus.type).toBe('device_status');
      expect(deviceStatus.payload.devices).toBeInstanceOf(Array);
    });
  });

  // ==========================================================================
  // 7. 라우팅 (인증 후)
  // ==========================================================================

  describe('7. 라우팅', () => {
    it('7.1 should_route_message_to_specific_deviceId', async () => {
      // Arrange - Pylon 연결 및 인증
      const pylon = createClient();
      await pylon.connect();
      await pylon.waitForMessage();
      pylon.send({ type: 'auth', payload: { deviceId: 1, deviceType: 'pylon' } });
      await pylon.waitForMessageType('auth_result');
      pylon.clearMessages();

      // Arrange - App 연결 및 인증
      const app = createClient();
      await app.connect();
      await app.waitForMessage();
      app.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      const appAuth = await app.waitForMessageType('auth_result') as any;
      const appDeviceId = appAuth.payload.device.deviceId;

      // device_status 브로드캐스트 소비
      await pylon.waitForMessageType('device_status');
      pylon.clearMessages();
      app.clearMessages();

      // Act - Pylon이 특정 deviceId로 메시지 전송 (to는 숫자 배열)
      pylon.send({
        type: 'custom_message',
        payload: { data: 'hello' },
        to: [appDeviceId],
      });

      // Assert - App이 메시지 수신
      const msg = await app.waitForMessage() as any;
      expect(msg.type).toBe('custom_message');
      expect(msg.payload.data).toBe('hello');
    });

    it('7.2 should_broadcast_message_to_all_authenticated_devices', async () => {
      // Arrange - Pylon 연결 및 인증
      const pylon = createClient();
      await pylon.connect();
      await pylon.waitForMessage();
      pylon.send({ type: 'auth', payload: { deviceId: 1, deviceType: 'pylon' } });
      await pylon.waitForMessageType('auth_result');
      pylon.clearMessages();

      // Arrange - 두 개의 App 연결 및 인증
      const app1 = createClient();
      await app1.connect();
      await app1.waitForMessage();
      app1.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      await app1.waitForMessageType('auth_result');

      const app2 = createClient();
      await app2.connect();
      await app2.waitForMessage();
      app2.send({ type: 'auth', payload: { deviceType: 'desktop' } });
      await app2.waitForMessageType('auth_result');

      // device_status 브로드캐스트 소비 - 대기 시간을 줘서 모두 수신
      await new Promise((resolve) => setTimeout(resolve, 100));
      pylon.clearMessages();
      app1.clearMessages();
      app2.clearMessages();

      // Act - Pylon이 broadcast: true로 메시지 전송
      pylon.send({
        type: 'broadcast_message',
        payload: { data: 'broadcast' },
        broadcast: true,
      });

      // Assert - 모든 App이 메시지 수신 (broadcast_message 타입의 메시지를 찾음)
      const msg1 = await app1.waitForMessageType('broadcast_message') as any;
      const msg2 = await app2.waitForMessageType('broadcast_message') as any;

      expect(msg1.type).toBe('broadcast_message');
      expect(msg2.type).toBe('broadcast_message');
    });

    it('7.3 should_inject_from_info_in_routed_messages', async () => {
      // Arrange - Pylon 연결 및 인증
      const pylon = createClient();
      await pylon.connect();
      await pylon.waitForMessage();
      pylon.send({ type: 'auth', payload: { deviceId: 1, deviceType: 'pylon' } });
      await pylon.waitForMessageType('auth_result');
      pylon.clearMessages();

      // Arrange - App 연결 및 인증
      const app = createClient();
      await app.connect();
      await app.waitForMessage();
      app.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      await app.waitForMessageType('auth_result');

      // device_status 브로드캐스트 소비
      await pylon.waitForMessageType('device_status');
      pylon.clearMessages();
      app.clearMessages();

      // Act - Pylon이 메시지 전송 (명시적 broadcast 필요 - 기본 라우팅 없음)
      pylon.send({
        type: 'test_message',
        payload: { data: 'test' },
        broadcast: 'clients',  // app들에게 브로드캐스트
      });

      // Assert - App이 수신한 메시지에 from 정보가 주입됨
      const msg = await app.waitForMessage() as any;
      expect(msg.from).toBeDefined();
      expect(msg.from.deviceId).toBe(1);
      expect(msg.from.deviceType).toBe('pylon');
      expect(msg.from.name).toBeDefined();
      expect(msg.from.icon).toBeDefined();
    });
  });

  // ==========================================================================
  // 8. 연결 해제
  // ==========================================================================

  describe('8. 연결 해제', () => {
    it('8.1 should_notify_pylon_when_app_disconnects', async () => {
      // Arrange - Pylon 연결 및 인증
      const pylon = createClient();
      await pylon.connect();
      await pylon.waitForMessage();
      pylon.send({ type: 'auth', payload: { deviceId: 1, deviceType: 'pylon' } });
      await pylon.waitForMessageType('auth_result');
      pylon.clearMessages();

      // Arrange - App 연결 및 인증
      const app = createClient();
      await app.connect();
      await app.waitForMessage();
      app.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      await app.waitForMessageType('auth_result');

      // device_status 브로드캐스트 소비
      await pylon.waitForMessageType('device_status');
      pylon.clearMessages();

      // Act - App 연결 종료
      app.close();
      clients = clients.filter((c) => c !== app);

      // Assert - Pylon이 client_disconnect 알림 수신
      const disconnect = await pylon.waitForMessageType('client_disconnect') as any;
      expect(disconnect.type).toBe('client_disconnect');
      expect(disconnect.payload.deviceId).toBeDefined();
      expect(disconnect.payload.deviceType).toBeDefined();
    });

    it('8.2 should_reuse_released_deviceId_when_all_apps_disconnect', async () => {
      // 인코딩된 deviceId 계산: (envId << 5) | (deviceType << 4) | deviceIndex
      // envId=0, deviceType=app(1), deviceIndex=0 → 16
      const encodeAppDeviceId = (deviceIndex: number) => (0 << 5) | (1 << 4) | deviceIndex;

      // Arrange - App 연결 및 인증
      const app1 = createClient();
      await app1.connect();
      await app1.waitForMessage();
      app1.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      const auth1 = await app1.waitForMessageType('auth_result') as any;
      expect(auth1.payload.device.deviceId).toBe(encodeAppDeviceId(0)); // = 16

      // Act - App 연결 종료 (모든 app 해제, allocator가 0번 해제)
      app1.close();
      clients = clients.filter((c) => c !== app1);

      // 잠시 대기 (서버가 상태 처리할 시간)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Arrange - 새 App 연결 및 인증
      const app2 = createClient();
      await app2.connect();
      await app2.waitForMessage();
      app2.send({ type: 'auth', payload: { deviceType: 'desktop' } });
      const auth2 = await app2.waitForMessageType('auth_result') as any;

      // Assert - allocator가 해제된 인덱스 0번을 재사용 → 인코딩된 16
      expect(auth2.payload.device.deviceId).toBe(encodeAppDeviceId(0)); // = 16
    });
  });

  // ==========================================================================
  // 9. [새 체계] ClientIndexAllocator 기반 deviceId 할당
  // ==========================================================================

  describe('9. [새 체계] ClientIndexAllocator 기반 deviceId 할당', () => {
    // 인코딩된 deviceId 계산 헬퍼
    // deviceId = (envId << 5) | (deviceType << 4) | deviceIndex
    // envId=0 (release, 테스트 기본값), deviceType: pylon=0, app=1
    const encodeAppDeviceId = (deviceIndex: number) => (0 << 5) | (1 << 4) | deviceIndex;

    it('9.1 should_assign_encoded_deviceId_when_app_connects', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });
      const result = await client.waitForMessageType('auth_result') as any;

      // Assert — 새 체계: deviceId가 인코딩된 값 (16~31 범위: envId=0, type=app)
      expect(result.payload.success).toBe(true);
      expect(result.payload.device.deviceId).toBeGreaterThanOrEqual(16);
      expect(result.payload.device.deviceId).toBeLessThanOrEqual(31);
    });

    it('9.2 should_assign_encoded_deviceId_16_as_first_when_no_apps_connected', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage(); // connected 소비

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'desktop' },
      });
      const result = await client.waitForMessageType('auth_result') as any;

      // Assert — 새 체계: 첫 번째 앱은 인코딩된 deviceId 16 (envId=0, type=1, index=0)
      expect(result.payload.success).toBe(true);
      expect(result.payload.device.deviceId).toBe(encodeAppDeviceId(0)); // = 16
    });

    it('9.3 should_assign_sequential_encoded_deviceIds', async () => {
      // Arrange
      const client1 = createClient();
      const client2 = createClient();
      const client3 = createClient();

      await client1.connect();
      await client1.waitForMessage();
      await client2.connect();
      await client2.waitForMessage();
      await client3.connect();
      await client3.waitForMessage();

      // Act - 세 앱 순차 인증
      client1.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      const r1 = await client1.waitForMessageType('auth_result') as any;

      client2.send({ type: 'auth', payload: { deviceType: 'desktop' } });
      const r2 = await client2.waitForMessageType('auth_result') as any;

      client3.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      const r3 = await client3.waitForMessageType('auth_result') as any;

      // Assert — 새 체계: 인코딩된 16, 17, 18 순차 할당
      expect(r1.payload.device.deviceId).toBe(encodeAppDeviceId(0)); // = 16
      expect(r2.payload.device.deviceId).toBe(encodeAppDeviceId(1)); // = 17
      expect(r3.payload.device.deviceId).toBe(encodeAppDeviceId(2)); // = 18
    });

    it('9.4 should_reuse_released_deviceId_when_app_reconnects', async () => {
      // Arrange - 두 앱 연결
      const app1 = createClient();
      const app2 = createClient();

      await app1.connect();
      await app1.waitForMessage();
      await app2.connect();
      await app2.waitForMessage();

      app1.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      const r1 = await app1.waitForMessageType('auth_result') as any;
      expect(r1.payload.device.deviceId).toBe(encodeAppDeviceId(0)); // = 16

      app2.send({ type: 'auth', payload: { deviceType: 'desktop' } });
      const r2 = await app2.waitForMessageType('auth_result') as any;
      expect(r2.payload.device.deviceId).toBe(encodeAppDeviceId(1)); // = 17

      // Act - app1 연결 종료 (deviceIndex 0 해제)
      app1.close();
      clients = clients.filter(c => c !== app1);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 새 앱 연결
      const app3 = createClient();
      await app3.connect();
      await app3.waitForMessage();
      app3.send({ type: 'auth', payload: { deviceType: 'mobile' } });
      const r3 = await app3.waitForMessageType('auth_result') as any;

      // Assert — 새 체계: 해제된 인덱스 0번을 재사용 → 인코딩된 16
      expect(r3.payload.device.deviceId).toBe(encodeAppDeviceId(0)); // = 16
    });

    it('9.5 should_show_client_role_for_dynamically_assigned_device', async () => {
      // Arrange
      const client = createClient();
      await client.connect();
      await client.waitForMessage();

      // Act
      client.send({
        type: 'auth',
        payload: { deviceType: 'mobile' },
      });
      const result = await client.waitForMessageType('auth_result') as any;

      // Assert — 새 체계: 동적 할당된 앱도 client role을 가져야 함
      expect(result.payload.success).toBe(true);
      expect(result.payload.device.role).toBe('client');
    });
  });
});
