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
            name: string;
            url: string;
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
    darkMailIdAttached: string;
    pigeonIdAttached: string;
    phoneNumber: string;
}

type PhoneMail = {
    activeMaidId: string;
    activeMailPassword: string;
    avator: string;
    username: string;
    messages: {
        _id: string;
        from: string;
        to: string;
        subject: string;
        username: string;
        images: string[];
        message: string;
        avatar: string;
        date: string;
        read: boolean;
        tags: string[];
    }[];
}

type PhoneMailMessage = {
    _id: string;
    from: string;
    username: string;
    to: string;
    subject: string;
    images: string[];
    avatar: string;
    message: string;
    date: string;
    read: boolean;
    tags: string[];
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

type PhoneBusiness = {
    ownerCitizenId: string,
    businessName: string,
    businessDescription: string,
    businessType: string[],
    businessLogo: string,
    businessPhoneNumber: number,
    businessAddress: string,
    generateBusinessEmail: boolean,
    businessEmail: string,
    coords: {
        x: string,
        y: string,
        z: string
    },
    job: string,
    _id: string
}

type JobData = {
    _id: string;
    label: string;
    defaultDuty: boolean;
    offDutyPay: boolean;
    type: string;
    grades: JobGrades;
}

type JobGrades = {
    [key: string]: {
        name: string;
        payment: number;
        isBoss?: boolean;
        isBankAuth?: boolean;
    }
}

type DarkChatChannel = {
    _id: string;
    name: string;
    members: string[];
    creator: string;
    createdAt: string;
    messages: {
        from: string;
        message: string;
        date: string;
    }[];
}

type DarkChatProfile = {
    _id: string;
    email: string;
    password: string;
    avatar: string;
}

type ApartMentData = {
    property_id: number,
    owner_citizenid: string,
    street: string,
    description: string,
    has_access: string,
    apartment: string,
    door_data: string
}

type HouseData = {
    property_id: number,
    owner_citizenid: string,
    street: string,
    description: string,
    has_access: string,
    shell: string,
    door_data: string
}

type TweetProfileData = {
    _id: string,
    email: string,
    password: string,
    displayName: string,
    avatar: string,
    verified: boolean,
    notificationsEnabled: boolean,
    createdAt: string,
    bio: string,
    followers: string[],
    following: string[],
}

type TweetData = {
    _id: string,
    username: string,
    email: string,
    avatar: string,
    verified: boolean,
    content: string,
    attachments: string[],
    createdAt: string,
    likeCount: string[],
    retweetCount: string[],
    repliesCount: string[],
    isRetweet: boolean,
    originalTweetId: any,
    hashtags: [],
    parentTweetId: any,
}

type GarageData = {
    plate: string;
    garage: string;
    state: string;
    category: string;
    brand: string;
    name: string;
    turboInstalled: boolean;
    bodyHealth: number;
    tankHealth: number;
    fuelLevel: number;
    engineHealth: number;
    modSuspension: number;
    modTransmission: number;
    modEngine: number;
    modBrakes: number;
}

export type {
    PhoneSettings,
    PhoneMail,
    PhoneLocation,
    PhoneContacts,
    PhoneCallHistory,
    Notification,
    PhonePlayerCard,
    PhoneBusiness,
    PhoneMailMessage,
    JobData,
    JobGrades,
    DarkChatProfile,
    DarkChatChannel,
    ApartMentData,
    HouseData,
    TweetData,
    TweetProfileData,
    GarageData
};