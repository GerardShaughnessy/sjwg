import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DISABLED,
  AUTH_UNAVAILABLE,
  classifySessionResult,
  decideGate,
  type GateInput,
} from './gate';
import { safeNextPath } from '@/lib/safe-next';

const base: GateInput = {
  pathname: '/portal',
  search: '',
  needsAuth: true,
  upstream: 'none',
  hasAppSession: false,
};
const gate = (o: Partial<GateInput>) => decideGate({ ...base, ...o });

describe('middleware gate', () => {
  it('lets a Guild session through', () => {
    expect(gate({ upstream: 'ok', hasAppSession: true })).toEqual({ kind: 'next' });
  });
  it('sends a confirmed logout to /login with next', () => {
    expect(gate({ pathname: '/portal', search: '?tab=tasks' })).toEqual({
      kind: 'redirect',
      to: '/login?next=%2Fportal%3Ftab%3Dtasks',
    });
    expect(gate({ pathname: '/api/tasks' })).toEqual({
      kind: 'json',
      status: 401,
      error: 'Log in to do that.',
    });
  });
  it('treats an unreachable sign-in service as a retry, not a logout', () => {
    expect(gate({ upstream: 'error' })).toEqual({ kind: 'unavailable' });
    expect(gate({ pathname: '/api/tasks', upstream: 'error' })).toEqual({
      kind: 'json',
      status: 503,
      error: AUTH_UNAVAILABLE,
    });
  });
  it('sends a signed-in user with no enabled account to /login?reason=disabled', () => {
    expect(gate({ upstream: 'ok' })).toEqual({ kind: 'redirect', to: '/login?reason=disabled' });
    expect(gate({ pathname: '/api/me', upstream: 'ok' })).toEqual({
      kind: 'json',
      status: 403,
      error: ACCOUNT_DISABLED,
    });
  });
  it('shows the login page to a disabled user instead of looping', () => {
    expect(
      gate({ pathname: '/login', search: '?reason=disabled', needsAuth: false, upstream: 'ok' }),
    ).toEqual({ kind: 'next' });
  });
  it('sends a signed-in user on /login to a safe next, else /portal', () => {
    const on = {
      pathname: '/login',
      needsAuth: false,
      upstream: 'ok' as const,
      hasAppSession: true,
    };
    expect(gate({ ...on, search: '?next=%2Fsign%2Frequest%2Fabc' })).toEqual({
      kind: 'redirect',
      to: '/sign/request/abc',
    });
    expect(gate({ ...on, search: '?next=%2Fportal%3Ftab%3Dtasks' })).toEqual({
      kind: 'redirect',
      to: '/portal?tab=tasks',
    });
    expect(gate({ ...on, search: '?next=https%3A%2F%2Fevil.example' })).toEqual({
      kind: 'redirect',
      to: '/portal',
    });
    expect(gate({ ...on, search: '' })).toEqual({ kind: 'redirect', to: '/portal' });
    expect(gate({ ...on, pathname: '/forgot-password' })).toEqual({
      kind: 'redirect',
      to: '/portal',
    });
  });
  it('always lets the reset page load, signed in or not', () => {
    for (const hasAppSession of [true, false])
      expect(
        gate({ pathname: '/reset-password', needsAuth: false, upstream: 'ok', hasAppSession }),
      ).toEqual({ kind: 'next' });
  });
  it('leaves public pages alone', () => {
    expect(gate({ pathname: '/about', needsAuth: false, upstream: 'error' })).toEqual({
      kind: 'next',
    });
  });
});

describe('classifySessionResult', () => {
  it('sorts Neon Auth answers', () => {
    expect(classifySessionResult({ data: { user: { id: 'u' } }, error: null })).toBe('ok');
    expect(classifySessionResult({ data: null, error: null })).toBe('none');
    expect(classifySessionResult({ data: null, error: { status: 401 } })).toBe('none');
    expect(classifySessionResult({ data: null, error: { status: 502 } })).toBe('error');
    expect(classifySessionResult({ data: null, error: { status: 500 } })).toBe('error');
    expect(classifySessionResult({ data: null, error: { status: 429 } })).toBe('error');
    expect(classifySessionResult({ data: null, error: {} })).toBe('error');
  });
});

describe('safeNextPath', () => {
  it('keeps same-site /portal and /sign paths', () => {
    expect(safeNextPath('/portal')).toBe('/portal');
    expect(safeNextPath('/portal?tab=tasks&task=1')).toBe('/portal?tab=tasks&task=1');
    expect(safeNextPath('/sign/request/abc')).toBe('/sign/request/abc');
  });
  it('rejects everything else', () => {
    for (const bad of [
      null,
      '',
      'portal',
      '//evil.example/portal',
      '/\\evil.example',
      'https://evil.example/portal',
      '/api/tasks',
      '/portalx',
      '/signup',
      '/login',
      '/portal\n',
      'javascript:alert(1)',
    ])
      expect(safeNextPath(bad)).toBeNull();
  });
  it('normalizes dot segments before checking', () => {
    expect(safeNextPath('/portal/../api/me')).toBeNull();
  });
});
