import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { tenantGuard } from "../middleware/tenantGuard.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { authRouter } from "./auth.routes.js";
import { propertyRouter } from "./property.routes.js";
import { unitRouter } from "./unit.routes.js";
import { tenantRouter } from "./tenant.routes.js";
import { contractRouter } from "./contract.routes.js";
import { maintenanceRouter } from "./maintenance.routes.js";
import { documentRouter, tenantDocumentRouter } from "./document.routes.js";
import { financeRouter } from "./finance.routes.js";
import receiptRouter from "./receipt.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { companyRouter } from "./company.routes.js";

import { bankRouter } from "./bank.routes.js";
import { userRouter } from "./user.routes.js";
import { calendarRouter, publicCalendarRouter } from "./calendar.routes.js";
import { emailAccountRouter } from "./email-account.routes.js";
import { emailMessageRouter } from "./email-message.routes.js";
import { meterRouter } from "./meter.routes.js";
import { recurringTransactionRouter } from "./recurring-transaction.routes.js";
import { dunningRouter } from "./dunning.routes.js";
import { handoverRouter } from "./handover.routes.js";
import { maintenanceScheduleRouter } from "./maintenance-schedule.routes.js";
import { documentTemplateRouter } from "./document-template.routes.js";
import { bankingRouter, bankingCallbackHandler } from "./banking.routes.js";
import { datevRouter } from "./datev.routes.js";
import { reportRouter } from "./report.routes.js";
import { importRouter } from "./import.routes.js";
import { superadminRouter } from "./superadmin.routes.js";
import { administrationRouter } from "./administration.routes.js";
import { insuranceRouter } from "./insurance.routes.js";
import { budgetRouter } from "./budget.routes.js";
import { auditLogRouter } from "./auditlog.routes.js";
import { billingRouter } from "./billing.routes.js";
import { energyRouter } from "./energy.routes.js";
import { subscriptionGuard } from "../middleware/subscriptionGuard.js";

const router = Router();

// Allgemeines Rate-Limiting auf alle Write-Requests
router.use(apiLimiter);

// Public routes
router.use("/auth", authRouter);
router.use("/superadmin", superadminRouter);
// Public iCal feed — no auth (token acts as auth)
router.use("/calendar/ical-feed", publicCalendarRouter);

// Billing routes — no subscriptionGuard (accessible even when subscription is locked)
router.use("/billing", requireAuth, tenantGuard, billingRouter);

// Protected routes (require auth + company isolation)
router.use("/properties", requireAuth, tenantGuard, subscriptionGuard, propertyRouter);
router.use("/units", requireAuth, tenantGuard, subscriptionGuard, unitRouter);
router.use("/tenants", requireAuth, tenantGuard, subscriptionGuard, tenantRouter);
router.use("/tenants/:tenantId/documents", requireAuth, tenantGuard, subscriptionGuard, tenantDocumentRouter);
router.use("/contracts", requireAuth, tenantGuard, subscriptionGuard, contractRouter);
router.use("/maintenance", requireAuth, tenantGuard, subscriptionGuard, maintenanceRouter);
router.use("/documents", requireAuth, tenantGuard, subscriptionGuard, documentRouter);
router.use("/finance", requireAuth, tenantGuard, subscriptionGuard, financeRouter);
router.use("/finance", requireAuth, tenantGuard, subscriptionGuard, receiptRouter);
router.use("/dashboard", requireAuth, tenantGuard, subscriptionGuard, dashboardRouter);
router.use("/company", requireAuth, tenantGuard, subscriptionGuard, companyRouter);
router.use("/bank-accounts", requireAuth, tenantGuard, subscriptionGuard, bankRouter);
router.use("/users", requireAuth, tenantGuard, subscriptionGuard, userRouter);
router.use("/calendar", requireAuth, tenantGuard, subscriptionGuard, calendarRouter);
router.use("/email-accounts", requireAuth, tenantGuard, subscriptionGuard, emailAccountRouter);
router.use("/email-messages", requireAuth, tenantGuard, subscriptionGuard, emailMessageRouter);
router.use("/meters", requireAuth, tenantGuard, subscriptionGuard, meterRouter);
router.use("/recurring-transactions", requireAuth, tenantGuard, subscriptionGuard, recurringTransactionRouter);
router.use("/dunning", requireAuth, tenantGuard, subscriptionGuard, dunningRouter);
router.use("/handover-protocols", requireAuth, tenantGuard, subscriptionGuard, handoverRouter);
router.use("/maintenance-schedules", requireAuth, tenantGuard, subscriptionGuard, maintenanceScheduleRouter);
router.use("/document-templates", requireAuth, tenantGuard, subscriptionGuard, documentTemplateRouter);

// Public: Nordigen OAuth callback (no auth — browser is redirected here by Nordigen)
router.get("/banking/callback", bankingCallbackHandler);

// Protected banking and DATEV routes
router.use("/banking", requireAuth, tenantGuard, subscriptionGuard, bankingRouter);
router.use("/finance/datev", requireAuth, tenantGuard, subscriptionGuard, datevRouter);
router.use("/reports", requireAuth, tenantGuard, subscriptionGuard, reportRouter);
router.use("/import", requireAuth, tenantGuard, subscriptionGuard, importRouter);
router.use("/administration", requireAuth, tenantGuard, subscriptionGuard, administrationRouter);
router.use("/insurance", requireAuth, tenantGuard, subscriptionGuard, insuranceRouter);
router.use("/maintenance-budgets", requireAuth, tenantGuard, subscriptionGuard, budgetRouter);
router.use("/audit-logs", requireAuth, tenantGuard, subscriptionGuard, auditLogRouter);
router.use("/energy", requireAuth, tenantGuard, subscriptionGuard, energyRouter);

export { router as apiRouter };
