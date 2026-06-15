const EDIT_THRESHOLD_MS = 1000;

export function isPostEdited(createdAt: string, updatedAt: string): boolean {
  return (
    new Date(updatedAt).getTime() - new Date(createdAt).getTime() > EDIT_THRESHOLD_MS
  );
}
