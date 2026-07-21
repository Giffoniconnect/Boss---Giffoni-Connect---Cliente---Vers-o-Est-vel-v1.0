const fs = require('fs');
let code = fs.readFileSync('src/pages/boss/fluxo-producao/coleta/ContratoHonorariosPF.tsx', 'utf8');

const regex = /client\?\.pfData\?\.pf_nomeCompleto \|\|[\s\S]*?\)\.trim\(\);/m;
code = code.replace(regex, 'const resolvedNomeCompleto = (client?.pfData?.pf_nomeCompleto || client?.pfDadosPessoais?.pf_nomeCompleto || client?.nomeCompleto || client?.nome || client?.name || "").trim();');

fs.writeFileSync('src/pages/boss/fluxo-producao/coleta/ContratoHonorariosPF.tsx', code);
