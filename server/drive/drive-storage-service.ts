import { google } from "googleapis";
import { Readable } from "stream";
import { SafeLogger } from "../utils/safe-logger";

export interface DriveUploadResult {
  driveFileId: string;
  fileName: string;
  mimeType: "application/pdf";
  webViewLink?: string;
  webContentLink?: string;
  uploadedAt: string;
}

export async function verifyDriveFolderAccess(jwtClient: any, folderId: string): Promise<boolean> {
  SafeLogger.info(`Verifying Google Drive folder access: ${folderId}`);
  try {
    const drive = google.drive({ version: "v3", auth: jwtClient });
    const res = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType",
    });

    if (res.data.mimeType !== "application/vnd.google-apps.folder") {
      SafeLogger.error(`ID ${folderId} exists but is not a Google Drive folder. MimeType is: ${res.data.mimeType}`);
      return false;
    }

    SafeLogger.info(`Successfully verified Google Drive folder access to: ${res.data.name}`);
    return true;
  } catch (err: any) {
    SafeLogger.error(`Failed to access Google Drive folder: ${folderId}`, err);
    return false;
  }
}

export async function uploadPdfToDrive(
  jwtClient: any,
  folderId: string,
  fileName: string,
  pdfBuffer: Buffer
): Promise<DriveUploadResult> {
  SafeLogger.info(`Uploading PDF to Google Drive folder: ${folderId}, filename: ${fileName}`);

  try {
    const drive = google.drive({ version: "v3", auth: jwtClient });

    // Stream readable buffer
    const stream = new Readable();
    stream.push(pdfBuffer);
    stream.push(null);

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: "application/pdf",
      body: stream,
    };

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, mimeType, webViewLink, webContentLink",
    });

    const file = res.data;
    if (!file.id) {
      throw new Error("Google Drive response did not return a file ID.");
    }

    SafeLogger.info(`Successfully uploaded PDF to Google Drive. File ID: ${file.id}`);

    return {
      driveFileId: file.id,
      fileName: file.name || fileName,
      mimeType: "application/pdf",
      webViewLink: file.webViewLink || undefined,
      webContentLink: file.webContentLink || undefined,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    SafeLogger.error(`Failed to upload PDF to Google Drive: ${err.message}`, err);
    throw new Error(`Erro ao enviar arquivo PDF para o Google Drive: ${err.message}`);
  }
}
