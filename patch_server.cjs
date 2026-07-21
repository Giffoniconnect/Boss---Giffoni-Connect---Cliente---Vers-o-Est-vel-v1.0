const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const target = `    if (replaceRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: googleDocsId,
        requestBody: {
          requests: replaceRequests
        }
      });
    }`;

const replace = `    if (replaceRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: googleDocsId,
        requestBody: {
          requests: replaceRequests
        }
      });
    }

    if (documentType === "contrato_honorarios_pf") {
      const docVerify = await docs.documents.get({ documentId: googleDocsId });
      const docContent = JSON.stringify(docVerify.data.body || {});
      const unresolved = [];
      if (docContent.includes("<<Tipo do serviço contratado>>")) unresolved.push("<<Tipo do serviço contratado>>");
      if (docContent.includes("<<clausula_segunda_varia_de_acordo_com_o_tipo_de_contrato_estabelecido>>")) unresolved.push("<<clausula_segunda_varia_de_acordo_com_o_tipo_de_contrato_estabelecido>>");
      if (docContent.includes("<<data da assinatura>>")) unresolved.push("<<data da assinatura>>");
      
      if (unresolved.length > 0) {
        throw { message: \`Um ou mais placeholders não foram substituídos: \${unresolved.join(", ")}\`, errorCode: "CONTRATO_PF_UNRESOLVED_PLACEHOLDER", unresolved };
      }
    }`;

content = content.replace(target, replace);
fs.writeFileSync('server.ts', content);
