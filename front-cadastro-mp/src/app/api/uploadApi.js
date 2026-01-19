import { httpClient } from "./httpClient";

/**
 * IMPORTANTE:
 * Seu backend ainda não expôs uma rota de upload binário nos arquivos enviados.
 * Quando você criar (ex.: POST /api/files/upload), implemente aqui.
 */
export async function uploadFilesApi(files) {
  // Exemplo de como seria com multipart/form-data:
  // const form = new FormData();
  // files.forEach((f) => form.append("files", f));
  // const { data } = await httpClient.post("/files/upload", form);
  // return data; // deve retornar [{original_name, stored_name, sha256, size_bytes, content_type}]
  throw new Error("Upload ainda não implementado no backend.");
}
