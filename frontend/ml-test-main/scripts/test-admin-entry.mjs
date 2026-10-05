import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const server = await createServer({
  configLoader: 'runner',
  server: { middlewareMode: true },
});

try {
  const { default: AdminApp } = await server.ssrLoadModule('/src/features/admin/AdminApp.tsx');
  const render = (pathname, token = null, hostname = 'market.example') => {
    globalThis.window = { location: { pathname, hostname } };
    globalThis.localStorage = { getItem: () => token };
    return renderToString(createElement(AdminApp));
  };

  const login = render('/login');
  assert.match(login, /관리자 로그인/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(login, /\/figma\/daecho-logo.svg/);
  assert.doesNotMatch(render('/dashboard'), /가게 관리/);
  assert.match(render('/dashboard'), /관리자 화면으로 이동 중/);
  assert.doesNotMatch(render('/dashboard', 'local-admin'), /가게 관리/);
  assert.match(render('/dashboard', 'local-admin', 'localhost'), /가게 관리/);
  const dashboard = render('/dashboard', 'test-access-token');
  assert.match(dashboard, /가게 관리/);
  assert.match(dashboard, /홍보 관리/);
  assert.match(dashboard, /검색 태그 관리하기/);
  assert.match(dashboard, /로그아웃/);
  assert.match(render('/login', 'test-access-token'), /관리자 화면으로 이동 중/);
  console.log('Admin entry: login, dashboard, authentication guards, and shared assets passed.');
} finally {
  delete globalThis.window;
  delete globalThis.localStorage;
  await server.close();
}
