// Shared Playwright launcher. Uses the system Chrome (the bundled Playwright browser is optional).
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

export async function launch() {
  const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const executablePath = candidates.find((p) => existsSync(p));
  return chromium.launch({
    executablePath,
    headless: true,
    // Default uses the real graphics card through EGL; GL=soft forces software rendering (SwiftShader).
    args: [...((process.env.GL || 'gpu') === 'gpu' ? ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] : process.env.GL === 'vulkan' ? ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--autoplay-policy=no-user-gesture-required'],
  });
}

export function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
