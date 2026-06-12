import { defineConfig } from 'vite';

// 정적 호스팅(URL 공유) 시 하위 경로에서도 동작하도록 상대 경로 사용
export default defineConfig({
  base: './',
});
