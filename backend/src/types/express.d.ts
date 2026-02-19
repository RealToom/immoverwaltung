declare namespace Express {
  interface Request {
    user?: {
      id: number;
      companyId: number;
      role: string;
    };
    companyId?: number;
  }
}
