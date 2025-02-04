import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { PhoneSettings, PhoneLocation, PhoneContacts } from '../../../types/types';

type State = {
    visible: boolean;
    primaryColor: string;
    dynamicNoti: {
        show: boolean;
        type: string;
        timeout?: number;
        content?: any;
    };
    relayoutMode: boolean;
    time: {
        h: number;
        m: number;
        s: number;
    };
    phoneSettings: PhoneSettings;
    location: PhoneLocation;
    selectedContact: PhoneContacts;
};

type Actions = {
    setVisible: (visible: boolean) => void;
    setPrimaryColor: (primary: string) => void;
    setDynamicNoti: (dynamic: {
        show: boolean;
        type: string;
        timeout?: number;
        content?: any;
    }) => void;
    setRelayoutMode: (relayoutMode: boolean) => void;
    setTime: (time: {
        h: number;
        m: number;
        s: number;
    }) => void;
    setPhoneSettings: (phoneSettings: PhoneSettings) => void;
    setLocation: (location: PhoneLocation) => void;
    setSelectedContact: (contact: PhoneContacts) => void;
};

export const usePhone = create<State & Actions>()(
    immer((set) => ({
        visible: false,
        primaryColor: 'blue',
        dynamicNoti: {
            show: false,
            type: '',
            timeout: 1000,
            content: null,
        },
        relayoutMode: false,
        time: {
            h: 12,
            m: 0,
            s: 0,
        },
        phoneSettings: {
            _id: '',
            background: {
                current: '/images/lockscreenBG.png',
                wallpapers: [],
            },
            ringtone: {
                current: 'default',
                ringtones: [],
            },
            showStartupScreen: false,
            showNotifications: true,
            isLock: true,
            lockPin: '',
            usePin: false,
            useFaceId: false,
            faceIdIdentifier: '',
            smrtId: '',
            smrtPassword: '',
        },
        location: {
            app: '',
            page: {
                phone: 'recent',
            },
        },
        selectedContact: {
            _id: '',
            personalNumber: '',
            contactNumber: '',
            firstName: '',
            lastName: '',
            image: '',
            ownerId: '',
            notes: '',
            email: '',
            isFav: false,
        },
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
        setPhoneSettings: (phoneSettings: PhoneSettings) => set((state) => {
            state.phoneSettings = phoneSettings;
        }),
        setLocation: (location: PhoneLocation) => set((state) => {
            state.location = location;
        }),
        setSelectedContact: (contact: PhoneContacts) => set((state) => {
            state.selectedContact = contact;
        }),
    }))
);
