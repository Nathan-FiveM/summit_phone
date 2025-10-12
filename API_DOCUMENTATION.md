# Summit Phone - Complete API Reference

## 🔌 Client-Side Exports

### Core Phone Controls

#### `ForceClosePhone()`
Forces the phone interface to close immediately.
```lua
-- Force close phone
exports['summit_phone']:ForceClosePhone()
```

#### `ToggleDisablePhone(should: boolean)`
Enables or disables the phone functionality.
```lua
-- Disable phone
exports['summit_phone']:ToggleDisablePhone(true)

-- Enable phone
exports['summit_phone']:ToggleDisablePhone(false)
```

#### `CloseAndToggleDisablePhone(should: boolean)`
Closes the phone and sets its availability state.
```lua
-- Close and disable phone
exports['summit_phone']:CloseAndToggleDisablePhone(true)

-- Close and enable phone
exports['summit_phone']:CloseAndToggleDisablePhone(false)
```

### Notification System

#### `sendNotification(data)`
Sends a notification to the player's phone.
```lua
exports['summit_phone']:sendNotification({
    id = 'unique_identifier',          -- string/number: Unique ID
    title = 'Notification Title',      -- string: Title text
    description = 'Description text',  -- string: Description text
    app = 'app_identifier',           -- string: App identifier
    timeout = 5000                    -- number: Timeout in milliseconds
})
```

#### `sendActionNotification(data)`
Sends an action notification with interactive buttons.
```lua
local actionData = json.encode({
    id = 'action_id',
    title = 'Action Required',
    description = 'Please choose an action',
    app = 'system',
    icons = {
        ["0"] = {
            icon = "decline_icon_url",
            isServer = true,
            event = "decline_event",
            args = {}
        },
        ["1"] = {
            icon = "accept_icon_url", 
            isServer = true,
            event = "accept_event",
            args = {data = "example"}
        }
    }
})

exports['summit_phone']:sendActionNotification(actionData)
```

---

## 🖥️ Server-Side Exports

### Phone Information Retrieval

#### `GetCurrentPhoneNumber(source)`
Retrieves the phone number for a player by their source ID.
```lua
local phoneNumber = exports['summit_phone']:GetCurrentPhoneNumber(source)
-- Returns: string | false
```

#### `GetCurrentPhoneNumberByCitizenId(citizenId)`
Retrieves the phone number for a player by their citizen ID.
```lua
local phoneNumber = exports['summit_phone']:GetCurrentPhoneNumberByCitizenId('ABC12345')
-- Returns: string | false
```

#### `GetEmailIdByCitizenId(citizenId)`
Retrieves the email address for a player by their citizen ID.
```lua
local emailId = exports['summit_phone']:GetEmailIdByCitizenId('ABC12345')
-- Returns: string | false
```

#### `GetEmailIdBySource(source)`
Retrieves the email address for a player by their source ID.
```lua
local emailId = exports['summit_phone']:GetEmailIdBySource(source)
-- Returns: string | false
```

### Notification System

#### `SendNotification(source, title, description, app, timeout?)`
Sends a notification to a specific player.
```lua
exports['summit_phone']:SendNotification(
    source,                    -- number: Player source ID
    'Bank Alert',             -- string: Title
    'Payment received',       -- string: Description
    'wallet',                 -- string: App identifier
    5000                      -- number (optional): Timeout in ms
)
```

### Mail System

#### `SendMail(data)`
Sends an email between players.
```lua
local result = exports['summit_phone']:SendMail({
    email = 'sender@summit.rp',      -- string: Sender email
    to = 'recipient@summit.rp',      -- string: Recipient email
    subject = 'Important Message',   -- string: Subject line
    message = 'Email content here',  -- string: Message body
    images = {                       -- table: Image URLs
        'https://example.com/img1.jpg',
        'https://example.com/img2.jpg'
    },
    source = source                  -- number: Sender source ID
})
-- Returns: boolean (success/failure)
```

