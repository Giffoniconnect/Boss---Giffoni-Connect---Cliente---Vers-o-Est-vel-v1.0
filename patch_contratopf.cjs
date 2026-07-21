const fs = require('fs');
let code = fs.readFileSync('src/pages/boss/fluxo-producao/coleta/ContratoHonorariosPF.tsx', 'utf8');

const handleGeneratePreviewRegex = /const\s+handleGeneratePreview\s*=\s*async\s*\(\)\s*=>\s*\{/g;
const previewMatch = handleGeneratePreviewRegex.exec(code);

if (previewMatch) {
  console.log("previewMatch found at index " + previewMatch.index);
} else {
  console.log("handleGeneratePreview not found.");
}
