/**
 * One-time data fix — normalise `staff.department` / `staff.designation` so the
 * RBAC permission resolver (`lib/permissions.ts`) can always match a staff
 * member to their Department / Designation grant.
 *
 * Canonical forms (what the invite flow + the resolver expect):
 *   - designation  -> the Designation row's `code`  (lower_snake_case)
 *   - department   -> the Department  row's `name`  (human label)
 *
 * A value that already equals its canonical form is left untouched. A value
 * that matches a row case-insensitively by `name` OR `code` is rewritten to
 * the canonical form. A value that matches no row is reported and left as-is
 * (nothing safe to do automatically — create/rename the scope, then re-run).
 *
 *   npx tsx src/scripts/normalize-staff-scope.ts            # dry run (default)
 *   npx tsx src/scripts/normalize-staff-scope.ts --commit   # write changes
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import StaffModel from '../models/staff.model.js';
import DepartmentModel from '../models/department.model.js';
import DesignationModel from '../models/designation.model.js';

const COMMIT = process.argv.includes('--commit');

interface ScopeRow {
    name: string;
    code?: string;
}

/** map of lower-cased name/code -> canonical value */
function buildLookup(rows: ScopeRow[], canonical: 'name' | 'code') {
    const map = new Map<string, string>();
    for (const row of rows) {
        const target = canonical === 'name' ? row.name : row.code;
        if (!target) continue;
        if (row.name) map.set(row.name.trim().toLowerCase(), target);
        if (row.code) map.set(row.code.trim().toLowerCase(), target);
    }
    return map;
}

const run = async () => {
    console.log(`\nnormalize-staff-scope — ${COMMIT ? 'COMMIT' : 'DRY RUN'}\n`);
    await mongoose.connect(envConfig.mongo_uri as string);
    console.log('Connected.\n');

    const [deptRows, desigRows] = await Promise.all([
        DepartmentModel.find().select('name code').lean<ScopeRow[]>(),
        DesignationModel.find().select('name code').lean<ScopeRow[]>(),
    ]);

    const deptLookup = buildLookup(deptRows, 'name');
    const desigLookup = buildLookup(desigRows, 'code');
    const desigCanonical = new Set(
        desigRows.map((r) => r.code).filter(Boolean) as string[],
    );
    const deptCanonical = new Set(deptRows.map((r) => r.name));

    console.log(
        `Loaded ${deptRows.length} departments, ${desigRows.length} designations.\n`,
    );

    const staff = await StaffModel.find()
        .select('staffId department designation')
        .lean<
            {
                _id: mongoose.Types.ObjectId;
                staffId: string;
                department?: string;
                designation?: string;
            }[]
        >();

    let changed = 0;
    let alreadyOk = 0;
    const unmatched: string[] = [];
    const ops: mongoose.AnyBulkWriteOperation[] = [];

    for (const s of staff) {
        const set: Record<string, string> = {};

        // ── designation ─────────────────────────────────────────────
        const desig = s.designation?.trim();
        if (desig) {
            if (desigCanonical.has(desig)) {
                // exact canonical code already
            } else {
                const hit = desigLookup.get(desig.toLowerCase());
                if (hit && hit !== s.designation) {
                    set.designation = hit;
                } else if (!hit) {
                    unmatched.push(
                        `  ${s.staffId.padEnd(14)} designation="${s.designation}" (no matching Designation row)`,
                    );
                }
            }
        }

        // ── department (optional) ───────────────────────────────────
        const dept = s.department?.trim();
        if (dept) {
            if (deptCanonical.has(dept)) {
                // exact canonical name already
            } else {
                const hit = deptLookup.get(dept.toLowerCase());
                if (hit && hit !== s.department) {
                    set.department = hit;
                } else if (!hit) {
                    unmatched.push(
                        `  ${s.staffId.padEnd(14)} department="${s.department}" (no matching Department row)`,
                    );
                }
            }
        }

        if (Object.keys(set).length > 0) {
            changed++;
            console.log(
                `  ${s.staffId.padEnd(14)} ` +
                    Object.entries(set)
                        .map(
                            ([k, v]) =>
                                `${k}: "${k === 'designation' ? s.designation : s.department}" -> "${v}"`,
                        )
                        .join(', '),
            );
            ops.push({
                updateOne: { filter: { _id: s._id }, update: { $set: set } },
            });
        } else {
            alreadyOk++;
        }
    }

    console.log(
        `\n${staff.length} staff scanned — ${changed} to change, ${alreadyOk} already canonical.`,
    );

    if (unmatched.length) {
        console.log(
            `\n${unmatched.length} value(s) matched NO scope row (left untouched):`,
        );
        console.log([...new Set(unmatched)].join('\n'));
    }

    if (!COMMIT) {
        console.log('\nDry run — nothing written. Re-run with --commit to apply.');
    } else if (ops.length) {
        const res = await StaffModel.bulkWrite(ops);
        console.log(`\nApplied. ${res.modifiedCount} staff updated.`);
        console.log(
            'Resolver grant caches expire within ~5 min; restart the API for an instant effect.',
        );
    } else {
        console.log('\nNothing to write.');
    }

    await mongoose.disconnect();
    process.exit(0);
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
