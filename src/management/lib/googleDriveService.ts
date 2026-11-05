/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleDriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

/**
 * List files and subfolders within a specific directory in Google Drive.
 * Defaults to 'root' as the starting location.
 */
export async function listDriveFiles(
  accessToken: string,
  parentId: string = 'root'
): Promise<GoogleDriveItem[]> {
  try {
    // Construct search query for direct children of parentId, excluding trashed items
    const query = `'${parentId}' in parents and trashed = false`;
    const fields = 'files(id, name, mimeType, size, webViewLink, iconLink, thumbnailLink)';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=folder,name`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Fallo del API de Google Drive al listar: ${res.status}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Error al listar archivos de Google Drive:', error);
    throw error;
  }
}

/**
 * Downloads a file from Google Drive and returns it as a Base64 string + mimeType.
 * Suitable for direct processing by the server-side Gemini scanner.
 */
export async function downloadFileAsBase64(
  accessToken: string,
  fileId: string
): Promise<{ base64Data: string; mimeType: string; filename: string }> {
  try {
    // 1. Fetch metadata first to get correct filename and mimeType
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`;
    const metaRes = await fetch(metaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!metaRes.ok) {
      throw new Error(`Error recuperando metadata del archivo: ${metaRes.status}`);
    }

    const metadata = await metaRes.json();
    const filename = metadata.name || 'document.pdf';
    const mimeType = metadata.mimeType || 'application/pdf';

    // 2. Download media binary content
    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const mediaRes = await fetch(mediaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mediaRes.ok) {
      throw new Error(`Error descargando contenido del archivo: ${mediaRes.status}`);
    }

    const blob = await mediaRes.blob();
    
    // 3. Convert blob to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip out the data url scheme prefix if it got appended
        const cleanBase64 = result.split(',')[1] || result;
        resolve(cleanBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return { base64Data, mimeType, filename };
  } catch (error) {
    console.error('Error descargando archivo de Google Drive:', error);
    throw error;
  }
}

/**
 * Locate or create a destination folder in Google Drive.
 */
async function getOrCreateAppFolder(accessToken: string, folderName: string): Promise<string> {
  // Query to find existing folder by name
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

  const searchRes = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!searchRes.ok) {
    throw new Error('Fallo buscando directorio Uniproyect en Google Drive.');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id; // Found existing
  }

  // If not found, create new folder
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Fallo al inicializar directorio Uniproyect.');
  }

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Upload a document to Google Drive under a dedicated "Control_Uniproyect" folder.
 */
export async function uploadReportToDrive(
  accessToken: string,
  fileName: string,
  textDescription: string,
  structuredReport: any
): Promise<{ fileId: string; webViewLink: string; folderName: string }> {
  try {
    const folderName = 'Control_Uniproyect';
    
    // Acquire Uniproyect's directory reference
    const folderId = await getOrCreateAppFolder(accessToken, folderName);

    // Prepare complete Markdown summary payload for Google Drive
    const reportHeadline = `# BALANCE DE AUDITORÍA CONTINUA - UNIPROYECT\n`;
    const finalContent = `${reportHeadline}\nGenerado el: ${new Date().toLocaleString('es-ES')}\n\n${textDescription}\n\n## Estructura de Datos Técnicos (Resumen):\n\`\`\`json\n${JSON.stringify(structuredReport, null, 2)}\n\`\`\``;

    // Construct Multipart metadata
    const metadata = {
      name: fileName,
      mimeType: 'text/markdown',
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append(
      'file',
      new Blob([finalContent], { type: 'text/markdown' })
    );

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Fallo subiendo informe: ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    return {
      fileId: uploadData.id,
      webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`,
      folderName,
    };
  } catch (error) {
    console.error('Error al exportar informe a Google Drive:', error);
    throw error;
  }
}

/**
 * Recursively find or create a nested folder structure in Google Drive and return the leaf folder ID.
 */
export async function getOrCreateDriveFolderAtPath(
  accessToken: string,
  pathSegments: string[]
): Promise<string> {
  let parentId = 'root';
  for (const segment of pathSegments) {
    if (!segment || !segment.trim()) continue;
    
    // Safely escape single quotes for search query
    const escapedSegment = segment.replace(/'/g, "\\'");
    const query = `name = '${escapedSegment}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Fallo buscando la carpeta "${segment}" en Google Drive.`);
    }
    
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      parentId = data.files[0].id;
    } else {
      // Create it
      const createUrl = 'https://www.googleapis.com/drive/v3/files';
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: segment,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      });
      
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Fallo creando la carpeta "${segment}" en Google Drive.`);
      }
      
      const createData = await createRes.json();
      parentId = createData.id;
    }
  }
  return parentId;
}

/**
 * Uploads a text, HTML, CSV or JSON file to a specific Google Drive folder.
 */
export async function uploadFileToFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  contentStr: string,
  mimeType: string = 'text/plain'
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([contentStr], { type: mimeType })
  );

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Fallo al subir el archivo "${fileName}": ${uploadRes.status}`);
  }

  const uploadData = await uploadRes.json();
  return {
    id: uploadData.id,
    webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`,
  };
}

/**
 * Uploads a real binary File or Blob directly to a specific Google Drive folder.
 */
export async function uploadBinaryToDriveFolder(
  accessToken: string,
  folderId: string,
  file: File | Blob,
  fileName: string
): Promise<{ id: string; webViewLink: string }> {
  try {
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append(
      'file',
      file
    );

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Fallo subiendo el archivo binario: ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    return {
      id: uploadData.id,
      webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`,
    };
  } catch (err: any) {
    console.error('Error in uploadBinaryToDriveFolder:', err);
    throw err;
  }
}

