# Summit Phone - FiveM Phone Script

A comprehensive smartphone system for FiveM servers featuring multiple applications, modern UI, and extensive functionality.

### Preview [YouTube](https://www.youtube.com/watch?v=otF7uU8PSnw)

## 📱 Features

- **Modern React-based UI** with smooth animations and responsive design
- **Multiple Phone Applications** including messaging, calls, social media, banking, and more
- **Real-time Notifications System** with action notifications and regular alerts
- **Advanced Camera System** with portrait/landscape modes and selfie functionality
- **Voice Call Integration** with PMA-Voice support and conference calling
- **Comprehensive Contact Management** with sharing capabilities
- **Banking & Wallet System** with invoicing and transaction history
- **Social Media Integration** (Pigeon - Twitter clone, BluePage, HeartSync dating)
- **Real Estate Management** through housing app
- **Business Directory & Services**
- **Group Management System**
- **Dark Web Integration** (DarkChat)
- **Photo Gallery** with cloud storage

## 🏗️ Architecture

### Frontend (Web)
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: SCSS with Mantine components
- **State Management**: Zustand
- **3D Rendering**: Three.js for camera functionality

### Backend (Game)
- **Client-side**: TypeScript with CitizenFX natives
- **Server-side**: TypeScript with ox_lib callbacks
- **Database**: MongoDB with MySQL support
- **Framework Integration**: QB-Core

## 📋 Dependencies

### Required Resources
- `qb-core` - Core framework
- `ox_lib` - Callback and utility library
- `mongoDB` - Database connector (or oxmysql)
- `summit_logs` - Logging system
- `ox_target` - Targeting system
- `pma-voice` - Voice communication

### Optional Integrations
- `nolag_properties` - Housing system
- `summit_groups` - Group management
- Various job scripts for services integration

## 🚀 Installation

1. **Clone or download** the resource to your `resources` folder
2. **Install dependencies** by running `pnpm install` in both root and `web` directories
3. **Configure database** connections in your server configuration
4. **Add to server.cfg**:
   ```
   ensure summit_phone
   ```
5. **Configure webhooks** and external services as needed
6. **Build the resource**:
   ```bash
   pnpm build
   ```

## 🎯 Usage

### Basic Commands
- **Open Phone**: `F1` key (default) or use item
- **Emergency Call**: Special jail phone integration
- **Share Contact**: Target another player and select "Share Number"

### Admin Commands
- `testNoti` - Test notification system

## 📡 API Documentation

### Client-Side Exports

#### Core Functions
```lua
-- Force close the phone interface
exports['summit_phone']:ForceClosePhone()

-- Toggle phone availability
exports['summit_phone']:ToggleDisablePhone(boolean)

-- Close phone and disable it
exports['summit_phone']:CloseAndToggleDisablePhone(boolean)

-- Send a notification
exports['summit_phone']:sendNotification({
    id = 'unique_id',
    title = 'Notification Title',
    description = 'Notification Description',
    app = 'app_name',
    timeout = 5000
})

-- Send action notification with buttons
exports['summit_phone']:sendActionNotification(jsonString)
```

### Server-Side Exports

#### Phone Information
```lua
-- Get player's phone number by source ID
local phoneNumber = exports['summit_phone']:GetCurrentPhoneNumber(source)

-- Get phone number by citizen ID
local phoneNumber = exports['summit_phone']:GetCurrentPhoneNumberByCitizenId(citizenId)

-- Get email ID by citizen ID
local emailId = exports['summit_phone']:GetEmailIdByCitizenId(citizenId)

-- Get email ID by source
local emailId = exports['summit_phone']:GetEmailIdBySource(source)
```

#### Notifications
```lua
-- Send notification to player
exports['summit_phone']:SendNotification(source, title, description, app, timeout)
```

