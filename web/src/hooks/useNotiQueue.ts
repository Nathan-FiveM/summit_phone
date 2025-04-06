import { useState } from "react";
import { Notification } from "../../../types/types";
import { usePhone } from "../store/store";
import { get } from "http";
import { icons } from "../utils/icons";
import { useLocalStorage } from "@mantine/hooks";



export default function useNotiQueue() {
    const [state, set] = useState<Notification[]>([]);
    const [notifiCationHistory, setNotifiCationHistory] = useState<Notification[]>([]);

    return {
        add(value: {
            id: number;
            title: string;
            description: string;
            app: string;
            nodeRef?: any;
        }) {
            set((queue) => [...queue, value]);
        },
        addhistory(value: {
            id: number;
            title: string;
            description: string;
            app: string;
            nodeRef?: any;
        }) {
            setNotifiCationHistory((queue) => [...queue, value]);
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