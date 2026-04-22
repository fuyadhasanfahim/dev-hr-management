import ServiceModel, { IService } from '../models/service.model.js';

async function createServiceInDB(payload: Partial<IService>) {
    const result = await ServiceModel.create(payload);
    return result;
}

async function getAllServicesFromDB(query: any) {
    const { search, category, isActive } = query;
    const filter: any = {};

    if (search) {
        filter.name = { $regex: search, $options: 'i' };
    }

    if (category) {
        filter.category = category;
    }

    if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
    }

    const services = await ServiceModel.find(filter).sort({ name: 1 });
    return services;
}

async function getServiceByIdFromDB(id: string) {
    const result = await ServiceModel.findById(id);
    return result;
}

async function updateServiceInDB(id: string, payload: Partial<IService>) {
    const result = await ServiceModel.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return result;
}

async function deleteServiceFromDB(id: string) {
    const result = await ServiceModel.findByIdAndDelete(id);
    return result;
}

export default {
    createServiceInDB,
    getAllServicesFromDB,
    getServiceByIdFromDB,
    updateServiceInDB,
    deleteServiceFromDB,
};
