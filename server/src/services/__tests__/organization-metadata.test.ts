import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Department, DEPARTMENT_LABELS } from '../../constants/department.js';
import { Designation, DESIGNATION_LABELS } from '../../constants/designation.js';

describe('Organization Metadata & Constants Integrity', () => {
    test('Department enum contains standard business departments', () => {
        assert.ok(Object.values(Department).includes(Department.HR));
        assert.ok(Object.values(Department).includes(Department.PRODUCTION));
        assert.ok(Object.values(Department).includes(Department.MARKETING));
        assert.ok(Object.values(Department).includes(Department.SALES));
    });

    test('DEPARTMENT_LABELS map matches all enum keys', () => {
        for (const dept of Object.values(Department)) {
            assert.ok(DEPARTMENT_LABELS[dept], `Missing label for department: ${dept}`);
            assert.equal(typeof DEPARTMENT_LABELS[dept], 'string');
        }
    });

    test('Designation enum contains standard business roles', () => {
        assert.ok(Object.values(Designation).includes(Designation.SOFTWARE_ENGINEER));
        assert.ok(Object.values(Designation).includes(Designation.HR_EXECUTIVE));
        assert.ok(Object.values(Designation).includes(Designation.TEAM_LEADER));
    });

    test('DESIGNATION_LABELS map matches all enum keys', () => {
        for (const desig of Object.values(Designation)) {
            assert.ok(DESIGNATION_LABELS[desig], `Missing label for designation: ${desig}`);
            assert.equal(typeof DESIGNATION_LABELS[desig], 'string');
        }
    });

    test('Code generator helper formats codes correctly', () => {
        const formatCode = (input: string) => input.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
        assert.equal(formatCode('Human Resources'), 'HUMAN_RESOURCES');
        assert.equal(formatCode('it-support'), 'IT_SUPPORT');
        assert.equal(formatCode('dev '), 'DEV');
    });
});
