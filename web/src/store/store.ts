import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { PhoneSettings, PhoneLocation, PhoneContacts, Notification } from '../../../types/types';

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
    notificationPush: boolean;
    inCall: boolean;
    calling: boolean;
    showNotiy: boolean;
    notifiCationHistory: Notification[];
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
    setNotificationPush: (notificationPush: boolean) => void;
    setInCall: (inCall: boolean) => void;
    setCalling: (calling: boolean) => void;
    setShowNotiy: (showNotiy: boolean) => void;
    setNotifiCationHistory: (notifiCationHistory: Notification[]) => void;
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
                current: '',
                wallpapers: [],
            },
            lockscreen: {
                current: '',
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
            isFlightMode: false,
        },
        location: {
            app: '',
            page: {
                phone: 'recent',
                messages: '',
                settings: '',
                services: '',
                mail: '',
                wallet: '',
                calulator: '',
                appstore: '',
                camera: '',
                gallery: '',
                pigeon: '',
                darkchat: '',
                garages: '',
                notes: '',
                houses: '',
                bluepages: '',
                pixie: '',
                groups: '',
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
        notificationPush: false,
        inCall: false,
        calling: false,
        showNotiy: false,
        notifiCationHistory: [],
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
        setNotificationPush: (notificationPush: boolean) => set((state) => {
            state.notificationPush = notificationPush;
        }),
        setInCall: (inCall: boolean) => set((state) => {
            state.inCall = inCall;
        }),
        setCalling: (calling: boolean) => set((state) => {
            state.calling = calling;
        }),
        setShowNotiy: (showNotiy: boolean) => set((state) => {
            state.showNotiy = showNotiy;
        }),
        setNotifiCationHistory: (notifiCationHistory: Notification[]) => set((state) => {
            state.notifiCationHistory = notifiCationHistory
        }),
    }))
);
