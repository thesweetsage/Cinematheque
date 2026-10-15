#!/bin/sh
# Fetches the Google Fonts the scene uses into fonts/ (not committed).
set -e
mkdir -p fonts && cd fonts
G=https://raw.githubusercontent.com/google/fonts/main
get() { curl -sSfL "$G/$1" -o "$2"; }
get ofl/bungee/Bungee-Regular.ttf Bungee-Regular.ttf
get ofl/mrdafoe/MrDafoe-Regular.ttf MrDafoe-Regular.ttf
get "ofl/bigshouldersdisplay/BigShouldersDisplay%5Bwght%5D.ttf" BigShoulders.ttf
get ofl/vt323/VT323-Regular.ttf VT323-Regular.ttf
get ofl/anton/Anton-Regular.ttf Anton-Regular.ttf
get ofl/monoton/Monoton-Regular.ttf Monoton-Regular.ttf
get ofl/abrilfatface/AbrilFatface-Regular.ttf AbrilFatface-Regular.ttf
get ofl/righteous/Righteous-Regular.ttf Righteous-Regular.ttf
get ofl/russoone/RussoOne-Regular.ttf RussoOne-Regular.ttf
get ofl/blackopsone/BlackOpsOne-Regular.ttf BlackOpsOne-Regular.ttf
get ofl/creepster/Creepster-Regular.ttf Creepster-Regular.ttf
get ofl/rubikmonoone/RubikMonoOne-Regular.ttf RubikMonoOne-Regular.ttf
get "ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf" Playfair.ttf
get apache/permanentmarker/PermanentMarker-Regular.ttf PermanentMarker-Regular.ttf
get ofl/audiowide/Audiowide-Regular.ttf Audiowide-Regular.ttf
get ofl/bebasneue/BebasNeue-Regular.ttf BebasNeue-Regular.ttf
get "ofl/oswald/Oswald%5Bwght%5D.ttf" Oswald.ttf
