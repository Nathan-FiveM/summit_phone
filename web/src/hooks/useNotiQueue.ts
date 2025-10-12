import { useState } from "react";
import { Notification } from "../../../types/types";
import { usePhone } from "../store/store";
import { get } from "http";
import { icons } from "../utils/icons";
import { useLocalStorage } from "@mantine/hooks";



export default function useNotiQueue() {
    const [state, set] = useState<Notification[]>([]);
    const [notifiCationHistory, setNotifiCationHistory] = useState<Notification[]>([]);
    const MAX_NOTIFICATIONS = 50; // Limit notification queue size
    const MAX_HISTORY = 100; // Limit notification history size

    return {
        add(value: {
            id: number;
            title: string;
            description: string;
            app: string;
            nodeRef?: any;
        }) {
            set((queue) => {
                const newQueue = [...queue, value];
                // Limit queue size to prevent memory leaks
                return newQueue.length > MAX_NOTIFICATIONS ? newQueue.slice(-MAX_NOTIFICATIONS) : newQueue;
            });
        },
        addhistory(value: {
            id: number;
            title: string;
            description: string;
            app: string;
            nodeRef?: any;
        }) {
            setNotifiCationHistory((queue) => {
                const newQueue = [...queue, value];
                // Limit history size to prevent memory leaks
                return newQueue.length > MAX_HISTORY ? newQueue.slice(-MAX_HISTORY) : newQueue;
            });
        },
        remove() {
            let result: Notification;
            set(([first, ...rest]) => {
                result = first;
                return rest;
            });
            return result;
        },
        removeAll() {
            set([]);
        },
        editFromNotificationId(id: number, value: Notification) {
            set((queue) => {
                return queue.map((item: Notification) => {
                    if (item.id) {
                        if (item.id === id) {
                            return value;
                        }
                    }
                    return item;
                });
            });
        },
        removeFromNotificationId(id: number) {
            set((queue) => {
                return queue.filter((item: any) => {
                    if (item.id) {
                        return item.id !== id;
                    }
                    return true;
                });
            });
        },
        clearhistory() {
            setNotifiCationHistory([]);
        },
        get history() {
            return notifiCationHistory;
        },
        get values() {
            return state;
        },
        get first() {
            return state[0];
        },
        get last() {
            return state[state.length - 1];
        },
        get size() {
            return state.length;
        },
    }
}