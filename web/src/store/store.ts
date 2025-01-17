import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type State = {
    visible: boolean;
    primaryColor: string;
    dynamicNoti: {
        show: boolean;
        type: string;
        timeout?: number;
    };
    showwelcomeScreen: boolean;
    relayoutMode: boolean;
    time: {
        h: number;
        m: number;
        s: number;
    };
    isLock : boolean;
};

type Actions = {
    setVisible: (visible: boolean) => void;
    setPrimaryColor: (primary: string) => void;
    setDynamicNoti: (dynamic: {
        show: boolean;
        type: string;
        timeout?: number;
    }) => void;
    setShowWelcomeScreen: (showwelcomeScreen: boolean) => void;
    setRelayoutMode: (relayoutMode: boolean) => void;
    setTime: (time: {
        h: number;
        m: number;
        s: number;
    }) => void;
    setIsLock: (isLock: boolean) => void;
};

export const usePhone = create<State & Actions>()(
    immer((set) => ({
        visible: false,
        primaryColor: 'blue',
        dynamicNoti: {
            show: false,
            type: '',
            timeout: 1000,
        },
        showwelcomeScreen: false,
        relayoutMode: false,
        time: {
            h: 12,
            m: 0,
            s: 0,
        },
        isLock: false,
        setVisible: (visible: boolean) => set((state) => {
            state.visible = visible;
        }),
        setPrimaryColor: (primary: string) => set((state) => {
            state.primaryColor = primary;
        }),
        setDynamicNoti: (dynamic: {
            show: boolean;
            type: string;
            timeout?: number;
        }) => set((state) => {
            state.dynamicNoti = dynamic;
        }),
        setShowWelcomeScreen: (showwelcomeScreen: boolean) => set((state) => {
            state.showwelcomeScreen = showwelcomeScreen;
        }),
        setRelayoutMode: (relayoutMode: boolean) => set((state) => {
            state.relayoutMode = relayoutMode;
        }),
        setTime: (time: {
            h: number;
            m: number;
            s: number;
        }) => set((state) => {
            state.time = time;
        }),
        setIsLock: (isLock: boolean) => set((state) => {
            state.isLock = isLock;
        }),
    }))
);
