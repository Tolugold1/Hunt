import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadResume(
  userId: string,
  buffer: Buffer,
  filename: string,
  _mimeType: string
): Promise<string> {
  const publicId = `resumes/${userId}/${Date.now()}-${filename.replace(/\.[^.]+$/, "")}`;

  const result = await new Promise<{ public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        overwrite: true,
        tags: ["resume", userId],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve(result as { public_id: string });
      }
    );
    uploadStream.end(buffer);
  });

  return result.public_id;
}

export async function getResumeDownloadUrl(publicId: string): Promise<string> {
  return cloudinary.url(publicId, {
    resource_type: "raw",
    sign_url: true,
    // Signed URLs expire after 1 hour
    type: "authenticated",
  });
}

export async function getResumeBuffer(publicId: string): Promise<Buffer> {
  const url = cloudinary.url(publicId, { resource_type: "raw" });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch resume from Cloudinary: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteResume(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
}
