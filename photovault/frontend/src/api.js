import { getToken } from "./auth";

const API = import.meta.env.VITE_API_URL;

async function authFetch(path, options = {}) {
  const token = await getToken();
  if (!token) throw new Error("Session expired. Please log in again.");
  const res = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function uploadImage(file) {
  const { uploadUrl } = await authFetch("/upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type }),
  });
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("Upload to S3 failed");
}

export const listImages = async (tag = "") =>
  (await authFetch(`/images${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`)).images;
