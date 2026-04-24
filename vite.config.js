import { defineConfig } from 'vite';

export default defineConfig({
  // Vercel에서 제공하는 Supabase 환경 변수를 클라이언트(브라우저)에서 접근할 수 있도록 허용합니다.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_'],
});
