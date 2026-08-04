import { useMutation } from "@tanstack/react-query";
import { apiUrl } from "./api-client";

export interface UploadedFile {
  id: string;
  nomeOriginal: string;
}

interface CreateUploadUrlResponse {
  fileId: string;
  uploadUrl: string;
}

/**
 * Upload direto para o storage S3-compatible (ver apps/api/src/files): pede uma URL assinada de
 * envio, faz o PUT do arquivo direto pro storage (não passa pelo backend, evita duplo tráfego) e
 * confirma. O `fileId` retornado é a referência estável a guardar — nunca a URL de download, que
 * expira em minutos (resolvida de novo a cada envio, ver ChatbotEngineService.sendNodeMessage).
 */
export function useUploadFile() {
  return useMutation({
    mutationFn: async ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }): Promise<UploadedFile> => {
      const uploadUrlRes = await fetch(apiUrl("/files/upload-url"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeOriginal: file.name,
          mimeType: file.type || "application/octet-stream",
          tamanho: file.size,
        }),
      });
      if (!uploadUrlRes.ok) {
        const body = await uploadUrlRes.json().catch(() => null);
        throw new Error((body?.message as string) ?? `Não foi possível iniciar o envio (${uploadUrlRes.status}).`);
      }
      const { fileId, uploadUrl } = (await uploadUrlRes.json()) as CreateUploadUrlResponse;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Envio falhou (${xhr.status}).`)));
        xhr.onerror = () => reject(new Error("Envio falhou — verifique a conexão e tente novamente."));
        xhr.send(file);
      });

      const confirmRes = await fetch(apiUrl(`/files/${fileId}/confirm`), { method: "POST", credentials: "include" });
      if (!confirmRes.ok) {
        throw new Error("Não foi possível confirmar o envio do arquivo.");
      }

      return { id: fileId, nomeOriginal: file.name };
    },
  });
}
