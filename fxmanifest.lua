fx_version "cerulean"
game "gta5"

lua54 'yes'
author "Jarvis"
editor "Nathan-FiveM"
version "2.1.0"
use_experimental_fxv2_oal 'yes'

description 'Summit Phone with Crypto App'

-- UI
ui_page 'web/dist/index.html'

files {
    'web/dist/**',
}

shared_scripts {
    '@ox_lib/init.lua',
}

dependencies {
    'qb-core', -- // qb-core for QBCore or qbx-core for QBox
    'ox_lib',
    'pma-voice'
}

server_scripts {
    'build/server.js',
}

client_scripts {
    'build/client.js',
}
