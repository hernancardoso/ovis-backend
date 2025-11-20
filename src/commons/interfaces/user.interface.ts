export interface User {
  name: string;
  email: string;
  establishmentId?: string;
  establishmentIds?: string[];
  isAdmin?: boolean;
}
