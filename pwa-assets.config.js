import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Run `npm run icons` after changing public/favicon.svg.
export default defineConfig({
    preset: {
        ...minimal2023Preset,
        maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: "#1f6f5c" } },
    },
    images: ["public/favicon.svg"],
});
