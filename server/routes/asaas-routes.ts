import { Express, Request, Response } from "express";
import { resolveBossContext as resolveAsaasCustomer } from "../boss/boss-client-service";
import { orchestrateAsaasCharge, retryDriveUploadForContract } from "../asaas/charge-orchestrator";
import { SafeLogger, sanitizeErrorMessage } from "../utils/safe-logger";

export function setupAsaasRoutes(app: Express, db: any, createGoogleDocsJwtClient: any) {
  SafeLogger.info("Setting up ASAAS integration routes...");

  // Helper to get session operator
  const getOperatorFromSession = (req: Request) => {
    if (req.signedCookies?.boss_session) {
      try {
        const session = JSON.parse(req.signedCookies.boss_session);
        return {
          userId: session.uid || "SYSTEM",
          name: session.name || session.email || "Operador BOSS",
        };
      } catch {
        // Fallback
      }
    }
    return {
      userId: "SYSTEM",
      name: "Operador BOSS",
    };
  };

  // 1. GET /api/asaas/context/resolve
  app.get("/api/asaas/context/resolve", async (req: Request, res: Response) => {
    const { caseId } = req.query;

    if (!caseId || typeof caseId !== "string") {
      return res.status(400).json({
        success: false,
        error: "O parâmetro caseId é obrigatório na query.",
      });
    }

    try {
      const bossContext = await resolveAsaasCustomer(db, caseId);
      return res.status(200).json({
        success: true,
        context: bossContext,
      });
    } catch (err: any) {
      SafeLogger.error(`Error resolving BOSS context for case: ${caseId}`, err);
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(err.message),
      });
    }
  });

  // 2. POST /api/asaas/charge/create
  app.post("/api/asaas/charge/create", async (req: Request, res: Response) => {
    const { caseId, charge } = req.body;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: "O parâmetro caseId é obrigatório no corpo da requisição.",
      });
    }

    if (!charge || typeof charge !== "object") {
      return res.status(400).json({
        success: false,
        error: "Os parâmetros da cobrança (charge) são obrigatórios.",
      });
    }

    try {
      SafeLogger.info(`Received API request to create Asaas charge for case ${caseId}`);
      
      // Resolve Google Drive jwtClient
      const { jwtClient } = await createGoogleDocsJwtClient(req);
      const operator = getOperatorFromSession(req);

      const contract = await orchestrateAsaasCharge(db, jwtClient, {
        caseId,
        charge,
        operator,
      });

      return res.status(200).json({
        success: true,
        contract,
      });
    } catch (err: any) {
      SafeLogger.error(`Failed to create Asaas charge for case ${caseId}`, err);
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(err.message),
      });
    }
  });

  // 3. POST /api/asaas/charge/retry-drive
  app.post("/api/asaas/charge/retry-drive", async (req: Request, res: Response) => {
    const { externalReference } = req.body;

    if (!externalReference) {
      return res.status(400).json({
        success: false,
        error: "O parâmetro externalReference é obrigatório no corpo da requisição.",
      });
    }

    try {
      SafeLogger.info(`Received API request to retry Drive upload for contract ${externalReference}`);

      // Resolve Google Drive jwtClient
      const { jwtClient } = await createGoogleDocsJwtClient(req);
      const operator = getOperatorFromSession(req);

      const contract = await retryDriveUploadForContract(db, jwtClient, externalReference, operator);

      return res.status(200).json({
        success: true,
        contract,
      });
    } catch (err: any) {
      SafeLogger.error(`Failed to retry Drive upload for contract ${externalReference}`, err);
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(err.message),
      });
    }
  });

  // 4. GET /api/asaas/contracts/history
  app.get("/api/asaas/contracts/history", async (req: Request, res: Response) => {
    const { caseId } = req.query;

    if (!caseId || typeof caseId !== "string") {
      return res.status(400).json({
        success: false,
        error: "O parâmetro caseId é obrigatório na query.",
      });
    }

    try {
      SafeLogger.info(`Fetching Asaas charge contracts history for case ID: ${caseId}`);
      const snapshot = await db
        .collection("asaas_charge_contracts")
        .where("source.caseId", "==", caseId)
        .get();

      const contracts: any[] = [];
      snapshot.forEach((doc: any) => {
        contracts.push(doc.data());
      });

      // Sort by operation.createdAt descending
      contracts.sort((a, b) => {
        return new Date(b.operation.createdAt).getTime() - new Date(a.operation.createdAt).getTime();
      });

      return res.status(200).json({
        success: true,
        contracts,
      });
    } catch (err: any) {
      SafeLogger.error(`Failed to load contracts history for case: ${caseId}`, err);
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(err.message),
      });
    }
  });

  SafeLogger.info("ASAAS integration routes successfully set up.");
}
