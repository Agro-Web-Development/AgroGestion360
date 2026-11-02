/** Antigüedad de saldos: días transcurridos desde el vencimiento. */
export const AGING_BUCKETS = ["corriente", "d1_30", "d31_60", "d61_90", "d90"] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

export const AGING_LABELS: Record<AgingBucket, string> = {
  corriente: "Por vencer",
  d1_30: "1–30 días",
  d31_60: "31–60 días",
  d61_90: "61–90 días",
  d90: "Más de 90",
}

export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "corriente"
  if (daysOverdue <= 30) return "d1_30"
  if (daysOverdue <= 60) return "d31_60"
  if (daysOverdue <= 90) return "d61_90"
  return "d90"
}
