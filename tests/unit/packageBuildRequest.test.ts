import { describe, expect, it } from 'vitest';

import {
  createPackageBuildRequest,
  describePackageType,
  detectPackageType
} from '../../src/packaging/packageBuildRequest';

describe('package build request', () => {
  it('detects VI packages from .vipb regardless of case or separator', () => {
    expect(detectPackageType('C:\\proj\\thing.vipb')).toBe('vi');
    expect(detectPackageType('/home/x/thing.VIPB')).toBe('vi');
  });

  it('detects NI packages from .nipb', () => {
    expect(detectPackageType('/home/x/thing.nipb')).toBe('ni');
  });

  it('returns unknown for unrelated files and dotted directories', () => {
    expect(detectPackageType('/home/x/thing.vi')).toBe('unknown');
    expect(detectPackageType('/home/x/noext')).toBe('unknown');
    expect(detectPackageType('/home/my.dir/spec')).toBe('unknown');
  });

  it('builds a request and describes each type', () => {
    expect(createPackageBuildRequest('a.vipb')).toEqual({ specPath: 'a.vipb', packageType: 'vi' });
    expect(describePackageType('vi')).toContain('VI Package');
    expect(describePackageType('ni')).toContain('NI Package');
    expect(describePackageType('unknown')).toContain('Unsupported');
  });
});
