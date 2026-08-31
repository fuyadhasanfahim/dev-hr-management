import StaffModel from "../models/staff.model.js";

/**
 * Telemarketer = staff whose designation is "Telemarketer" OR who sits in the
 * "Telemarketing" department. Used to scope client reads/writes to the
 * telemarketer's own (created / assigned) records.
 */
const TELEMARKETER_MATCH = {
    status: "active",
    $or: [
        { designation: { $regex: /^telemarketer$/i } },
        { department: { $regex: /^telemarketing$/i } },
    ],
};

/**
 * Returns the staff record if the user is a telemarketer, else null.
 */
export async function getTelemarketerStaff(userId: string) {
    return StaffModel.findOne({ userId, ...TELEMARKETER_MATCH }).lean();
}

/**
 * Boolean shorthand for {@link getTelemarketerStaff}.
 */
export async function isTelemarketer(userId: string): Promise<boolean> {
    const staff = await getTelemarketerStaff(userId);
    return !!staff;
}
