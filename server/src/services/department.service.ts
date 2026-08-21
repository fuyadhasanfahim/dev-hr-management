import DepartmentModel from '../models/department.model.js';
import StaffModel from '../models/staff.model.js';
import { DEPARTMENT_LABELS } from '../constants/department.js';
import type { IDepartment } from '../types/department.type.js';

const seedDefaultDepartmentsIfEmpty = async (userId?: string) => {
    const count = await DepartmentModel.countDocuments();
    if (count === 0 && userId) {
        const defaultDepts = Object.entries(DEPARTMENT_LABELS).map(([code, name]) => ({
            name,
            code: code.toUpperCase(),
            isActive: true,
            createdBy: userId,
        }));
        await DepartmentModel.insertMany(defaultDepts, { ordered: false }).catch(() => {});
    }
};

const getAllDepartments = async (query: { isActive?: boolean; search?: string } = {}, userId?: string) => {
    if (userId) {
        await seedDefaultDepartmentsIfEmpty(userId);
    }

    const filter: Record<string, any> = {};

    if (typeof query.isActive === 'boolean') {
        filter.isActive = query.isActive;
    }

    if (query.search && query.search.trim() !== '') {
        const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
            { name: searchRegex },
            { code: searchRegex },
            { description: searchRegex },
        ];
    }

    return await DepartmentModel.find(filter).sort({ name: 1 }).select('-__v');
};

const getDepartmentById = async (id: string) => {
    const department = await DepartmentModel.findById(id).select('-__v');
    if (!department) {
        throw new Error('Department not found');
    }
    return department;
};

const createDepartment = async (payload: Partial<IDepartment>, userId: string) => {
    const name = payload.name?.trim();
    const code = (payload.code || name?.substring(0, 4))?.toUpperCase().trim();

    if (!name) {
        throw new Error('Department name is required');
    }
    if (!code) {
        throw new Error('Department code is required');
    }

    const nameExist = await DepartmentModel.findOne({
        name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });

    if (nameExist) {
        throw new Error('Department name already exists');
    }

    const codeExist = await DepartmentModel.findOne({
        code: code,
    });

    if (codeExist) {
        throw new Error('Department code already exists');
    }

    const department = await DepartmentModel.create({
        name,
        code,
        description: payload.description?.trim(),
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        createdBy: userId,
    });

    return department;
};

const updateDepartment = async (id: string, payload: Partial<IDepartment>) => {
    const department = await DepartmentModel.findById(id);
    if (!department) {
        throw new Error('Department not found');
    }

    if (payload.name && payload.name.trim() !== department.name) {
        const nameExist = await DepartmentModel.findOne({
            _id: { $ne: id },
            name: { $regex: `^${payload.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
        if (nameExist) {
            throw new Error('Department name already exists');
        }
        department.name = payload.name.trim();
    }

    if (payload.code && payload.code.toUpperCase().trim() !== department.code) {
        const codeExist = await DepartmentModel.findOne({
            _id: { $ne: id },
            code: payload.code.toUpperCase().trim(),
        });
        if (codeExist) {
            throw new Error('Department code already exists');
        }
        department.code = payload.code.toUpperCase().trim();
    }

    if (payload.description !== undefined) {
        department.description = payload.description?.trim();
    }

    if (payload.isActive !== undefined) {
        department.isActive = payload.isActive;
    }

    await department.save();
    return department;
};

const toggleDepartmentStatus = async (id: string) => {
    const department = await DepartmentModel.findById(id);
    if (!department) {
        throw new Error('Department not found');
    }

    department.isActive = !department.isActive;
    await department.save();
    return department;
};

const deleteDepartment = async (id: string) => {
    const department = await DepartmentModel.findById(id);
    if (!department) {
        throw new Error('Department not found');
    }

    // Safeguard: Check if any staff members are currently assigned to this department
    const assignedStaffCount = await StaffModel.countDocuments({
        department: { $in: [department.name, department.code, department.name.toLowerCase()] },
    });

    if (assignedStaffCount > 0) {
        throw new Error(
            `Cannot delete department "${department.name}" because ${assignedStaffCount} staff member(s) are assigned to it. You can deactivate it instead.`
        );
    }

    await DepartmentModel.findByIdAndDelete(id);
    return { success: true, message: 'Department deleted successfully' };
};

const DepartmentServices = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    toggleDepartmentStatus,
    deleteDepartment,
    seedDefaultDepartmentsIfEmpty,
};

export default DepartmentServices;