#### `SendMailToAll(data)`
Sends an email to all players on the server.
```lua
local result = exports['summit_phone']:SendMailToAll({
    subject = 'Server Announcement',     -- string: Subject line
    sender = 'admin@summit.rp',         -- string: Sender email
    message = 'Important server news',   -- string: Message body
    images = {'https://example.com/banner.jpg'} -- table: Image URLs
})
-- Returns: boolean (success/failure)
```

---

## 📡 Events Reference

### Client Events (Triggered with TriggerClientEvent)

#### Core System Events
```lua
-- Phone setup when player spawns
TriggerClientEvent('phone:client:setupPhone', source, citizenId)

-- Remove action notification
TriggerClientEvent('phone:client:removeActionNotification', source, notificationId)

-- Add regular notification
TriggerClientEvent('phone:addnotiFication', source, jsonData)

-- Add action notification
TriggerClientEvent('phone:addActionNotification', source, jsonData)
```

#### Call System Events
```lua
-- Incoming call notification
TriggerClientEvent('summit_phone:server:addCallingNotification', source, callData)

-- Call accepted by receiver
TriggerClientEvent('phone:client:acceptCall', source, callData)

-- Start call animation for caller
TriggerClientEvent('phone:client:startCallAnimation', source)

-- Update caller interface
TriggerClientEvent('phone:client:updateCallerInterface', source, interfaceData)

-- Update interface name (e.g., "Conference Call")
TriggerClientEvent('phone:client:upDateInterFaceName', source, interfaceName)

-- End call animation
TriggerClientEvent('phone:client:endCallAnimation', source)

-- Call ended notification
TriggerClientEvent('phone:client:callEnded', source)
```

#### Jail System Events
```lua
-- Jail phone call trigger
TriggerClientEvent('summit_phone:client:jailPhoneCall', source, phoneNumber)
```

### Server Events (Triggered with TriggerServerEvent)

#### Contact Management
```lua
-- Share phone number between players
TriggerServerEvent('phone:server:shareNumber', targetSource)

-- Add contact to phonebook
TriggerServerEvent('phone:server:addContact', notificationId, contactData)
```

#### Housing Integration
```lua
-- Toggle door lock
TriggerServerEvent('summit_phone:server:toggleDoorlock', {
    propertyId = propertyId,
    doorLocked = true/false
})
```

#### System Events
```lua
-- Recurring system trigger (cron jobs)
TriggerEvent('summit_phone:server:CronTrigger')

-- Player unload handling
AddEventHandler('QBCore:Server:OnPlayerUnload', function(source)
    -- Handle player disconnect
end)

-- Player dropped handling  
AddEventHandler('playerDropped', function(reason)
    -- Handle player drop
end)
```

---

## 🔄 NUI Callbacks Reference

### Core System Callbacks

#### `hideFrame`
Closes the phone interface.
```typescript
RegisterNuiCallbackType('hideFrame');
on('__cfx_nui:hideFrame', () => {
    // Close phone UI
});
```

#### `disableControls`
Toggles control input handling.
```typescript
RegisterNuiCallbackType('disableControls');
on('__cfx_nui:disableControls', (data: boolean) => {
    // Enable/disable controls
});
```

#### `actionNotiButtonOne` / `actionNotiButtonTwo`
Handles action notification button clicks.
```typescript
RegisterNuiCallbackType('actionNotiButtonOne');
on('__cfx_nui:actionNotiButtonOne', (data: {
    id: number;
    isServer: boolean;
    event: string;
    args: any;
}) => {
    // Handle button one click
});
```

### Camera System Callbacks

#### `cameraAppOpen`
Opens or closes the camera application.
```typescript
RegisterNuiCallbackType('cameraAppOpen');
on('__cfx_nui:cameraAppOpen', (data: boolean) => {
    // true = open, false = close
});
```

#### `cameraMode`
Switches camera between portrait and landscape modes.
```typescript
RegisterNuiCallbackType('cameraMode');
on('__cfx_nui:cameraMode', (data: string) => {
    // data: 'portrait' | 'landscape'
});
```

