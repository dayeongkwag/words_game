import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  /*
   * 상대 경로로 빌드한다.
   *
   * GitHub Pages 의 프로젝트 사이트는 https://<사용자>.github.io/<저장소>/ 처럼
   * 하위 경로로 서비스된다. base 를 '/' 로 두면 자원 주소가 도메인 루트를 가리켜
   * 404 가 난다. './' 로 두면 저장소 이름을 몰라도, 나중에 바뀌어도 그대로 동작한다.
   *
   * 이 앱은 경로 기반 라우팅 없이 쿼리 파라미터만 쓰므로 상대 경로로 충분하다.
   */
  base: './',
  plugins: [react()],
  server: {
    /*
     * 실기기(휴대폰) 확인을 위해 LAN 에 노출한다.
     * 포트를 고정하는 이유: 포트가 바뀌면 방화벽 인바운드 규칙이 무용지물이 된다.
     * (5173 은 다른 프로세스가 쓰고 있어 5174 로 고정)
     */
    host: true,
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
