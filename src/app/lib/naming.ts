/** A project that was just made asks for its name: the project view puts the cursor in the name field, once. */
let asking: string | null = null;

export const askProjectName = (id: string) => { asking = id; };

export function takeProjectNameAsk(id: string): boolean {
  if (asking !== id) return false;
  asking = null;
  return true;
}