#### `selfiMode`
Toggles selfie camera mode.
```typescript
RegisterNuiCallbackType('selfiMode');
on('__cfx_nui:selfiMode', (data: boolean) => {
    // true = selfie mode, false = normal mode
});
```

### Contact Management Callbacks

#### `getContacts`
Retrieves the player's contact list.
```typescript
RegisterNuiCallbackType('getContacts');
on('__cfx_nui:getContacts', async (data: any, cb: Function) => {
    const contacts = await getPlayerContacts();
    cb(contacts);
});
```

#### `saveContact`
Saves changes to an existing contact.
```typescript
RegisterNuiCallbackType('saveContact');
on('__cfx_nui:saveContact', async (data: ContactData, cb: Function) => {
    const result = await saveContactChanges(data);
    cb(result);
});
```

#### `addContact`
Adds a new contact to the phonebook.
```typescript
RegisterNuiCallbackType('addContact');
on('__cfx_nui:addContact', async (data: ContactData, cb: Function) => {
    const result = await addNewContact(data);
    cb(result);
});
```

### Phone Call Callbacks

#### `phoneCall`
Initiates a phone call.
```typescript
RegisterNuiCallbackType('phoneCall');
on('__cfx_nui:phoneCall', async (data: CallData, cb: Function) => {
    const result = await initiateCall(data);
    cb(result);
});
```

#### `declineCall`
Declines an incoming call.
```typescript
RegisterNuiCallbackType('declineCall');
on('__cfx_nui:declineCall', async (data: any, cb: Function) => {
    await declineIncomingCall(data);
    cb('ok');
});
```

#### `endCall`
Ends the current call.
```typescript
RegisterNuiCallbackType('endCall');
on('__cfx_nui:endCall', async (data: any, cb: Function) => {
    await endCurrentCall(data);
    cb('ok');
});
```

### Wallet System Callbacks

#### `wallet:login`
Authenticates user for wallet access.
```typescript
RegisterNuiCallbackType('wallet:login');
on('__cfx_nui:wallet:login', async (data: LoginData, cb: Function) => {
    const result = await authenticateWallet(data);
    cb(result);
});
```

#### `transXAdqasddasdferMoney`
Transfers money between accounts.
```typescript
RegisterNuiCallbackType('transXAdqasddasdferMoney');
on('__cfx_nui:transXAdqasddasdferMoney', async (data: TransferData, cb: Function) => {
    const result = await transferMoney(data);
    cb(result);
});
```

#### `createInvoice`
Creates a payment invoice.
```typescript
RegisterNuiCallbackType('createInvoice');
on('__cfx_nui:createInvoice', async (data: InvoiceData, cb: Function) => {
    const result = await createPaymentInvoice(data);
    cb(result);
});
```

### Social Media Callbacks (Pigeon)

#### `getAllTweets`
Retrieves the social media feed.
```typescript
RegisterNuiCallbackType('getAllTweets');
on('__cfx_nui:getAllTweets', async (data: any, cb: Function) => {
    const tweets = await getTweetFeed();
    cb(tweets);
});
```

#### `postTweet`
Creates a new social media post.
```typescript
RegisterNuiCallbackType('postTweet');
on('__cfx_nui:postTweet', async (data: TweetData, cb: Function) => {
    const result = await createTweet(data);
    cb(result);
});
```

#### `likeTweet`
Likes/unlikes a social media post.
```typescript
RegisterNuiCallbackType('likeTweet');
on('__cfx_nui:likeTweet', async (data: LikeData, cb: Function) => {
    const result = await toggleTweetLike(data);
    cb(result);
});
```

### Settings Callbacks

#### `getSettings`
Retrieves phone settings.
```typescript
RegisterNuiCallbackType('getSettings');
on('__cfx_nui:getSettings', async (data: any, cb: Function) => {
    const settings = await getPhoneSettings();
    cb(settings);
});
```

