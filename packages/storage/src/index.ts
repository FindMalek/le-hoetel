export interface StorageConfig {
  endpoint?: string
  region: string
  bucket?: string
  accessKeyId?: string
  secretAccessKey?: string
  /** `pr-<n>/` on previews, so a closed PR's uploads can be deleted together. */
  prefix: string
}

export interface Storage {
  bucket: string
  prefix: string
  put(key: string, data: Blob | ArrayBuffer, type: string): Promise<void>
  /** A short-lived url to read a private object. */
  url(key: string): string
  /** A short-lived url the browser PUTs an object to, with the content type it must send. */
  presignPut(key: string, type: string): string
  stat(key: string): Promise<{ size: number; type: string } | null>
  remove(key: string): Promise<void>
}

/** Everything a hotel owns lives under this key prefix. The only place hotel keys are built. */
export const hotelPrefix = (storage: Pick<Storage, "prefix">, hotelId: string) => `${storage.prefix}hotels/${hotelId}/`

/** Hotel files the world may read (logos): `hotels/<id>/public/`. Anything else under a hotel stays private. */
export const hotelPublicPrefix = (storage: Pick<Storage, "prefix">, hotelId: string) =>
  `${hotelPrefix(storage, hotelId)}public/`

/** Keys the unauthenticated `/files/` route may redirect to: avatars and hotel public files, never a hotel's private prefix. */
export function isPublicKey(storage: Pick<Storage, "prefix">, key: string): boolean {
  if (key.includes("..") || !key.startsWith(storage.prefix)) return false
  return /^(avatars\/[^/]+|hotels\/[^/]+\/public\/[^/]+)$/.test(key.slice(storage.prefix.length))
}

/** Any S3 API (Garage, R2, AWS, MinIO) through Bun's built-in client; null when no bucket is configured. */
export function createStorage(config: StorageConfig): Storage | null {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey, prefix } = config
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  const client = new Bun.S3Client({ endpoint, region, bucket, accessKeyId, secretAccessKey })
  return {
    bucket,
    prefix,
    async put(key, data, type) {
      await client.write(key, data, { type })
    },
    url(key) {
      return client.presign(key, { expiresIn: 3600 })
    },
    presignPut(key, type) {
      return client.presign(key, { method: "PUT", type, expiresIn: 300 })
    },
    async stat(key) {
      const file = client.file(key)
      if (!(await file.exists())) return null
      const { size, type } = await file.stat()
      return { size, type }
    },
    async remove(key) {
      await client.delete(key)
    },
  }
}
