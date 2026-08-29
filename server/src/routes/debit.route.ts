import { Router } from "express";
import {
    createPerson,
    getPersons,
    updatePerson,
    deletePerson,
    createDebit,
    getDebits,
    updateDebit,
    deleteDebit,
    getDebitStats,
} from "../controllers/debit.controller.js";
import { requirePermission } from '../middlewares/require-permission.js';

export const debitRoute = Router();

// Persons
debitRoute.post("/persons", requirePermission('debit.create'), createPerson);
debitRoute.get("/persons", requirePermission('debit.read'), getPersons);
debitRoute.put("/persons/:id", requirePermission('debit.update'), updatePerson);
debitRoute.delete("/persons/:id", requirePermission('debit.delete'), deletePerson);

// Debits
debitRoute.post("/debits", requirePermission('debit.create'), createDebit);
debitRoute.get("/debits", requirePermission('debit.read'), getDebits);
debitRoute.put("/debits/:id", requirePermission('debit.update'), updateDebit);
debitRoute.delete("/debits/:id", requirePermission('debit.delete'), deleteDebit);

// Stats
debitRoute.get("/stats", requirePermission('debit.read'), getDebitStats);
