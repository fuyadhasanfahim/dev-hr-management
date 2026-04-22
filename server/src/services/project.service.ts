import ProjectModel, { IProject, MilestoneStatus } from '../models/project.model.js';
import mongoose from 'mongoose';

async function getAllProjectsFromDB(query: any) {
    const { status, clientId } = query;
    const filter: any = {};

    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;

    const projects = await ProjectModel.find(filter)
        .populate('orderId', 'title totalAmount')
        .populate('clientId', 'name')
        .sort({ createdAt: -1 });
    
    return projects;
}

async function getProjectByIdFromDB(id: string) {
    const project = await ProjectModel.findById(id)
        .populate('orderId')
        .populate('clientId');
    return project;
}

async function updateProjectProgress(id: string, progress: number, status?: string) {
    const update: any = { progress };
    if (status) update.status = status;

    const result = await ProjectModel.findByIdAndUpdate(id, { $set: update }, { new: true });
    return result;
}

async function addMilestoneToProject(projectId: string, milestone: any) {
    const result = await ProjectModel.findByIdAndUpdate(
        projectId,
        { $push: { milestones: milestone } },
        { new: true }
    );
    return result;
}

async function updateMilestoneStatus(projectId: string, milestoneId: string, status: MilestoneStatus) {
    const result = await ProjectModel.findOneAndUpdate(
        { _id: projectId, 'milestones._id': milestoneId },
        { $set: { 'milestones.$.status': status } },
        { new: true }
    );
    return result;
}

export default {
    getAllProjectsFromDB,
    getProjectByIdFromDB,
    updateProjectProgress,
    addMilestoneToProject,
    updateMilestoneStatus,
};
