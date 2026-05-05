import LeadSettingModel from '../models/lead-setting.model.js';
import type { ILeadSetting } from '../types/lead.type.js';

const getAllSettings = async (type?: string) => {
    const query = type ? { type } : {};
    return await LeadSettingModel.find(query).sort({ isDefault: -1, createdAt: 1 });
};

const createSetting = async (data: Partial<ILeadSetting>) => {
    // If this is set as default, unset others of the same type
    if (data.isDefault) {
        await LeadSettingModel.updateMany({ type: data.type }, { isDefault: false });
    }
    const setting = new LeadSettingModel(data);
    return await setting.save();
};

const updateSetting = async (id: string, data: Partial<ILeadSetting>) => {
    if (data.isDefault) {
        const setting = await LeadSettingModel.findById(id);
        if (setting) {
            await LeadSettingModel.updateMany({ type: setting.type }, { isDefault: false });
        }
    }
    return await LeadSettingModel.findByIdAndUpdate(id, data, { new: true });
};

const deleteSetting = async (id: string) => {
    return await LeadSettingModel.findByIdAndDelete(id);
};

export default {
    getAllSettings,
    createSetting,
    updateSetting,
    deleteSetting,
};
