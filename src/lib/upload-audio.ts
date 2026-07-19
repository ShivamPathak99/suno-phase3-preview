export type UploadedAudio = {
  audioUrl: string;
  path: string;
};

type UploadUrlResponse = UploadedAudio & {
  contentType: string;
  signedUrl: string;
};

type UploadUrlFailure = {
  error?: string;
};

const fallbackContentTypes = {
  ".webm": "audio/webm",
  ".mp4": "audio/mp4",
} as const;

type SupportedExtension = keyof typeof fallbackContentTypes;

function extensionFromFileName(fileName: string): SupportedExtension | null {
  const fileNameParts = fileName.split(/[\\/]/);
  const baseName = fileNameParts[fileNameParts.length - 1] ?? "";
  const match = /\.(webm|mp4)$/i.exec(baseName);

  return match ? (`.${match[1].toLowerCase()}` as SupportedExtension) : null;
}

function extensionFromContentType(contentType: string): SupportedExtension | null {
  if (contentType === "audio/webm" || contentType === "video/webm") {
    return ".webm";
  }

  if (contentType === "audio/mp4" || contentType === "video/mp4") {
    return ".mp4";
  }

  return null;
}

function normaliseContentType(contentType: string) {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function prepareFileMetadata(file: File) {
  const declaredContentType = normaliseContentType(file.type);
  const extension =
    extensionFromFileName(file.name) ?? extensionFromContentType(declaredContentType);

  if (!extension) {
    throw new Error("Use a WebM or MP4 recording.");
  }

  const contentType = declaredContentType || fallbackContentTypes[extension];
  const fileName = file.name || `recording${extension}`;

  return { contentType, fileName };
}

async function getUploadUrl(fileName: string, contentType: string, signal?: AbortSignal) {
  const response = await fetch("/api/upload-url", {
    body: JSON.stringify({ contentType, fileName }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | UploadUrlResponse
    | UploadUrlFailure
    | null;

  if (!response.ok || !payload || !("signedUrl" in payload)) {
    const message = payload && "error" in payload ? payload.error : undefined;
    throw new Error(message ?? "Unable to prepare the audio upload.");
  }

  return payload;
}

/**
 * Uploads browser-captured audio directly to Supabase. The service-role key
 * stays on the server; the browser receives only a short-lived, single-object
 * upload URL.
 */
export async function uploadAudioFile(file: File, signal?: AbortSignal): Promise<UploadedAudio> {
  const { contentType, fileName } = prepareFileMetadata(file);
  const upload = await getUploadUrl(fileName, contentType, signal);
  const response = await fetch(upload.signedUrl, {
    body: file,
    headers: {
      "cache-control": "max-age=3600",
      "content-type": upload.contentType,
    },
    method: "PUT",
    signal,
  });

  if (!response.ok) {
    throw new Error("The audio upload did not complete. Please try again.");
  }

  return { audioUrl: upload.audioUrl, path: upload.path };
}
