/**
 * @file cli.test.ts
 * @description CLI 진입점 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { runCli, parseCliArgs, type CliResult } from '../src/cli.js';

// 테스트용 포트 (19000번대: 개발/v1 포트와 완전 분리)
const TEST_PORT = '19001';

describe('CLI 진입점', () => {
  describe('runCli', () => {
    let serverResult: CliResult | undefined;
    let originalPort: string | undefined;
    let originalDefaultPort: string | undefined;

    beforeEach(() => {
      originalPort = process.env['PORT'];
      originalDefaultPort = process.env['DEFAULT_PORT'];
      process.env['PORT'] = TEST_PORT;
    });

    afterEach(async () => {
      if (serverResult?.server) {
        await serverResult.server.stop();
        serverResult = undefined;
      }
      if (originalPort !== undefined) {
        process.env['PORT'] = originalPort;
      } else {
        delete process.env['PORT'];
      }
      if (originalDefaultPort !== undefined) {
        process.env['DEFAULT_PORT'] = originalDefaultPort;
      } else {
        delete process.env['DEFAULT_PORT'];
      }
    });

    // =========================================================================
    // 정상 케이스
    // =========================================================================

    it('should_start_server_when_cli_executed', async () => {
      serverResult = await runCli();

      expect(serverResult.started).toBe(true);
      expect(serverResult.port).toBe(19001);
    });

    it('should_use_port_from_env_variable', async () => {
      process.env['PORT'] = '19002';

      serverResult = await runCli();

      expect(serverResult.port).toBe(19002);
    });

    it('should_output_startup_log', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      serverResult = await runCli();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Estelle Relay v2]')
      );
      consoleSpy.mockRestore();
    });

    it('should_return_server_instance', async () => {
      serverResult = await runCli();

      expect(serverResult.server).toBeDefined();
      expect(typeof serverResult.server.stop).toBe('function');
    });

    // =========================================================================
    // 엣지 케이스
    // =========================================================================

    it('should_use_default_port_when_PORT_is_empty', async () => {
      process.env['PORT'] = '';
      process.env['DEFAULT_PORT'] = '19003'; // 테스트용 기본 포트

      serverResult = await runCli();

      expect(serverResult.port).toBe(19003);
    });

    it('should_use_default_port_when_PORT_is_non_numeric', async () => {
      process.env['PORT'] = 'invalid';
      process.env['DEFAULT_PORT'] = '19004'; // 테스트용 기본 포트

      serverResult = await runCli();

      expect(serverResult.port).toBe(19004);
    });

    // =========================================================================
    // 에러 케이스
    // =========================================================================

    it('should_throw_when_port_is_negative', async () => {
      process.env['PORT'] = '-1';

      await expect(runCli()).rejects.toThrow('Invalid port');
    });

    it('should_throw_when_port_exceeds_65535', async () => {
      process.env['PORT'] = '65536';

      await expect(runCli()).rejects.toThrow('Invalid port');
    });
  });

  describe('parseCliArgs', () => {
    it('should_parse_port_from_args', () => {
      expect(parseCliArgs(['--port', '3000']).port).toBe(3000);
    });

    it('should_parse_short_port_flag', () => {
      expect(parseCliArgs(['-p', '4000']).port).toBe(4000);
    });

    it('should_return_undefined_when_no_args', () => {
      expect(parseCliArgs([]).port).toBeUndefined();
    });

    it('should_handle_equals_syntax', () => {
      expect(parseCliArgs(['--port=6000']).port).toBe(6000);
    });

    it('should_throw_when_port_flag_has_no_value', () => {
      expect(() => parseCliArgs(['--port'])).toThrow('Missing value for --port');
    });

    it('should_throw_when_port_value_is_not_a_number', () => {
      expect(() => parseCliArgs(['--port', 'abc'])).toThrow('Invalid port value');
    });
  });
});

describe('CLI 시그널 핸들링', () => {
  let serverResult: CliResult | undefined;
  let originalPort: string | undefined;

  beforeEach(() => {
    originalPort = process.env['PORT'];
    process.env['PORT'] = TEST_PORT;
  });

  afterEach(async () => {
    if (serverResult?.server) {
      await serverResult.server.stop();
      serverResult = undefined;
    }
    if (originalPort !== undefined) {
      process.env['PORT'] = originalPort;
    } else {
      delete process.env['PORT'];
    }
  });

  it('should_gracefully_shutdown_on_SIGINT', async () => {
    serverResult = await runCli();
    const stopSpy = vi.spyOn(serverResult.server, 'stop');

    process.emit('SIGINT');

    expect(stopSpy).toHaveBeenCalled();
  });

  it('should_gracefully_shutdown_on_SIGTERM', async () => {
    serverResult = await runCli();
    const stopSpy = vi.spyOn(serverResult.server, 'stop');

    process.emit('SIGTERM');

    expect(stopSpy).toHaveBeenCalled();
  });
});
