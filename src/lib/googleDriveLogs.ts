import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface LogStep {
  step: string;
  status: 'success' | 'failed' | 'pending' | 'processing' | 'timeout';
  message: string;
  timestamp: string;
  source: 'Portal BOSS' | 'Build Google Drive' | 'Firestore' | 'Google Drive API';
  details: Record<string, any>;
}

export interface GoogleDriveJob {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'timeout';
  overallStatus: 'pending' | 'processing' | 'success' | 'failed' | 'timeout' | 'partial_success';
  clientType: 'PF' | 'PJ';
  portalClientId: string;
  caseId: string;
  clientFolderName: string;
  originBlock: string;
  originField: string;
  googleDriveClientFolderId?: string;
  googleDriveClientFolderUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  errorStack?: string;
  logs: LogStep[];
}

/**
 * Computes the 8 steps of our Google Drive Integration workflow as a virtual logs array.
 */
export function computeLogsForJob(jobData: any, currentUserEmail?: string | null): { overallStatus: string; logs: LogStep[] } {
  const createdAt = jobData.createdAt || new Date().toISOString();
  const updatedAt = jobData.updatedAt || jobData.createdAt || new Date().toISOString();
  const email = jobData.createdBy || currentUserEmail || 'Usuário do Portal';

  // Parse fields safely
  const status = jobData.status || 'pending';
  const folderId = jobData.googleDriveClientFolderId || jobData.folderId || '';
  const folderUrl = jobData.googleDriveClientFolderUrl || jobData.folderUrl || jobData.url || '';
  const errorMsg = jobData.errorMessage || jobData.error || jobData.logFalha || jobData.message || '';

  // Determine if it was a timeout (Created more than 60 seconds ago and still pending)
  const isTimeout = status === 'pending' && (Date.now() - new Date(createdAt).getTime() > 60000);

  // Determine overall status
  let overallStatus: 'pending' | 'processing' | 'success' | 'failed' | 'timeout' | 'partial_success' = 'pending';
  if (isTimeout) {
    overallStatus = 'timeout';
  } else if (status === 'success') {
    if (folderId && folderUrl) {
      overallStatus = 'success';
    } else {
      overallStatus = 'partial_success';
    }
  } else if (status === 'failed') {
    overallStatus = 'failed';
  } else if (status === 'processing') {
    overallStatus = 'processing';
  }

  const logs: LogStep[] = [];

  // Etapa 1 — Portal BOSS criou o job
  logs.push({
    step: 'Etapa 1 — Portal BOSS criou o job',
    status: 'success',
    message: 'Job criado no Firestore com sucesso',
    timestamp: createdAt,
    source: 'Portal BOSS',
    details: { createdBy: email, clientType: jobData.clientType, clientFolderName: jobData.clientFolderName }
  });

  // Etapa 2 — Job salvo na coleção googleDriveJobs
  logs.push({
    step: 'Etapa 2 — Job salvo na coleção googleDriveJobs',
    status: 'pending', // or success once saved
    message: 'Documento salvo na coleção googleDriveJobs',
    timestamp: createdAt,
    source: 'Firestore',
    details: { collection: 'googleDriveJobs', id: jobData.id }
  });

  // Etapa 3 — Build Google Drive detectou o job
  if (isTimeout) {
    logs.push({
      step: 'Etapa 3 — Build Google Drive detectou o job',
      status: 'timeout',
      message: 'Build Google Drive não detectou o job dentro do tempo esperado. Verifique se ambos estão usando o mesmo firestoreDatabaseId.',
      timestamp: new Date(new Date(createdAt).getTime() + 60000).toISOString(),
      source: 'Build Google Drive',
      details: { timeoutLimit: '60s' }
    });
  } else if (status !== 'pending') {
    logs.push({
      step: 'Etapa 3 — Build Google Drive detectou o job',
      status: 'success',
      message: 'Build Google Drive detectou o job',
      timestamp: updatedAt,
      source: 'Build Google Drive',
      details: { status }
    });
  } else {
    logs.push({
      step: 'Etapa 3 — Build Google Drive detectou o job',
      status: 'pending',
      message: 'Aguardando detecção pelo Build Google Drive...',
      timestamp: updatedAt,
      source: 'Build Google Drive',
      details: {}
    });
  }

  // Etapa 4 — Autenticação Google Drive
  if (overallStatus === 'success' || overallStatus === 'partial_success') {
    logs.push({
      step: 'Etapa 4 — Autenticação Google Drive',
      status: 'success',
      message: 'Autenticação Google Drive válida',
      timestamp: updatedAt,
      source: 'Google Drive API',
      details: { authenticated: true }
    });
  } else if (overallStatus === 'failed') {
    const isAuthError = errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('creden') || errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('token');
    logs.push({
      step: 'Etapa 4 — Autenticação Google Drive',
      status: isAuthError ? 'failed' : 'success',
      message: isAuthError ? 'Falha na autenticação Google Drive' : 'Autenticação Google Drive válida',
      timestamp: updatedAt,
      source: 'Google Drive API',
      details: { error: errorMsg }
    });
  } else {
    logs.push({
      step: 'Etapa 4 — Autenticação Google Drive',
      status: 'pending',
      message: 'Aguardando autenticação...',
      timestamp: updatedAt,
      source: 'Google Drive API',
      details: {}
    });
  }

  // Etapa 5 — Criação da pasta no Google Drive
  if (overallStatus === 'success') {
    logs.push({
      step: 'Etapa 5 — Criação da pasta no Google Drive',
      status: 'success',
      message: 'Pasta criada com sucesso',
      timestamp: updatedAt,
      source: 'Google Drive API',
      details: { folderId }
    });
  } else if (overallStatus === 'partial_success') {
    logs.push({
      step: 'Etapa 5 — Criação da pasta no Google Drive',
      status: 'failed',
      message: 'Falha ou sucesso parcial ao criar pasta no Google Drive',
      timestamp: updatedAt,
      source: 'Google Drive API',
      details: { folderId, folderUrl }
    });
  } else if (overallStatus === 'failed') {
    logs.push({
      step: 'Etapa 5 — Criação da pasta no Google Drive',
      status: 'failed',
      message: 'Falha ao criar pasta no Google Drive',
      timestamp: updatedAt,
      source: 'Google Drive API',
      details: { error: errorMsg }
    });
  } else {
    logs.push({
      step: 'Etapa 5 — Criação da pasta no Google Drive',
      status: 'pending',
      message: 'Aguardando criação da pasta...',
      timestamp: updatedAt,
      source: 'Google Drive API',
      details: {}
    });
  }

  // Etapa 6 — Retorno dos dados ao Firestore
  if (folderId && folderUrl) {
    logs.push({
      step: 'Etapa 6 — Retorno dos dados ao Firestore',
      status: 'success',
      message: 'Retorno gravado no documento do job',
      timestamp: updatedAt,
      source: 'Firestore',
      details: { googleDriveClientFolderId: folderId, googleDriveClientFolderUrl: folderUrl }
    });
  } else if (overallStatus === 'failed') {
    logs.push({
      step: 'Etapa 6 — Retorno dos dados ao Firestore',
      status: 'failed',
      message: 'Retorno ausente ou incompleto',
      timestamp: updatedAt,
      source: 'Firestore',
      details: { error: errorMsg }
    });
  } else if (overallStatus === 'partial_success') {
    logs.push({
      step: 'Etapa 6 — Retorno dos dados ao Firestore',
      status: 'failed',
      message: 'Retorno incompleto (ID ou URL ausentes)',
      timestamp: updatedAt,
      source: 'Firestore',
      details: { folderId, folderUrl }
    });
  } else {
    logs.push({
      step: 'Etapa 6 — Retorno dos dados ao Firestore',
      status: 'pending',
      message: 'Aguardando retorno de dados...',
      timestamp: updatedAt,
      source: 'Firestore',
      details: {}
    });
  }

  // Etapa 7 — Portal BOSS leu o retorno
  if (overallStatus === 'success') {
    logs.push({
      step: 'Etapa 7 — Portal BOSS leu o retorno',
      status: 'success',
      message: 'Portal BOSS detectou atualização do job',
      timestamp: updatedAt,
      source: 'Portal BOSS',
      details: { detectedStatus: status }
    });
  } else if (overallStatus === 'failed' || overallStatus === 'partial_success' || overallStatus === 'timeout') {
    logs.push({
      step: 'Etapa 7 — Portal BOSS leu o retorno',
      status: 'failed',
      message: 'Portal BOSS não detectou atualização do job com sucesso',
      timestamp: updatedAt,
      source: 'Portal BOSS',
      details: { overallStatus }
    });
  } else {
    logs.push({
      step: 'Etapa 7 — Portal BOSS leu o retorno',
      status: 'pending',
      message: 'Aguardando recepção do retorno...',
      timestamp: updatedAt,
      source: 'Portal BOSS',
      details: {}
    });
  }

  // Etapa 8 — Portal BOSS salvou os dados no cadastro do cliente
  if (overallStatus === 'success') {
    logs.push({
      step: 'Etapa 8 — Portal BOSS salvou os dados no cadastro do cliente',
      status: 'success',
      message: 'Dados do Google Drive vinculados ao cadastro do cliente',
      timestamp: updatedAt,
      source: 'Portal BOSS',
      details: { linked: true, clientsCollectionUpdated: true }
    });
  } else if (overallStatus === 'failed' || overallStatus === 'partial_success' || overallStatus === 'timeout') {
    logs.push({
      step: 'Etapa 8 — Portal BOSS salvou os dados no cadastro do cliente',
      status: 'failed',
      message: `Falha ao salvar dados no cadastro do cliente: ${errorMsg || 'Timeout'}`,
      timestamp: updatedAt,
      source: 'Portal BOSS',
      details: { error: errorMsg }
    });
  } else {
    logs.push({
      step: 'Etapa 8 — Portal BOSS salvou os dados no cadastro do cliente',
      status: 'pending',
      message: 'Aguardando salvamento...',
      timestamp: updatedAt,
      source: 'Portal BOSS',
      details: {}
    });
  }

  return {
    overallStatus,
    logs
  };
}

