import BranchModel from '../models/branch.model.js';
import StaffModel from '../models/staff.model.js';
import type { IBranch } from '../types/branch.type.js';

const createBranch = async (payload: Partial<IBranch>, userId: string) => {
    const name = payload.name?.trim();
    const code = payload.code?.toUpperCase().trim();

    if (!name) {
        throw new Error('Branch name is required');
    }
    if (!code) {
        throw new Error('Branch code is required');
    }

    const nameExist = await BranchModel.findOne({
        name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });

    if (nameExist) {
        throw new Error('Branch name already exists');
    }

    const codeExist = await BranchModel.findOne({
        code,
    });

    if (codeExist) {
        throw new Error('Branch code already exists');
    }

    const branch = await BranchModel.create({
        ...payload,
        name,
        code,
        address: payload.address?.trim(),
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        createdBy: userId,
    });

    return branch;
};

const getAllBranches = async (query: { isActive?: boolean; search?: string } = {}) => {
    const filter: Record<string, any> = {};

    if (typeof query.isActive === 'boolean') {
        filter.isActive = query.isActive;
    }

    if (query.search && query.search.trim() !== '') {
        const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
            { name: searchRegex },
            { code: searchRegex },
            { address: searchRegex },
        ];
    }

    return await BranchModel.find(filter).sort({ createdAt: -1 }).select('-__v');
};

const getBranchById = async (id: string) => {
    const branch = await BranchModel.findById(id).select('-__v');
    if (!branch) {
        throw new Error('Branch not found');
    }
    return branch;
};

const updateBranch = async (id: string, payload: Partial<IBranch>) => {
    const branch = await BranchModel.findById(id);
    if (!branch) {
        throw new Error('Branch not found');
    }

    if (payload.name && payload.name.trim() !== branch.name) {
        const nameExist = await BranchModel.findOne({
            _id: { $ne: id },
            name: { $regex: `^${payload.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
        if (nameExist) {
            throw new Error('Branch name already exists');
        }
        branch.name = payload.name.trim();
    }

    if (payload.code && payload.code.toUpperCase().trim() !== branch.code) {
        const codeExist = await BranchModel.findOne({
            _id: { $ne: id },
            code: payload.code.toUpperCase().trim(),
        });
        if (codeExist) {
            throw new Error('Branch code already exists');
        }
        branch.code = payload.code.toUpperCase().trim();
    }

    if (payload.address !== undefined) {
        branch.address = payload.address?.trim();
    }

    if (payload.isActive !== undefined) {
        branch.isActive = payload.isActive;
    }

    await branch.save();
    return branch;
};

const toggleBranchStatus = async (id: string) => {
    const branch = await BranchModel.findById(id);
    if (!branch) {
        throw new Error('Branch not found');
    }

    branch.isActive = !branch.isActive;
    await branch.save();
    return branch;
};

const deleteBranch = async (id: string) => {
    const branch = await BranchModel.findById(id);
    if (!branch) {
        throw new Error('Branch not found');
    }

    // Safeguard: Check if any staff members are currently assigned to this branch
    const assignedStaffCount = await StaffModel.countDocuments({
        branchId: branch._id,
    });

    if (assignedStaffCount > 0) {
        throw new Error(
            `Cannot delete branch "${branch.name}" because ${assignedStaffCount} staff member(s) are assigned to it. You can deactivate it instead.`
        );
    }

    await BranchModel.findByIdAndDelete(id);
    return { success: true, message: 'Branch deleted successfully' };
};

const BranchServices = {
    createBranch,
    getAllBranches,
    getBranchById,
    updateBranch,
    toggleBranchStatus,
    deleteBranch,
};

export default BranchServices;