/**
 * The canonical single master backup file name stored in Google Drive
 */
export const MASTER_DRIVE_BACKUP_FILENAME = 'COPIA_SEGURIDAD_GLOBAL_UNIPROYECT.json';
export const MASTER_DRIVE_BACKUP_FOLDER = 'Control_Uniproyect';

/**
 * Searches for a specific file by name in a Google Drive folder.
 */
export async function findFileInFolder(
  accessToken: string,
  folderId: string,
  fileName: string
): Promise<GoogleDriveItem | null> {
  try {
    const escapedFileName = fileName.replace(/'/g, "\\'");
    const query = `name = '${escapedFileName}' and '${folderId}' in parents and trashed = false`;
    const fields = 'files(id, name, mimeType, size, webViewLink, iconLink, thumbnailLink)';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error buscando archivo en Drive: ${res.status}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  } catch (error) {
    console.error('Error in findFileInFolder:', error);
    throw error;
  }
}

/**
 * Upserts (creates or overwrites in-place) the single canonical backup file in Google Drive.
 * Replaces and overwrites the exact same file in the cloud so there is only 1 master copy.
 */
export async function upsertMasterBackupFile(
  accessToken: string,
  backupData: any
): Promise<{
  fileId: string;
  webViewLink: string;
  folderName: string;
  updatedTime: string;
  sizeBytes: number;
  isNew: boolean;
}> {
  try {
    const folderId = await getOrCreateAppFolder(accessToken, MASTER_DRIVE_BACKUP_FOLDER);
    const contentStr = typeof backupData === 'string' ? backupData : JSON.stringify(backupData, null, 2);
    const sizeBytes = new Blob([contentStr]).size;

    // 1. Check if the master backup file already exists in the folder
    const existingFile = await findFileInFolder(accessToken, folderId, MASTER_DRIVE_BACKUP_FILENAME);

    if (existingFile) {
      // Overwrite/replace the exact same file in-place using PATCH upload
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media&fields=id,name,webViewLink,modifiedTime`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: contentStr,
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Fallo al sobrescribir copia en Drive: ${updateRes.status}`);
      }

      const updateData = await updateRes.json();
      return {
        fileId: updateData.id || existingFile.id,
        webViewLink: updateData.webViewLink || existingFile.webViewLink || `https://drive.google.com/file/d/${existingFile.id}/view`,
        folderName: MASTER_DRIVE_BACKUP_FOLDER,
        updatedTime: updateData.modifiedTime || new Date().toISOString(),
        sizeBytes,
        isNew: false,
      };
    } else {
      // Create the file for the first time in the folder
      const metadata = {
        name: MASTER_DRIVE_BACKUP_FILENAME,
        mimeType: 'application/json',
        parents: [folderId],
        description: 'Copia de seguridad maestra consolidada con todos los gastos y datos de Uniproyect.',
      };

      const form = new FormData();
      form.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      );
      form.append(
        'file',
        new Blob([contentStr], { type: 'application/json' })
      );

      const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime';
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Fallo al crear copia en Drive: ${createRes.status}`);
      }

      const createData = await createRes.json();
      return {
        fileId: createData.id,
        webViewLink: createData.webViewLink || `https://drive.google.com/file/d/${createData.id}/view`,
        folderName: MASTER_DRIVE_BACKUP_FOLDER,
        updatedTime: createData.modifiedTime || new Date().toISOString(),
        sizeBytes,
        isNew: true,
      };
    }
  } catch (error) {
    console.error('Error in upsertMasterBackupFile:', error);
    throw error;
  }
}

/**
 * Downloads and parses the master backup file stored in Google Drive.
 */
export async function downloadMasterBackupFromDrive(
  accessToken: string
): Promise<{
  data: any;
  updatedTime: string;
  fileId: string;
  name: string;
  webViewLink: string;
  sizeBytes?: number;
} | null> {
  try {
    const folderId = await getOrCreateAppFolder(accessToken, MASTER_DRIVE_BACKUP_FOLDER);
    const file = await findFileInFolder(accessToken, folderId, MASTER_DRIVE_BACKUP_FILENAME);

    if (!file) {
      // Fallback search across the whole drive in case it was moved outside the folder
      const escapedFileName = MASTER_DRIVE_BACKUP_FILENAME.replace(/'/g, "\\'");
      const query = `name = '${escapedFileName}' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,webViewLink,modifiedTime)&orderBy=modifiedTime desc`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          const fallbackFile = data.files[0];
          return await fetchDriveJsonContent(accessToken, fallbackFile.id, fallbackFile);
        }
      }
      return null;
    }

    return await fetchDriveJsonContent(accessToken, file.id, file);
  } catch (error) {
    console.error('Error downloading master backup from Drive:', error);
    throw error;
  }
}

async function fetchDriveJsonContent(accessToken: string, fileId: string, fileMeta: any) {
  const mediaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const mediaRes = await fetch(mediaUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mediaRes.ok) {
    throw new Error(`Error descargando contenido de la copia de Drive: ${mediaRes.status}`);
  }

  const rawJson = await mediaRes.json();
  return {
    data: rawJson,
    updatedTime: fileMeta.modifiedTime || new Date().toISOString(),
    fileId,
    name: fileMeta.name || MASTER_DRIVE_BACKUP_FILENAME,
    webViewLink: fileMeta.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    sizeBytes: fileMeta.size ? parseInt(fileMeta.size, 10) : undefined,
  };
}


