declare namespace Express {
  interface Request {
    user?: {
      id: number;
      companyId: number;
      role: string;
    };
    companyId?: number;
    userId?: number;
    tenantUser?: {
      id: number;
      tenantId: number;
      companyId: number;
    };
  }
}
