"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changeEmail, updateUser, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { useEffect } from "react";
import {
    useGetMeQuery,
    useCompleteProfileMutation,
    useUpdateProfileMutation,
} from "@/redux/features/staff/staffApi";
import { ProfileFormValues, profileSchema } from "@/validators/profile.schema";
import { BANGLADESH_BANKS } from "@/constants/banks";
import { DatePicker } from "../shared/DatePicker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { cn } from "@/lib/utils";

function Required() {
    return <span className="text-destructive">*</span>;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONS = [
    "Father",
    "Mother",
    "Brother",
    "Sister",
    "Spouse",
    "Friend",
    "Uncle",
    "Auntie",
    "Grandfather",
    "Grandmother",
    "Relative",
    "Other",
];

export default function EditProfile() {
    const { data: session, isPending } = useSession();
    const {
        data,
        isLoading: isStaffLoading,
    } = useGetMeQuery(
        {},
        {
            skip: !session?.user.id,
        },
    );
    const [completeProfile] = useCompleteProfileMutation();
    const [updateProfile] = useUpdateProfileMutation();

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            nationalId: "",
            bloodGroup: "",
            address: "",
            emergencyContact: {
                name: "",
                relation: "",
                phone: "",
            },
            fathersName: "",
            mothersName: "",
            spouseName: "",
            bank: {
                bankName: "",
                accountNumber: "",
                accountHolderName: "",
                branch: "",
                routingNumber: "",
            },
            dateOfBirth: undefined,
            joinDate: undefined,
        },
    });

    useEffect(() => {
        if (!data?.staff && !session?.user) return;

        const staff = data?.staff;
        form.reset({
            name: session?.user?.name || "",
            email: session?.user?.email || "",
            phone: staff?.phone || "",
            dateOfBirth: staff?.dateOfBirth ? new Date(staff.dateOfBirth) : undefined,
            bloodGroup: staff?.bloodGroup || "",
            nationalId: staff?.nationalId || "",
            address: staff?.address || "",
            emergencyContact: {
                name: staff?.emergencyContact?.name || "",
                relation: staff?.emergencyContact?.relation || "",
                phone: staff?.emergencyContact?.phone || "",
            },
            fathersName: staff?.fathersName || "",
            mothersName: staff?.mothersName || "",
            spouseName: staff?.spouseName || "",
            bank: {
                bankName: staff?.bank?.bankName || "",
                accountNumber: staff?.bank?.accountNumber || "",
                accountHolderName: staff?.bank?.accountHolderName || "",
                branch: staff?.bank?.branch || "",
                routingNumber: staff?.bank?.routingNumber || "",
            },
            joinDate: staff?.joinDate ? new Date(staff.joinDate) : undefined,
        });
    }, [session?.user, data?.staff, form]);

    const isLoading =
        form.formState.isSubmitting ||
        isPending ||
        (isStaffLoading && !data);

    const onSubmit = async (values: ProfileFormValues) => {
        const currentName = session?.user?.name;
        const currentEmail = session?.user?.email;

        const nameChanged = values.name !== currentName;
        const emailChanged = values.email !== currentEmail;

        try {
            if (nameChanged) {
                await updateUser({
                    name: values.name,
                });
            }

            if (emailChanged) {
                await changeEmail({
                    newEmail: values.email,
                    callbackURL: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/account?edit-profile=true`,
                });
            }

            const staffPayload = {
                phone: values.phone,
                dateOfBirth:
                    values.dateOfBirth instanceof Date
                        ? values.dateOfBirth.toISOString()
                        : new Date(values.dateOfBirth).toISOString(),
                nationalId: values.nationalId,
                bloodGroup: values.bloodGroup,
                address: values.address,

                emergencyContact: {
                    name: values.emergencyContact.name,
                    relation: values.emergencyContact.relation,
                    phone: values.emergencyContact.phone,
                },

                fathersName: values.fathersName,
                mothersName: values.mothersName,
                spouseName: values.spouseName || undefined,

                bank: {
                    bankName: values.bank?.bankName || "",
                    accountNumber: values.bank?.accountNumber || "",
                    accountHolderName: values.bank?.accountHolderName || "",
                    branch: values.bank?.branch,
                    routingNumber: values.bank?.routingNumber,
                },

                joinDate:
                    values.joinDate instanceof Date
                        ? values.joinDate.toISOString()
                        : new Date(values.joinDate).toISOString(),
            };

            // Use updateProfile if profile is completed, otherwise completeProfile
            // completeProfile will create a new staff record if needed
            const isProfileCompleted = data?.staff?.profileCompleted;

            try {
                if (isProfileCompleted) {
                    await updateProfile(staffPayload).unwrap();
                } else {
                    await completeProfile(staffPayload).unwrap();
                }
            } catch (apiError: unknown) {
                const errorMessage =
                    (apiError as { data?: { message?: string } })?.data
                        ?.message ||
                    (apiError as Error)?.message ||
                    "Failed to update profile";
                throw new Error(errorMessage);
            }

            if (nameChanged && emailChanged) {
                toast.success(
                    "Profile updated. Please verify your new email address.",
                );
            } else if (nameChanged) {
                toast.success("Your name has been updated successfully.");
            } else if (emailChanged) {
                toast.success(
                    "Email change requested. Please verify the link sent to your new email.",
                );
            } else {
                toast.success("Profile updated successfully.");
            }

            form.reset(values);
        } catch (error) {
            console.log(error);
            toast.error((error as Error)?.message || "Something went wrong!");
        }
    };

    return (
        <Card className="col-span-2">
            <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>
                    Update your profile information below.
                </CardDescription>
            </CardHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <CardContent>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Name <Required /></Label>
                                <Input {...form.register("name")} />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.name?.message}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label>Email <Required /></Label>
                                <Input {...form.register("email")} />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.email?.message}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Phone <Required /></Label>
                                <Input
                                    {...form.register("phone")}
                                    placeholder="Enter phone number"
                                />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.phone?.message}
                                </p>
                            </div>

                            <div>
                                <Controller
                                    control={form.control}
                                    name="dateOfBirth"
                                    render={({ field }) => (
                                        <DatePicker
                                            label={
                                                <>
                                                    Date of Birth <Required />
                                                </>
                                            }
                                            value={field.value ? (field.value instanceof Date ? field.value : new Date(field.value)) : undefined}
                                            onChange={field.onChange}
                                            placeholder="Pick date of birth"
                                            maxDate={new Date()}
                                        />
                                    )}
                                />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.dateOfBirth?.message}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 grid-cols-2">
                            <div className="grid gap-2">
                                <Label>National ID <Required /></Label>
                                <Input {...form.register("nationalId")} />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.nationalId?.message}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label>Blood Group <Required /></Label>
                                <Controller
                                    control={form.control}
                                    name="bloodGroup"
                                    render={({ field }) => {
                                        const bloodGroups = field.value && !BLOOD_GROUPS.includes(field.value)
                                            ? [field.value, ...BLOOD_GROUPS]
                                            : BLOOD_GROUPS;

                                        return (
                                            <Select
                                                value={field.value || undefined}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select blood group" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {bloodGroups.map((bg) => (
                                                        <SelectItem
                                                            key={bg}
                                                            value={bg}
                                                        >
                                                            {bg}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        );
                                    }}
                                />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.bloodGroup?.message}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Emergency Contact Person</Label>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-xs text-muted-foreground">
                                        Name <Required />
                                    </Label>
                                    <Input
                                        placeholder="Name"
                                        {...form.register(
                                            "emergencyContact.name",
                                        )}
                                    />
                                    <p className="text-sm text-destructive">
                                        {
                                            form.formState.errors
                                                .emergencyContact?.name
                                                ?.message
                                        }
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-xs text-muted-foreground">
                                        Relation <Required />
                                    </Label>
                                    <Controller
                                        control={form.control}
                                        name="emergencyContact.relation"
                                        render={({ field }) => {
                                            const relations = field.value && !RELATIONS.includes(field.value)
                                                ? [field.value, ...RELATIONS]
                                                : RELATIONS;

                                            return (
                                                <Select
                                                    value={field.value || undefined}
                                                    onValueChange={field.onChange}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Relation" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {relations.map((r) => (
                                                            <SelectItem
                                                                key={r}
                                                                value={r}
                                                            >
                                                                {r}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            );
                                        }}
                                    />
                                    <p className="text-sm text-destructive">
                                        {
                                            form.formState.errors
                                                .emergencyContact?.relation
                                                ?.message
                                        }
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-xs text-muted-foreground">
                                        Phone <Required />
                                    </Label>
                                    <Input
                                        placeholder="Phone"
                                        {...form.register(
                                            "emergencyContact.phone",
                                        )}
                                    />
                                    <p className="text-sm text-destructive">
                                        {
                                            form.formState.errors
                                                .emergencyContact?.phone
                                                ?.message
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>
                                    Father&apos;s Name <Required />
                                </Label>
                                <Input
                                    placeholder="Father's Name"
                                    {...form.register("fathersName")}
                                />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.fathersName?.message}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label>
                                    Mother&apos;s Name <Required />
                                </Label>
                                <Input
                                    placeholder="Mother's Name"
                                    {...form.register("mothersName")}
                                />
                                <p className="text-sm text-destructive">
                                    {form.formState.errors.mothersName?.message}
                                </p>
                            </div>
                        </div>

                        <Input
                            placeholder="Spouse Name (Optional)"
                            {...form.register("spouseName")}
                        />

                        {/* Bank Account Section */}
                        <div className="pt-4">
                            <Label className="text-base font-semibold">
                                Bank Account Information
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div className="grid gap-2">
                                    <Label>
                                        Bank Name <Required />
                                    </Label>
                                    <Controller
                                        control={form.control}
                                        name="bank.bankName"
                                        render={({ field }) => {
                                            const bankList = field.value && !BANGLADESH_BANKS.includes(field.value)
                                                ? [field.value, ...BANGLADESH_BANKS]
                                                : BANGLADESH_BANKS;

                                            return (
                                                <Select
                                                    value={field.value || undefined}
                                                    onValueChange={field.onChange}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select bank" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {bankList.map(
                                                            (b) => (
                                                                <SelectItem
                                                                    key={b}
                                                                    value={b}
                                                                >
                                                                    {b}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            );
                                        }}
                                    />
                                    <p className="text-sm text-destructive">
                                        {
                                            form.formState.errors.bank?.bankName
                                                ?.message
                                        }
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    <Label>
                                        Account Number <Required />
                                    </Label>
                                    <Input
                                        placeholder="Your account number"
                                        {...form.register("bank.accountNumber")}
                                    />
                                    <p className="text-sm text-destructive">
                                        {
                                            form.formState.errors.bank
                                                ?.accountNumber?.message
                                        }
                                    </p>
                                </div>

                                <div className="grid gap-2 md:col-span-2">
                                    <Label>
                                        Account Holder Name <Required />
                                    </Label>
                                    <Input
                                        placeholder="Name on account"
                                        {...form.register(
                                            "bank.accountHolderName",
                                        )}
                                    />
                                    <p className="text-sm text-destructive">
                                        {
                                            form.formState.errors.bank
                                                ?.accountHolderName?.message
                                        }
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Branch</Label>
                                    <Input
                                        placeholder="Branch Name"
                                        {...form.register("bank.branch")}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Routing Number</Label>
                                    <Input
                                        placeholder="Routing Number"
                                        {...form.register("bank.routingNumber")}
                                    />
                                </div>
                            </div>
                        </div>

                        <Controller
                            control={form.control}
                            name="joinDate"
                            render={({ field }) => (
                                <DatePicker
                                    label={
                                        <>
                                            Join Date <Required />
                                        </>
                                    }
                                    value={field.value ? (field.value instanceof Date ? field.value : new Date(field.value)) : undefined}
                                    onChange={field.onChange}
                                    placeholder="Pick join date"
                                />
                            )}
                        />
                        <p className="text-sm text-destructive">
                            {form.formState.errors.joinDate?.message}
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label>
                            Address <Required />
                        </Label>
                        <Input {...form.register("address")} />
                        <p className="text-sm text-destructive">
                            {form.formState.errors.address?.message}
                        </p>
                    </div>
                </CardContent>

                <CardFooter>
                    <Button className={cn("w-full")} disabled={isLoading}>
                        {isLoading ? (
                            <Loader className="animate-spin" />
                        ) : (
                            "Update Profile"
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
