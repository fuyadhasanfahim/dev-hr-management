"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useDispatch } from "react-redux";
import { useSession } from "@/lib/auth-client";
import { useGetPendingPoliciesQuery } from "@/redux/features/policy/policyApi";
import { taskApi } from "@/redux/features/task/taskApi";
import { notificationApi } from "@/redux/features/notification/notificationApi";
import { IPolicy } from "@/types/policy.type";
import { toast } from "sonner";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: session } = useSession();
    const dispatch = useDispatch();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    
    // We'll use this to trigger a refetch of pending policies when a new one is prompted
    const { refetch: refetchPending } = useGetPendingPoliciesQuery(undefined, {
        skip: !session?.user?.id,
    });

    useEffect(() => {
        if (session?.user?.id) {
            const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000", {
                withCredentials: true,
            });

            socketInstance.on("connect", () => {
                setIsConnected(true);
                console.log("Socket connected:", socketInstance.id);
                socketInstance.emit("authenticate", session.user.id);
            });

            socketInstance.on("disconnect", () => {
                setIsConnected(false);
                console.log("Socket disconnected");
            });

            socketInstance.on("policy:prompt", (policy: IPolicy) => {
                console.log("New policy prompt received:", policy.title);
                toast.info(`New Policy: ${policy.title}`, {
                    description: "A new policy requires your attention.",
                });
                refetchPending();
            });

            // Real-time task events listener (live updates across all clients)
            socketInstance.on("task:update", (data: { action: string; task?: any; taskId?: string }) => {
                console.log("Real-time task update event via socket:", data);
                // Invalidate Task & Order tags to trigger live RTK Query refetch for all open components
                dispatch(taskApi.util.invalidateTags(["Task", "Order"]));
            });

            // Real-time notification events listener (live notifications for logged-in user)
            socketInstance.on("notification:new", (notification: any) => {
                console.log("Real-time notification received via socket:", notification);
                // Invalidate Notification tags to instantly update unread badge count & bell dropdown
                dispatch(notificationApi.util.invalidateTags(["Notification"]));

                if (notification.title) {
                    toast(notification.title, {
                        description: notification.message,
                    });
                }
            });

            setSocket(socketInstance);

            return () => {
                socketInstance.disconnect();
            };
        }
    }, [session?.user?.id, refetchPending, dispatch]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
