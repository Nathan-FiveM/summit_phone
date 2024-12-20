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
};

export const usePhone = create<State & Actions>()(
    immer((set) => ({
        visible: false,
        primaryColor: 'blue',
        dynamicNoti: {
            show: false,
            type: '',
            timeout : 1000,
        },
        showwelcomeScreen: false,
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
    }))
);
