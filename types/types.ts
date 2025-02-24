type PhoneSettings = {
    _id: string;
    background: {
        current: string;
        wallpapers: string[];
    };
    lockscreen: {
        current: string;
        wallpapers: string[];
    };
    ringtone: {
        current: string;
        ringtones: {
            name:string;
            url:string;
        }[];
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
    isFlightMode: boolean;
    phoneNumber: string;
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

type PhoneLocation = {
    app: string;
    page?: {
        phone?: string;
        messages?: string;
        settings?: string;
        services?: string;
        mail?: string;
        wallet?: string;
        calulator?: string;
        appstore?: string;
        camera?: string;
        gallery?: string;
        pigeon?: string;
        darkchat?: string;
        garages?: string;
        notes?: string;
        houses?: string;
        bluepages?: string;
        pixie?: string;
        groups?: string;
    };
}

type PhoneContacts = {
    _id: string;
    personalNumber: string;
    contactNumber: string;
    firstName: string;
    lastName: string;
    image: string;
    ownerId: string;
    notes: string;
    email: string;
    isFav: boolean;
}

type PhoneCallHistory = {
    callId: number;
    role: string;
    myPhoneNumber: string;
    otherPhoneNumber: string;
    status: string;
    callTime: string;
    callTimestamp: Date;
}

type PhonePlayerCard = {
    _id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
    notes: string;
    avatar: string;
}

type Notification = {
    id: number;
    title: string;
    description: string;
    app: string;
    nodeRef?: any;
}

export type { PhoneSettings, PhoneMail, PhoneLocation, PhoneContacts, PhoneCallHistory, Notification, PhonePlayerCard };