/**
 * Persists the computed logs and status fields into the Firestore document of the job.
 * Ensures the document remains fully in-sync with the computed logs state machine.
 */
export async function syncJobLogsInFirestore(jobId: string, currentJobData: any, currentUserEmail?: string | null) {
  const { overallStatus, logs } = computeLogsForJob(currentJobData, currentUserEmail);
  
  // If the stored logs array matches what we just computed, skip to avoid write loop
  if (
    currentJobData.overallStatus === overallStatus &&
    currentJobData.logs &&
    currentJobData.logs.length === logs.length &&
    currentJobData.logs[currentJobData.logs.length - 1]?.status === logs[logs.length - 1]?.status
  ) {
    return { overallStatus, logs };
  }

  const updatedFields: Record<string, any> = {
    overallStatus,
    logs,
    updatedAt: new Date().toISOString()
  };

  // If timeout occurred, also flag status: 'timeout' or leave status as 'failed' depending on logic
  if (overallStatus === 'timeout' && currentJobData.status === 'pending') {
    updatedFields.status = 'timeout';
    updatedFields.errorMessage = "Build Google Drive não detectou o job dentro do tempo esperado. Verifique se ambos estão usando o mesmo firestoreDatabaseId.";
    updatedFields.errorCode = "TIMEOUT";
  }

  const jobRef = doc(db, 'googleDriveJobs', jobId);
  try {
    await setDoc(jobRef, updatedFields, { merge: true });
    // Incorporate updated fields into jobData
    Object.assign(currentJobData, updatedFields);
  } catch (error) {
    console.error(`Error syncing job ${jobId} logs in Firestore:`, error);
  }

  return { overallStatus, logs };
}
