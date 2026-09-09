import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: '/ukraine-land-map/',
    define: {
        'import.meta.env.VITE_BUILD_TIME': JSON.stringify(Date.now()),
    }
});
