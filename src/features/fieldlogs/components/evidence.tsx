"use client"

import { Camera, ImagePlus, Loader2, Trash2, X } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/lib/format"
import { newId } from "@/lib/ids"
import { createClient } from "@/lib/supabase/client"
import { deleteAttachment, listAttachments, registerAttachments, type AttachmentView } from "../actions"
import {
  ATTACHMENT_TYPES,
  attachmentPath,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_UPLOAD,
  type AttachmentEntity,
} from "../schemas"

const ACCEPT = ATTACHMENT_TYPES.join(",")

function validFiles(files: File[]): { ok: File[]; rejected: number } {
  const ok = files.filter(
    (f) => (ATTACHMENT_TYPES as readonly string[]).includes(f.type) && f.size > 0 && f.size <= MAX_ATTACHMENT_BYTES
  )
  return { ok: ok.slice(0, MAX_ATTACHMENTS_PER_UPLOAD), rejected: files.length - ok.length }
}

/**
 * Sube fotografías a Storage (ruta organización/tipo/registro) y las registra.
 * Devuelve true si todo quedó guardado. Se llama después de guardar el
 * registro, de modo que un fallo de red no impide la captura de la bitácora.
 */
export async function uploadEvidence(
  organizationId: string,
  entity: AttachmentEntity,
  entityId: string,
  files: File[]
): Promise<boolean> {
  if (files.length === 0) return true
  const supabase = createClient()
  const uploaded: { path: string; name: string; type: (typeof ATTACHMENT_TYPES)[number]; size: number }[] = []
  for (const file of files) {
    const path = attachmentPath(organizationId, entity, entityId, newId(), file.name)
    const { error } = await supabase.storage.from("evidencias").upload(path, file, { contentType: file.type, upsert: false })
    if (error) {
      toast.error(`No se pudo subir "${file.name}". Puedes agregarla después desde Evidencias.`)
      continue
    }
    uploaded.push({ path, name: file.name.slice(0, 200), type: file.type as (typeof ATTACHMENT_TYPES)[number], size: file.size })
  }
  if (uploaded.length === 0) return false
  const result = await registerAttachments(entity, entityId, uploaded)
  if (!result.ok) {
    toast.error(result.error)
    return false
  }
  if (result.message) toast.success(result.message)
  return uploaded.length === files.length
}

/** Selector de fotografías con vista previa (cámara en celulares). */
export function PhotoInput({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const id = useId()
  // Las URL locales (blob:) se liberan cuando cambia la selección o se cierra el formulario.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  return (
    <div className="grid gap-2 sm:col-span-2">
      <Label htmlFor={id}>Fotografías (opcional)</Label>
      <div className="flex flex-wrap items-center gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative size-16 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
            <img src={src} alt={files[i]?.name ?? "Fotografía"} className="size-full object-cover" />
            <button
              type="button"
              className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              aria-label={`Quitar ${files[i]?.name}`}
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        ))}
        {files.length < MAX_ATTACHMENTS_PER_UPLOAD && (
          <label
            htmlFor={id}
            className="flex size-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted"
          >
            <Camera className="size-4" aria-hidden />
            Agregar
          </label>
        )}
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          capture="environment"
          multiple
          className="sr-only"
          onChange={(e) => {
            const { ok, rejected } = validFiles([...files, ...Array.from(e.target.files ?? [])])
            if (rejected > 0) toast.error("Solo imágenes JPG, PNG, WEBP o HEIC de hasta 10 MB.")
            onChange(ok)
            e.target.value = ""
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Hasta {MAX_ATTACHMENTS_PER_UPLOAD} imágenes de 10 MB. Se suben al guardar.</p>
    </div>
  )
}

/** Galería de evidencias de un registro: consultar, agregar y eliminar. */
export function EvidenceDialog({
  organizationId,
  entity,
  entityId,
  title,
  canAdd,
}: {
  organizationId: string
  entity: AttachmentEntity
  entityId: string
  title: string
  canAdd: boolean
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AttachmentView[] | null>(null)
  const [loading, startLoading] = useTransition()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = () =>
    startLoading(async () => {
      const result = await listAttachments(entity, entityId)
      if (result.ok) setItems(result.data)
      else toast.error(result.error)
    })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) load()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Evidencias: ${title}`}>
          <Camera aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Evidencias</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {loading && items === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando…
          </p>
        ) : items?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin fotografías registradas.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items?.map((a) => (
              <li key={a.id} className="space-y-1">
                <a href={a.url ?? undefined} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md border bg-muted">
                  {a.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Storage
                    <img src={a.url} alt={a.name} className="size-full object-cover" loading="lazy" />
                  )}
                </a>
                <div className="flex items-start justify-between gap-1">
                  <p className="min-w-0 truncate text-xs text-muted-foreground" title={a.name}>
                    {formatDateTime(a.createdAt)}
                  </p>
                  {a.canDelete && (
                    <ConfirmAction
                      title="Eliminar fotografía"
                      description={`Se eliminará "${a.name}" de forma permanente.`}
                      confirmLabel="Eliminar"
                      action={async () => {
                        const result = await deleteAttachment(a.id)
                        if (result.ok) setItems((prev) => prev?.filter((x) => x.id !== a.id) ?? null)
                        return result
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" className="size-6" aria-label={`Eliminar ${a.name}`}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      }
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canAdd && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              capture="environment"
              multiple
              className="sr-only"
              onChange={async (e) => {
                const { ok, rejected } = validFiles(Array.from(e.target.files ?? []))
                e.target.value = ""
                if (rejected > 0) toast.error("Solo imágenes JPG, PNG, WEBP o HEIC de hasta 10 MB.")
                if (ok.length === 0) return
                setUploading(true)
                await uploadEvidence(organizationId, entity, entityId, ok)
                setUploading(false)
                load()
              }}
            />
            <Button variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} Agregar fotografías
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