#### Mail System
```lua
-- Send email
local result = exports['summit_phone']:SendMail({
    email = 'sender@email.com',
    to = 'recipient@email.com',
    subject = 'Subject',
    message = 'Message content',
    images = {'image_url1', 'image_url2'},
    source = sourceId
})

-- Send email to all players
local result = exports['summit_phone']:SendMailToAll({
    subject = 'Subject',
    sender = 'sender@email.com',
    message = 'Message content',
    images = {'image_url1', 'image_url2'}
})
```

### Events

#### Client Events
```lua
-- Phone setup
'phone:client:setupPhone' -- Triggered when player spawns
'phone:client:removeActionNotification' -- Remove action notification

-- Call system
'summit_phone:server:addCallingNotification' -- Incoming call notification
'phone:client:acceptCall' -- Call accepted
'phone:client:startCallAnimation' -- Start call animation
'phone:client:endCallAnimation' -- End call animation
'phone:client:callEnded' -- Call ended
'phone:client:updateCallerInterface' -- Update call interface
'phone:client:upDateInterFaceName' -- Update interface name

-- Notifications
'phone:addnotiFication' -- Add regular notification
'phone:addActionNotification' -- Add action notification

-- Groups
'groups:toggleDuty' -- Toggle job duty status

-- Jail system
'summit_phone:client:jailPhoneCall' -- Jail phone call
```

#### Server Events
```lua
-- Contact sharing
'phone:server:shareNumber' -- Share phone number between players
'phone:server:addContact' -- Add contact to phone book

-- System events
'summit_phone:server:CronTrigger' -- Recurring payments and maintenance
'QBCore:Server:OnPlayerUnload' -- Player disconnect handling
'playerDropped' -- Player dropped from server

-- Housing integration
'summit_phone:server:toggleDoorlock' -- Toggle door lock
'ps-housing:server:addAccess' -- Add housing access
```

### NUI Callbacks

#### Core System
- `hideFrame` - Close phone interface
- `disableControls` - Toggle control disabling
- `actionNotiButtonOne/Two` - Action notification buttons
- `showNoti` - Show notification
- `updatePersonalCard` - Update player card
- `phone:contextMenu:click/close` - Context menu actions

#### Camera System
- `cameraAppOpen` - Open/close camera
- `cameraMode` - Switch camera mode (portrait/landscape)
- `selfiMode` - Toggle selfie mode

#### Applications

**Contacts**
- `getContacts` - Retrieve contact list
- `saveContact` - Save contact changes
- `addContact` - Add new contact
- `deleteContact` - Remove contact
- `favContact` - Toggle favorite status

**Phone/Calls**
- `phoneCall` - Initiate phone call
- `declineCall` - Decline incoming call
- `endCall` - End active call
- `addPlayerToCall` - Add player to conference
- `getCallRecentData` - Get call history
- `callFromDialPad` - Call from dialpad
- `blockNumber` - Block phone number
- `jailPhoneCall` - Emergency jail call

**Messages**
- Various message-related callbacks for sending, receiving, and managing conversations

**Wallet**
- `wallet:login` - Login to wallet
- `getDetailsXS` - Get account details
- `transXAdqasddasdferMoney` - Transfer money
- `getTransactions` - Get transaction history
- `createInvoice` - Create payment invoice
- `getInvoices` - Get invoice list
- `acceptInvoicePayment` - Accept invoice
- `declineInvoicePayment` - Decline invoice

**Services**
- `getAllBusinessData` - Get business directory
- `setWayPoint` - Set GPS waypoint
- `callBusiness` - Call business number
- `getJobData` - Get job information
- `toggleDuty` - Toggle duty status
- Various employee management callbacks

**Settings**
- `getSettings` - Retrieve phone settings
- `setSettings` - Update phone settings
- `registerNewMailAccount` - Register email account
- `searchEmail` - Search for email
- `loginMailAccount` - Login to email
- `unLockorLockPhone` - Lock/unlock phone
- `getCitizenId` - Get player citizen ID
- `getPhonePlayerCard` - Get player card info
- `getStreamerMode/setStreamerMode` - Streamer mode settings

