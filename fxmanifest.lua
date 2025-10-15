fx_version "cerulean"
game "gta5"

lua54 'yes'
author "Jarvis"
version "2.0.0"
use_experimental_fxv2_oal 'yes'

description 'Summit Phone'

-- UI
ui_page 'web/index.html'

files {
    'web/index.html',
    'web/assets/**',
    'web/fonts/**',
    'web/images/**',
    'web/images/**/**',
}

shared_scripts {
    '@ox_lib/init.lua',
}

dependencies {
    'qb-core',
    'ox_lib',
    'pma-voice'
}

server_scripts {
    'build/server.js',
}

client_scripts {
    'build/client.js',
}