#### `setSettings`
Updates phone settings.
```typescript
RegisterNuiCallbackType('setSettings');
on('__cfx_nui:setSettings', async (data: SettingsData, cb: Function) => {
    const result = await updatePhoneSettings(data);
    cb(result);
});
```

---

## 🗂️ Data Types Reference

### Core Types

#### PhoneSettings
```typescript
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
```

#### PhoneContacts
```typescript
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
```

#### PhoneLocation
```typescript
type PhoneLocation = {
    app: string;
    page?: {
        phone?: string;
        messages?: string;
        settings?: string;
        services?: string;
        mail?: string;
        wallet?: string;
        camera?: string;
        // ... other app pages
    };
}
```

### Notification Types

#### Standard Notification
```typescript
type Notification = {
    id: string;
    title: string;
    description: string;
    app: string;
    timeout: number;
}
```

#### Action Notification
```typescript
type ActionNotification = {
    id: string;
    title: string;
    description: string;
    app: string;
    icons: {
        "0": {
            icon: string;
            isServer: boolean;
            event: string;
            args: any;
        };
        "1": {
            icon: string;
            isServer: boolean;
            event: string;
            args: any;
        };
    };
}
```

---

## 🔧 Integration Examples

### Basic Notification Integration
```lua
-- Send a simple notification when player completes a job
exports['summit_phone']:SendNotification(
    source,
    'Job Complete',
    'You earned $500 for completing the delivery',
    'services',
    7000
)
```

### Banking Integration
```lua
-- Get player's phone number for banking notifications
local phoneNumber = exports['summit_phone']:GetCurrentPhoneNumber(source)
if phoneNumber then
    -- Send bank notification
    exports['summit_phone']:SendNotification(
        source,
        'Bank Transfer',
        'You received $1000 from John Doe',
        'wallet'
    )
end
```

### Email Integration
```lua
-- Send automated government email
local citizenId = QBCore.Functions.GetPlayerData(source).citizenid
local email = exports['summit_phone']:GetEmailIdByCitizenId(citizenId)

if email then
    exports['summit_phone']:SendMail({
        email = 'government@summit.rp',
        to = email,
        subject = 'Tax Notice',
        message = 'Your tax bill for this month is ready.',
        images = {},
        source = source
    })
end
```

### Action Notification Integration
```lua
-- Send job offer with accept/decline options
local actionData = json.encode({
    id = 'job_offer_123',
    title = 'Job Opportunity',
    description = 'Pizza delivery job available. $15/hour',
    app = 'services',
    icons = {
        ["0"] = {
            icon = "https://cdn.summitrp.gg/decline.svg",
            isServer = true,
            event = "job:decline",
            args = {jobId = 'pizza_delivery'}
        },
        ["1"] = {
            icon = "https://cdn.summitrp.gg/accept.svg",
            isServer = true,
            event = "job:accept",
            args = {jobId = 'pizza_delivery', wage = 15}
        }
    }
})

TriggerClientEvent('phone:addActionNotification', source, actionData)
```

---

## 📱 App-Specific Features

### Camera System
- Portrait and landscape modes
- Selfie camera support
- Photo capture and storage
- Integration with photo gallery

### Voice Call System
- PMA-Voice integration
- Conference calling support
- Call history tracking
- Jail phone system for emergency calls

### Banking & Wallet
- Money transfers between players
- Invoice system with accept/decline
- Transaction history
- Recurring payment support

### Social Media (Pigeon)
- Twitter-like functionality
- Tweet posting and interaction
- User profiles and following
- Private messaging system

### Housing Integration
- Property management
- Access control (give/remove keys)
- Door lock control
- Key holder management

### Group System
- Team creation and management
- Job step coordination
- Group member management
- Duty status tracking

This API reference provides comprehensive coverage of all available exports, events, and callbacks in the Summit Phone system. Use this documentation to integrate the phone system with your custom resources and scripts.