**Social Media (Pigeon)**
- `searchPigeonEmail` - Search Pigeon accounts
- `loginPegionEmail/signupPegionEmail` - Account management
- `getAllTweets` - Get tweet feed
- `likeTweet` - Like tweet
- `retweetTweet` - Retweet
- `postTweet` - Create tweet
- `followUser` - Follow user
- Various other social media interactions

**Photos**
- `saveimageToPhotos` - Save image to gallery
- `getPhotos` - Get photo gallery
- `selectPhoto` - Select photo for actions

**BluePage**
- `bluepage:createPost` - Create BluePage post
- `bluepage:getPosts` - Get BluePage feed
- `bluepage:deletePost` - Delete post

**Housing**
- `getOwnedHouses` - Get owned properties
- `getKeyHolderNames` - Get key holders
- `removeAccess/giveAccess` - Manage property access
- `setLocationOfHouse` - Set house location

**Groups**
- Various group management callbacks for creating, joining, and managing groups

**HeartSync (Dating)**
- Dating app functionality callbacks

**DarkChat**
- `searchDarkChatEmail` - Search dark web emails
- `registerNewDarkMailAccount` - Register dark account
- `loginDarkMailAccount` - Login to dark account
- Various secure messaging callbacks

## 🎨 Customization

### Themes and Styling
- Phone frames available: blue, gold, green, purple, red
- Wallpapers and lock screen customization
- Ringtone customization
- Dark mode support

### Configuration Files
- `types/types.ts` - TypeScript interfaces and types
- `web/src/` - React components and styling
- Individual app folders contain specific configurations

## 🔧 Development

### Building
```bash
# Development mode with hot reload
pnpm dev

# Production build
pnpm build

# Build specific components
pnpm build:client    # Build client-side code
pnpm build:server    # Build server-side code
pnpm build:web       # Build web interface
```

### Project Structure
```
summit_phone/
├── game/
│   ├── client/         # Client-side TypeScript
│   ├── server/         # Server-side TypeScript
│   └── shared/         # Shared utilities
├── web/                # React web interface
├── types/              # TypeScript definitions
├── scripts/            # Build scripts
└── package.json        # Dependencies
```

## 📱 Applications Overview

1. **Phone** - Voice calls, contact management, call history
2. **Messages** - Text messaging with groups and private chats
3. **Contacts** - Contact book with favorites and sharing
4. **Camera** - Photo capture with different modes
5. **Photos** - Gallery with cloud storage integration
6. **Wallet** - Banking, transfers, invoices, transactions
7. **Mail** - Email system with attachments
8. **Services** - Business directory, job management, banking
9. **Settings** - Phone configuration, accounts, security
10. **Pigeon** - Social media (Twitter-like)
11. **BluePage** - Community posts and announcements
12. **Groups** - Team management and coordination
13. **Housing** - Property management and access control
14. **HeartSync** - Dating application
15. **DarkChat** - Secure/anonymous messaging
16. **Garage** - Vehicle management integration

## 🛠️ Troubleshooting

### Common Issues
1. **Phone not opening**: Check if phone is disabled via exports
2. **Notifications not showing**: Verify phone item in inventory
3. **Database errors**: Check MongoDB/MySQL connection
4. **UI not loading**: Ensure web build is complete
5. **Voice calls not working**: Verify pma-voice integration

### Debug Commands
- Use browser developer tools for UI debugging
- Server console shows backend errors
- Check resource logs for detailed error messages

## 📄 License

This resource is licensed for use with FiveM servers. Please check the LICENSE file for specific terms and conditions.

## 🤝 Support

For support and updates, please contact the Summit RP development team or check the official documentation.

---

**Version**: 1.0.0  
**Compatible**: FiveM  
**Framework**: QB-Core  
**Language**: TypeScript/React

# NOTE: This phone was  being used at Summit Roleplay server, Now we have decided to make it open source and not maintaining it anymore. You guys are open to do Whatever you want with this phone, Just Don't Resell it With your names XD

Summit RP Discord: https://discord.gg/summitrp
