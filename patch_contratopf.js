const fs = require('fs');
let code = fs.readFileSync('src/pages/boss/fluxo-producao/coleta/ContratoHonorariosPF.tsx', 'utf8');

const injection = `
  const buildCanonicalContratoPayload = (placeholdersRecord: Record<string, string>) => {
    const payloadHash = btoa(JSON.stringify(placeholdersRecord));
    return {
      documentType: "contrato_honorarios_pf",
      templateId: "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ",
      caseId,
      clientId: targetClientId,
      placeholders: placeholdersRecord,
      payloadHash
    };
  };
`;

const handleGeneratePreviewRegex = /const\s+handleGeneratePreview\s*=\s*async\s*\(\)\s*=>\s*\{/g;
const previewMatch = handleGeneratePreviewRegex.exec(code);

if (previewMatch) {
  console.log("previewMatch found.");
} else {
  console.error("handleGeneratePreview not found.");
}
