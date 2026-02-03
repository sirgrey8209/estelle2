/**
 * @file character.test.ts
 * @description 캐릭터 헬퍼 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import { getCharacter, getDeskFullName, DEFAULT_CHARACTER } from '../../src/helpers/character.js';
import { Characters } from '../../src/constants/index.js';

describe('getCharacter', () => {
  describe('알려진 pcId로 캐릭터 조회', () => {
    it('should pcId "1"로 Device 1 캐릭터를 반환해야 한다', () => {
      const character = getCharacter('1');

      expect(character).toEqual(Characters['1']);
      expect(character.name).toBe('Device 1');
    });

    it('should pcId "2"로 Device 2 캐릭터를 반환해야 한다', () => {
      const character = getCharacter('2');

      expect(character).toEqual(Characters['2']);
      expect(character.name).toBe('Device 2');
    });

    it('should pcId "lucy"로 Lucy 캐릭터를 반환해야 한다', () => {
      const character = getCharacter('lucy');

      expect(character).toEqual(Characters['lucy']);
      expect(character.name).toBe('Lucy');
    });

    it('should pcId "estelle"로 Estelle 캐릭터를 반환해야 한다', () => {
      const character = getCharacter('estelle');

      expect(character).toEqual(Characters['estelle']);
      expect(character.name).toBe('Estelle');
    });
  });

  describe('알려지지 않은 pcId는 기본 캐릭터 반환', () => {
    it('should 알려지지 않은 문자열 pcId에 대해 기본 캐릭터를 반환해야 한다', () => {
      const character = getCharacter('unknown-pc');

      // name은 pcId로 동적 설정되므로, icon과 description만 DEFAULT_CHARACTER와 비교
      expect(character.icon).toBe(DEFAULT_CHARACTER.icon);
      expect(character.name).toBe('unknown-pc');
      expect(character.description).toBe('Unknown PC');
    });

    it('should 기본 캐릭터의 name은 입력된 pcId여야 한다', () => {
      const character = getCharacter('my-custom-pc');

      expect(character.name).toBe('my-custom-pc');
    });

    it('should 빈 문자열 pcId에 대해 기본 캐릭터를 반환해야 한다', () => {
      const character = getCharacter('');

      expect(character.name).toBe('');
      expect(character.description).toBe('Unknown PC');
    });
  });

  describe('숫자/문자열 pcId 모두 지원', () => {
    it('should 숫자 1로 Device 1 캐릭터를 반환해야 한다', () => {
      const character = getCharacter(1);

      expect(character).toEqual(Characters['1']);
      expect(character.name).toBe('Device 1');
    });

    it('should 숫자 2로 Device 2 캐릭터를 반환해야 한다', () => {
      const character = getCharacter(2);

      expect(character).toEqual(Characters['2']);
      expect(character.name).toBe('Device 2');
    });

    it('should 알려지지 않은 숫자 pcId에 대해 기본 캐릭터를 반환해야 한다', () => {
      const character = getCharacter(999);

      expect(character.name).toBe('999');
      expect(character.description).toBe('Unknown PC');
    });
  });
});

describe('getDeskFullName', () => {
  describe('포맷 확인', () => {
    it('should "캐릭터이름/데스크이름" 형식으로 반환해야 한다', () => {
      const fullName = getDeskFullName('1', 'workspace');

      expect(fullName).toBe('Device 1/workspace');
    });

    it('should 알려진 pcId와 데스크 이름을 조합해야 한다', () => {
      expect(getDeskFullName('1', 'project-a')).toBe('Device 1/project-a');
      expect(getDeskFullName('2', 'my-desk')).toBe('Device 2/my-desk');
      expect(getDeskFullName('lucy', 'mobile-desk')).toBe('Lucy/mobile-desk');
      expect(getDeskFullName('estelle', 'relay-desk')).toBe('Estelle/relay-desk');
    });
  });

  describe('알려지지 않은 pcId 처리', () => {
    it('should 알려지지 않은 pcId는 그대로 사용해야 한다', () => {
      const fullName = getDeskFullName('unknown-pc', 'desk1');

      expect(fullName).toBe('unknown-pc/desk1');
    });
  });

  describe('숫자 pcId 지원', () => {
    it('should 숫자 pcId를 문자열로 변환하여 처리해야 한다', () => {
      const fullName = getDeskFullName(1, 'workspace');

      expect(fullName).toBe('Device 1/workspace');
    });

    it('should 알려지지 않은 숫자 pcId도 처리해야 한다', () => {
      const fullName = getDeskFullName(999, 'desk');

      expect(fullName).toBe('999/desk');
    });
  });

  describe('다양한 데스크 이름', () => {
    it('should 빈 데스크 이름도 처리해야 한다', () => {
      const fullName = getDeskFullName('1', '');

      expect(fullName).toBe('Device 1/');
    });

    it('should 공백이 포함된 데스크 이름도 처리해야 한다', () => {
      const fullName = getDeskFullName('1', 'My Workspace');

      expect(fullName).toBe('Device 1/My Workspace');
    });

    it('should 특수 문자가 포함된 데스크 이름도 처리해야 한다', () => {
      const fullName = getDeskFullName('1', 'project-v2.0_final');

      expect(fullName).toBe('Device 1/project-v2.0_final');
    });
  });
});

describe('DEFAULT_CHARACTER', () => {
  it('should 기본 아이콘과 설명을 가져야 한다', () => {
    expect(DEFAULT_CHARACTER.icon).toBeDefined();
    expect(DEFAULT_CHARACTER.description).toBe('Unknown PC');
  });
});
