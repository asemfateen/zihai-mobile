const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function renderSvgHtml(width, height, type = 'splash') {
  // type: 'splash' | 'icon' | 'foreground' | 'background' | 'monochrome'
  const isSplash = type === 'splash' || type === 'foreground' || type === 'monochrome';
  const isRound = type === 'round';
  const isMonochrome = type === 'monochrome';

  // For foreground (adaptive icon), safe zone is central 66% (72dp of 108dp)
  const scale = (type === 'foreground' || type === 'monochrome') ? 0.44 : 0.56;
  const svgWidth = Math.round(width * scale);
  const svgHeight = Math.round(svgWidth * 0.52);
  const fontSize = Math.round(svgHeight * 0.88);
  const yPos = Math.round(svgHeight * 0.82);

  let bgStyle = 'background: transparent;';
  if (type === 'background') {
    bgStyle = 'background: #1a1c1a;';
  } else if (type === 'icon') {
    bgStyle = 'background: #1a1c1a;';
  } else if (type === 'round') {
    bgStyle = 'background: #1a1c1a; border-radius: 50%;';
  }

  const fillSource = isMonochrome ? '#ffffff' : 'url(#zihaiGrad)';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    ${bgStyle}
    width: ${width}px;
    height: ${height}px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .logo-text {
    font-family: "Noto Sans SC", "Microsoft YaHei", -apple-system, sans-serif;
    font-weight: 900;
    letter-spacing: -${Math.round(fontSize * 0.04)}px;
  }
</style>
</head>
<body>
  ${type === 'background' ? '' : `
  <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="zihaiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#4ade80" />
        <stop offset="50%" stop-color="#f43f5e" />
        <stop offset="100%" stop-color="#f97316" />
      </linearGradient>
    </defs>
    <text class="logo-text" x="${Math.round(svgWidth / 2)}" y="${yPos}" text-anchor="middle" fill="${fillSource}" font-size="${fontSize}">字海</text>
  </svg>
  `}
</body>
</html>`;
}

function renderHtmlToPng(htmlContent, outPngPath, width, height) {
  const tempHtml = path.resolve(__dirname, `_temp_${Date.now()}_${width}x${height}.html`);
  fs.writeFileSync(tempHtml, htmlContent, 'utf8');

  execFileSync(CHROME_PATH, [
    '--headless',
    '--disable-gpu',
    '--default-background-color=00000000',
    `--window-size=${width},${height}`,
    `--screenshot=${outPngPath}`,
    `file:///${tempHtml.replace(/\\/g, '/')}`
  ]);

  if (fs.existsSync(tempHtml)) {
    fs.unlinkSync(tempHtml);
  }
}

async function main() {
  console.log('Rendering complete Zihai brand assets (Splash + App Icons)...');

  const resBase = path.resolve(__dirname, '../android/app/src/main/res');

  // 1. Android Native Splash Screen Logos (drawable-*)
  const splashDensities = [
    { dir: 'drawable-mdpi', size: 288 },
    { dir: 'drawable-hdpi', size: 432 },
    { dir: 'drawable-xhdpi', size: 576 },
    { dir: 'drawable-xxhdpi', size: 864 },
    { dir: 'drawable-xxxhdpi', size: 1152 }
  ];

  for (const { dir, size } of splashDensities) {
    const targetDir = path.join(resBase, dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const outPath = path.join(targetDir, 'splashscreen_logo.png');
    const html = renderSvgHtml(size, size, 'splash');
    renderHtmlToPng(html, outPath, size, size);
    console.log(`✓ ${dir}/splashscreen_logo.png (${size}x${size})`);
  }

  // 2. Android Native Mipmap Icons (ic_launcher, ic_launcher_round, ic_launcher_foreground, etc.)
  const mipmapDensities = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 }
  ];

  for (const { dir, iconSize, fgSize } of mipmapDensities) {
    const targetDir = path.join(resBase, dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.webp
    renderHtmlToPng(renderSvgHtml(iconSize, iconSize, 'icon'), path.join(targetDir, 'ic_launcher.webp'), iconSize, iconSize);

    // ic_launcher_round.webp
    renderHtmlToPng(renderSvgHtml(iconSize, iconSize, 'round'), path.join(targetDir, 'ic_launcher_round.webp'), iconSize, iconSize);

    // ic_launcher_foreground.webp
    renderHtmlToPng(renderSvgHtml(fgSize, fgSize, 'foreground'), path.join(targetDir, 'ic_launcher_foreground.webp'), fgSize, fgSize);

    // ic_launcher_background.webp
    renderHtmlToPng(renderSvgHtml(fgSize, fgSize, 'background'), path.join(targetDir, 'ic_launcher_background.webp'), fgSize, fgSize);

    // ic_launcher_monochrome.webp
    renderHtmlToPng(renderSvgHtml(fgSize, fgSize, 'monochrome'), path.join(targetDir, 'ic_launcher_monochrome.webp'), fgSize, fgSize);

    console.log(`✓ ${dir} icons (${iconSize}x${iconSize} and ${fgSize}x${fgSize})`);
  }

  // 3. Expo Project Assets (mobile/assets/images/)
  const assetsDir = path.resolve(__dirname, '../assets/images');

  // splash-icon.png (used by expo-splash-screen)
  renderHtmlToPng(renderSvgHtml(576, 576, 'splash'), path.join(assetsDir, 'splash-icon.png'), 576, 576);
  console.log('✓ assets/images/splash-icon.png (576x576)');

  // icon.png (standard app icon)
  renderHtmlToPng(renderSvgHtml(1024, 1024, 'icon'), path.join(assetsDir, 'icon.png'), 1024, 1024);
  console.log('✓ assets/images/icon.png (1024x1024)');

  // android-icon-foreground.png (adaptive foreground)
  renderHtmlToPng(renderSvgHtml(512, 512, 'foreground'), path.join(assetsDir, 'android-icon-foreground.png'), 512, 512);
  console.log('✓ assets/images/android-icon-foreground.png (512x512)');

  // android-icon-background.png (adaptive background)
  renderHtmlToPng(renderSvgHtml(512, 512, 'background'), path.join(assetsDir, 'android-icon-background.png'), 512, 512);
  console.log('✓ assets/images/android-icon-background.png (512x512)');

  // android-icon-monochrome.png (monochrome icon)
  renderHtmlToPng(renderSvgHtml(512, 512, 'monochrome'), path.join(assetsDir, 'android-icon-monochrome.png'), 512, 512);
  console.log('✓ assets/images/android-icon-monochrome.png (512x512)');

  // favicon.png
  renderHtmlToPng(renderSvgHtml(192, 192, 'icon'), path.join(assetsDir, 'favicon.png'), 192, 192);
  console.log('✓ assets/images/favicon.png (192x192)');

  console.log('\n🎉 All Zihai splash and icon brand assets generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
