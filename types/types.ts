type PhoneSettings = {
    id: string;
    background: {
        current: string;
        wallpapers: string[];
    };
    ringtone: {
        current: string;
        ringtones: string[];
    };
    showStartupScreen: boolean;
    showNotifications: boolean;
    isLock: boolean;
    lockPin: string;
    usePin: boolean;
    useFaceId: boolean;
    faceIdIdentifier: string;
    smrtId: string;
    smrtPassword: string;
}

type PhoneMail = {
    activeMaidId: string;
    activeMailPassword: string;
    messages: {
        from: string;
        to: string;
        subject: string;
        images: string[];
        message: string;
        date: string;
        read: boolean;
        tags: string[];
    }[];
}

export type { PhoneSettings, PhoneMail };