import { useState } from "react";

interface Notification {
    id: number;
    title: string;
    description: string;
    app: string;
    nodeRef?: any;
}

export default function useNotiQueue() {
    const [state, set] = useState<Notification[]>([]);
    const [notiFicationhistory, setNotificationHistory] = useState<Notification[]>([]);

    return {
        add(value: {
            id: number;
            title: string;
            description: string;
            app: string;
            nodeRef?: any;
        }) {
            set((queue) => [...queue, value]);
            setNotificationHistory((queue) => [...queue, value]);
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
            setNotificationHistory([]);
        },
        get historyValues(){
            return notiFicationhistory;
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