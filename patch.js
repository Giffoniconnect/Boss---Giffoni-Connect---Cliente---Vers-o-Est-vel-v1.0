const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const search = '  app.listen(PORT, "0.0.0.0", () => {';
const replacement = `
  // B3 - ENDPOINT PARA CRIAR OU ATUALIZAR PRÉVIA
  app.post("/api/google-docs/contract-preview", async (req, res) => {
    try {
      const {
        documentType,
        templateId,
        caseId,
        clientId,
        placeholders,
        payloadHash,
        previewRequestId
      } = req.body;

      if (!documentType || documentType !== "contrato_honorarios_pf") return res.status(400).json({ error: "Invalid documentType" });
      if (!templateId || templateId !== "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ") return res.status(400).json({ error: "Invalid templateId" });
      if (!caseId) return res.status(400).json({ error: "Invalid caseId" });
      if (!clientId) return res.status(400).json({ error: "Invalid clientId" });
      if (!placeholders || typeof placeholders !== 'object') return res.status(400).json({ error: "Invalid placeholders" });
      if (!payloadHash) return res.status(400).json({ error: "Invalid payloadHash" });

      const previewFolderId = process.env.GOOGLE_DOCS_PREVIEW_FOLDER_ID;
      if (!previewFolderId) {
        return res.status(400).json({
          success: false,
          errorCode: "GOOGLE_DOCS_PREVIEW_FOLDER_NOT_CONFIGURED",
          errorMessage: "A pasta segura de prévias do Google Drive não está configurada."
        });
      }

      const { jwtClient } = await createGoogleDocsJwtClient(req);
      const drive = google.drive({ version: "v3", auth: jwtClient });
      const docs = google.docs({ version: "v1", auth: jwtClient });

      const copyResponse = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: \`[PREVIEW] Contrato PF - \${caseId} - \${new Date().getTime()}\`,
          parents: [previewFolderId]
        }
      });
      const googleDocsId = copyResponse.data.id;
      if (!googleDocsId) throw new Error("Falha ao criar cópia do template.");

      const requests = Object.entries(placeholders).map(([key, value]) => ({
        replaceAllText: {
          containsText: {
            text: key,
            matchCase: true,
          },
          replaceText: String(value) || "",
        }
      }));

      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: googleDocsId,
          requestBody: { requests }
        });
      }

      const docInfo = await docs.documents.get({ documentId: googleDocsId });
      const docText = docInfo.data.body?.content?.map(c => c.paragraph?.elements?.map(e => e.textRun?.content).join('')).join('') || '';
      
      if (docText.includes('<<')) {
        console.warn("[PREVIEW] Existem placeholders pendentes no documento.");
      }

      const previewId = googleDocsId;
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const previewRecord = {
        id: previewId,
        caseId,
        clientId,
        documentType,
        templateId,
        googleDocsId: previewId,
        payloadHash,
        purpose: "preview",
        status: "ready",
        createdAt,
        expiresAt,
        createdBy: "portal_boss"
      };

      await getDb().collection("googleDocsPreviews").doc(previewId).set(previewRecord);

      res.json({
        success: true,
        previewId,
        createdAt,
        expiresAt
      });
    } catch (err) {
      console.error("[PREVIEW_ERROR]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // B7 - PDF DA PRÉVIA
  app.get("/api/google-docs/contract-preview/:previewId/pdf", async (req, res) => {
    try {
      const { previewId } = req.params;
      if (!previewId) return res.status(400).json({ error: "Missing previewId" });

      const previewDoc = await getDb().collection("googleDocsPreviews").doc(previewId).get();
      if (!previewDoc.exists) return res.status(404).json({ error: "Preview not found" });

      const previewData = previewDoc.data();
      if (previewData.purpose !== "preview" || previewData.status !== "ready") {
        return res.status(400).json({ error: "Invalid preview record" });
      }

      if (new Date(previewData.expiresAt).getTime() < Date.now()) {
        return res.status(410).json({ error: "Preview expired" });
      }

      const { jwtClient } = await createGoogleDocsJwtClient(req);
      const drive = google.drive({ version: "v3", auth: jwtClient });

      const pdfResponse = await drive.files.export({
        fileId: previewData.googleDocsId,
        mimeType: 'application/pdf'
      }, { responseType: 'stream' });

      res.setHeader('Content-Type', 'application/pdf');
      pdfResponse.data.pipe(res);
    } catch (err) {
      console.error("[PREVIEW_PDF_ERROR]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

` + search;
code = code.replace(search, replacement);
fs.writeFileSync('server.ts', code);
