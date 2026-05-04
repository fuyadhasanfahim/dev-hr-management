import { Router } from "express";
import { staffRoute } from "./staff.route.js";
import { userRoute } from "./user.route.js";
import { shiftRoute } from "./shift.route.js";
import { branchRoute } from "./branch.route.js";
import { attendanceRoute } from "./attendance.route.js";
import { ShiftAssignmentRoute } from "./shift-assignment.route.js";
import OvertimeRoutes from "./overtime.route.js";
import { dashboardRoute } from "./dashboard.route.js";
import { invitationRoute } from "./invitation.route.js";
import { analyticsRoute } from "./analytics.route.js";
import { notificationRoute } from "./notification.route.js";
import { expenseRoute } from "./expense.route.js";
import { clientRoute } from "./client.route.js";
import { OrderRoutes } from "./order.route.js";
import { ServiceRoutes } from "./service.route.js";
import { ProjectRoutes } from "./project.route.js";
import { profitShareRoute } from "./profit-share.route.js";
import { debitRoute } from "./debit.route.js";
import { BillingRoutes } from "./billing.route.js";
import { leaveRoute } from "./leave.route.js";
import { noticeRoute } from "./notice.route.js";
import externalBusinessRoute from "./external-business.routes.js";
import { careerRoute } from "./career.route.js";
import { currencyRateRoute } from "./currency-rate.route.js";
import { payrollRoute } from "./payroll.routes.js";
import shiftOffDateRoute from "./shift-off-date.route.js";
import payrollBankSettingsRoute from "./payroll-bank-settings.route.js";
import { PaymentRoutes } from "./payment.route.js";
import { policyRoute } from "./policy.route.js";
import { quotationRoute } from "./quotation.route.js";
import { quotationTemplateRoute } from "./quotation-template.route.js";
import { quotationPaymentRoute } from "./quotation-payment.route.js";
import { meetingRoute } from "./meeting.route.js";



const router: Router = Router();

const moduleRoutes = [
    {
        path: "/users",
        route: userRoute,
    },
    {
        path: "/staffs",
        route: staffRoute,
    },
    {
        path: "/branches",
        route: branchRoute,
    },
    {
        path: "/shifts",
        route: shiftRoute,
    },
    {
        path: "/shift-off-dates",
        route: shiftOffDateRoute,
    },
    {
        path: "/payroll-bank-settings",
        route: payrollBankSettingsRoute,
    },
    {
        path: "/shift-assignments",
        route: ShiftAssignmentRoute,
    },
    {
        path: "/attendance",
        route: attendanceRoute,
    },
    {
        path: "/overtime",
        route: OvertimeRoutes,
    },
    {
        path: "/dashboard",
        route: dashboardRoute,
    },
    {
        path: "/invitations",
        route: invitationRoute,
    },
    {
        path: "/analytics",
        route: analyticsRoute,
    },
    {
        path: "/notifications",
        route: notificationRoute,
    },
    {
        path: "/expenses",
        route: expenseRoute,
    },
    {
        path: "/clients",
        route: clientRoute,
    },
    {
        path: "/orders",
        route: OrderRoutes,
    },
    {
        path: "/services",
        route: ServiceRoutes,
    },
    {
        path: "/projects",
        route: ProjectRoutes,
    },
    {
        path: "/profit-share",
        route: profitShareRoute,
    },
    {
        path: "/debits",
        route: debitRoute,
    },
    {
        path: "/invoices",
        route: BillingRoutes,
    },
    {
        path: "/leave",
        route: leaveRoute,
    },
    {
        path: "/notices",
        route: noticeRoute,
    },
    {
        path: "/external-business",
        route: externalBusinessRoute,
    },
    {
        path: "/careers",
        route: careerRoute,
    },
    {
        path: "/currency-rates",
        route: currencyRateRoute,
    },
    {
        path: "/payroll",
        route: payrollRoute,
    },
    {
        path: "/payments",
        route: PaymentRoutes,
    },
    {
        path: "/policies",
        route: policyRoute,
    },
    {
        path: "/quotations",
        route: quotationRoute,
    },
    {
        path: "/quotation-templates",
        route: quotationTemplateRoute,
    },
    {
        path: "/quotation-payments",
        route: quotationPaymentRoute,
    },
    {
        path: "/meetings",
        route: meetingRoute,
    },
];



moduleRoutes.forEach(({ path, route }) => {
    router.use(path, route);
});

export default router;

