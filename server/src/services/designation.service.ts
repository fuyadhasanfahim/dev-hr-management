import DesignationModel from '../models/designation.model.js';
import StaffModel from '../models/staff.model.js';
import { DESIGNATION_LABELS } from '../constants/designation.js';
import type { IDesignation } from '../types/designation.type.js';

const seedDefaultDesignationsIfEmpty = async (userId?: string) => {
    const count = await DesignationModel.countDocuments();
    if (count === 0 && userId) {
        const defaultDesignations = Object.entries(DESIGNATION_LABELS).map(([code, name]) => ({
            name,
            code: code.toLowerCase(),
            isActive: true,
            createdBy: userId,
        }));
        await DesignationModel.insertMany(defaultDesignations, { ordered: false }).catch(() => {});
    }
};

const getAllDesignations = async (
    query: { isActive?: boolean; department?: string; search?: string } = {},
    userId?: string,
) => {
    if (userId) {
        await seedDefaultDesignationsIfEmpty(userId);
    }

    const filter: Record<string, any> = {};

    if (typeof query.isActive === 'boolean') {
        filter.isActive = query.isActive;
    }

    if (query.department && query.department.trim() !== '') {
        filter.department = query.department.trim();
    }

    if (query.search && query.search.trim() !== '') {
        const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
            { name: searchRegex },
            { code: searchRegex },
            { description: searchRegex },
        ];
    }

    return await DesignationModel.find(filter).sort({ name: 1 }).select('-__v');
};

const getDesignationById = async (id: string) => {
    const designation = await DesignationModel.findById(id).select('-__v');
    if (!designation) {
        throw new Error('Designation not found');
    }
    return designation;
};

const createDesignation = async (payload: Partial<IDesignation>, userId: string) => {
    const name = payload.name?.trim();
    // Keep designation codes normalised (lower_snake_case) so the permission
    // resolver's `staff.designation` -> grant lookup matches regardless of how
    // the value was entered. Seeded rows already follow this shape.
    const code = (payload.code || name)
        ?.trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

    if (!name) {
        throw new Error('Designation name is required');
    }
    if (!code) {
        throw new Error('Designation code is required');
    }

    const nameExist = await DesignationModel.findOne({
        name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });

    if (nameExist) {
        throw new Error('Designation name already exists');
    }

    const codeExist = await DesignationModel.findOne({
        code: code,
    });

    if (codeExist) {
        throw new Error('Designation code already exists');
    }

    const designation = await DesignationModel.create({
        name,
        code,
        department: payload.department?.trim(),
        description: payload.description?.trim(),
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        createdBy: userId,
    });

    return designation;
};

const updateDesignation = async (id: string, payload: Partial<IDesignation>) => {
    const designation = await DesignationModel.findById(id);
    if (!designation) {
        throw new Error('Designation not found');
    }

    if (payload.name && payload.name.trim() !== designation.name) {
        const nameExist = await DesignationModel.findOne({
            _id: { $ne: id },
            name: { $regex: `^${payload.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
        if (nameExist) {
            throw new Error('Designation name already exists');
        }
        designation.name = payload.name.trim();
    }

    if (payload.code) {
        const nextCode = payload.code
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
        if (nextCode !== designation.code) {
            const codeExist = await DesignationModel.findOne({
                _id: { $ne: id },
                code: nextCode,
            });
            if (codeExist) {
                throw new Error('Designation code already exists');
            }
            designation.code = nextCode;
        }
    }

    if (payload.department !== undefined) {
        designation.department = payload.department?.trim();
    }

    if (payload.description !== undefined) {
        designation.description = payload.description?.trim();
    }

    if (payload.isActive !== undefined) {
        designation.isActive = payload.isActive;
    }

    await designation.save();
    return designation;
};

const toggleDesignationStatus = async (id: string) => {
    const designation = await DesignationModel.findById(id);
    if (!designation) {
        throw new Error('Designation not found');
    }

    designation.isActive = !designation.isActive;
    await designation.save();
    return designation;
};

const deleteDesignation = async (id: string) => {
    const designation = await DesignationModel.findById(id);
    if (!designation) {
        throw new Error('Designation not found');
    }

    // Safeguard: Check if any staff members are currently assigned to this designation
    const assignedStaffCount = await StaffModel.countDocuments({
        designation: { $in: [designation.name, designation.code, designation.name.toLowerCase()] },
    });

    if (assignedStaffCount > 0) {
        throw new Error(
            `Cannot delete designation "${designation.name}" because ${assignedStaffCount} staff member(s) hold this designation. You can deactivate it instead.`
        );
    }

    await DesignationModel.findByIdAndDelete(id);
    return { success: true, message: 'Designation deleted successfully' };
};

const DesignationServices = {
    getAllDesignations,
    getDesignationById,
    createDesignation,
    updateDesignation,
    toggleDesignationStatus,
    deleteDesignation,
    seedDefaultDesignationsIfEmpty,
};

export default DesignationServices;
