const fs = require('fs');

// 1. Fix server.ts (getDb)
let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/getDb\(\)\.collection/g, 'dbAdmin.collection');
fs.writeFileSync('server.ts', server);
console.log("server.ts fixed");

// 2. Fix ContratoHonorariosPF.tsx
let pf = fs.readFileSync('src/pages/boss/fluxo-producao/coleta/ContratoHonorariosPF.tsx', 'utf8');

// A. Insert preview states
if (!pf.includes('previewGenerating')) {
  pf = pf.replace(
    'const [activeSubStep, setActiveSubStep] = useState<1 | 2 | 3>(1);',
    'const [activeSubStep, setActiveSubStep] = useState<1 | 2 | 3>(1);\n  const [previewGenerating, setPreviewGenerating] = useState(false);\n  const [previewId, setPreviewId] = useState<string | null>(null);\n  const [previewUrl, setPreviewUrl] = useState<string | null>(null);'
  );
}

// B. Replace targetClientId with caseObj?.clientId || client?.id in buildCanonicalContratoPayload
pf = pf.replace(/clientId: targetClientId,/g, 'clientId: caseObj?.clientId || client?.id,');

// C. Fix resolvedNomeCompleto duplicate.
// It is declared around line 458 and 519.
// We should find the second declaration and change it to just `resolvedNomeCompleto = ...` or remove it if it's identical.
pf = pf.replace(/const resolvedNomeCompleto = \(client\?.nomeCompleto \|\| caseObj\?.clientName \|\| "Cliente"\)\.replace\(\/\[\^a-zA-Z0-9À-ÿ \\-\]\/g, ""\);/g, '');

// Since we removed it entirely, let's insert it exactly once, say right above the `essentialKeys` where it's needed in `handleGenerateContratoGDocs`.
pf = pf.replace(
  'const essentialKeys = [',
  'const resolvedNomeCompleto = (client?.nomeCompleto || caseObj?.clientName || "Cliente").replace(/[^a-zA-Z0-9À-ÿ \\-]/g, "");\n    const essentialKeys = ['
);


fs.writeFileSync('src/pages/boss/fluxo-producao/coleta/ContratoHonorariosPF.tsx', pf);
console.log("ContratoHonorariosPF.tsx fixed");

