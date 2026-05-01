import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true },
        role: { type: String },
    },
    {
        collection: "user",
    }
);

if (!mongoose.models.User) {
    mongoose.model("User", userSchema);
}

const UserModel = mongoose.connection.collection("user");
export default UserModel;
