import { rem } from "@mantine/core";
import { useState } from "react";

interface Notification1 {
    id: string;
    title: string;
    description: string;
    app: string;
    icons: {
        "0": {
            icon: string;
            isServer: boolean;
            event: string;
        }
    }
    nodeRef?: any;
}
interface Notification2 {
    id: string;
    title: string;
    description: string;
    app: string;
    icons: {
        "0": {
            icon: string;
            isServer: boolean;
            event: string;
        },
        "1": {
            icon: string;
            isServer: boolean;
            event: string;
        }
    }
    nodeRef?: any;
}

export default function useActionNotiQueue() {
    const [state, set] = useState<Notification1[]>([]);
    const [twoButtonNoti, setTwoButtonNoti] = useState<Notification2[]>([]);

    return {
        add(value: {
            id: string;
            title: string;
            description: string;
            app: string;
            icons: {
                "0": {
                    icon: string;
                    isServer: boolean;
                    event: string;
                }
            }
            nodeRef?: any;
        }) {
            set((queue) => [...queue, value]);
        },
        addTwo(value: {
            id: string;
            title: string;
            description: string;
            app: string;
            icons: {
                "0": {
                    icon: string;
                    isServer: boolean;
                    event: string;
                },
                "1": {
                    icon: string;
                    isServer: boolean;
                    event: string;
                }
            }
            nodeRef?: any;
        }) {
            setTwoButtonNoti((queue) => [...queue, value]);
        },

        remove() {
            let result: Notification1;
            set(([first, ...rest]) => {
                result = first;
                return rest;
            });
            return result;
        },
        removeTwo() {
            let result: Notification2;
            setTwoButtonNoti(([first, ...rest]) => {
                result = first;
                return rest;
            });
            return result;
        },
        removeAll() {
            set([]);
            setTwoButtonNoti([]);
        },

        editFromNotificationId(id: string, value: Notification1) {
            set((queue) => {
                return queue.map((item: Notification1) => {
                    if (item.id) {
                        if (item.id === id) {
                            return value;
                        }
                    }
                    return item;
                });
            });
        },
        editFromTwoNotificationId(id: string, value: Notification2) {
            setTwoButtonNoti((queue) => {
                return queue.map((item: Notification2) => {
                    if (item.id) {
                        if (item.id === id) {
                            return value;
                        }
                    }
                    return item;
                });
            });
        },

        removeFromNotificationId(id: string) {
            set((queue) => {
                return queue.filter((item: Notification1) => {
                    if (item.id) {
                        return item.id !== id;
                    }
                    return true;
                });
            });
            setTwoButtonNoti((queue) => {
                return queue.filter((item: Notification2) => {
                    if (item.id) {
                        return item.id !== id;
                    }
                    return true;
                });
            });
        },

        get values() {
            return state;
        },
        get twoButtonValues() {
            return twoButtonNoti;
        },
        get first() {
            return state[0];
        },
        get twoButtonFirst() {
            return twoButtonNoti[0];
        },
        get last() {
            return state[state.length - 1];
        },
        get twoButtonLast() {
            return twoButtonNoti[twoButtonNoti.length - 1];
        },
        get size() {
            return state.length;
        },
        get twoButtonSize() {
            return twoButtonNoti.length;
        },
    }
}