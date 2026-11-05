type ShiftEvent = { workerId: string; projectId: string; type: string; timestamp: string };

// Validate against the latest event for this worker, including other projects.
export function validateShift(
  records: ShiftEvent[], workerId: string, projectId: string,
  type: 'check_in' | 'check_out', now: string,
): { error: string } | { hoursWorked?: number } {
  const latest = records.filter(record => record.workerId === workerId)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  if (type === 'check_in') {
    return latest?.type === 'check_in'
      ? { error: 'Ya existe una entrada abierta. Registre la salida antes de volver a entrar.' }
      : {};
  }
  if (!latest || latest.type !== 'check_in') {
    return { error: 'No existe una entrada abierta para registrar esta salida.' };
  }
  if (latest.projectId !== projectId) {
    return { error: 'La salida debe corresponder a la obra de la entrada abierta.' };
  }
  const elapsed = Date.parse(now) - Date.parse(latest.timestamp);
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return { error: 'La fecha de la entrada no permite calcular la jornada.' };
  }
  // Preserve the existing 14-hour ceiling, without inventing a minimum duration.
  return { hoursWorked: Math.min(14, Number((elapsed / 3_600_000).toFixed(2))) };
}
