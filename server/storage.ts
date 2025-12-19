// Simplified storage - no backend persistence needed for URL transformer app
export interface IStorage {}

export class MemStorage implements IStorage {}

export const storage = new MemStorage();
